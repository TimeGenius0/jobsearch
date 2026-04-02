#!/usr/bin/env python3
"""
Job search script: LLM orchestrator reads companies.md and criteria.md, assigns
work to the browser-use web service, inspects results, and requests more work
if needed. Runs web-use calls in parallel.
"""

import asyncio
import csv
import json
import logging
import os
import traceback
from pathlib import Path
from datetime import datetime
from typing import Optional, TypedDict

from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_anthropic import ChatAnthropic
from pydantic import BaseModel

# Load API keys from .env in the project directory
_base = Path(__file__).resolve().parent
try:
    from dotenv import load_dotenv
    load_dotenv(_base / ".env")
except ImportError:
    pass

# Logging: details of LLM and web-use output
_log_file = _base / "job_search.log"
log = logging.getLogger("job_search")
log.setLevel(logging.INFO)
log.propagate = False
log.handlers.clear()
fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
fh = logging.FileHandler(_log_file, encoding="utf-8")
fh.setFormatter(fmt)
log.addHandler(fh)
sh = logging.StreamHandler()
sh.setFormatter(fmt)
log.addHandler(sh)


# --- Pydantic models ---
class Job(BaseModel):
    job_url: str
    job_description: str


class JobList(BaseModel):
    jobs: list[Job]


# --- State ---
class JobSearchState(TypedDict, total=False):
    companies_raw: str
    criteria_raw: str
    search_date: str
    results: list[dict]
    iteration: int
    max_iterations: int
    llm_done: bool
    tasks_to_run: list[dict]


def _get_llm() -> ChatAnthropic:
    key = os.getenv("CLAUDE_API_KEY")
    if not key:
        raise ValueError("CLAUDE_API_KEY not set. Add it to .env.")
    return ChatAnthropic(
        model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
        temperature=0,
        api_key=key,
    )


def _orchestrator_node(state: JobSearchState) -> dict:
    """
    LLM orchestrator: given companies.md, criteria.md, and current results,
    decides what work to assign or if we're done. Inspects results and may
    request more work (e.g. retry companies with 0 jobs).
    """
    companies_raw = state["companies_raw"]
    criteria_raw = state["criteria_raw"]
    results = state.get("results") or []
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 5)

    if iteration >= max_iterations:
        return {"llm_done": True, "tasks_to_run": [], "iteration": iteration + 1}

    # Build summary of results for LLM
    jobs_by_company: dict[str, int] = {}
    for r in results:
        c = r["company_name"]
        jobs_by_company[c] = jobs_by_company.get(c, 0) + 1

    results_summary = "\n".join(
        f"- {company}: {count} job(s)" for company, count in sorted(jobs_by_company.items())
    ) if jobs_by_company else "(no results yet)"

    system = """You are an orchestrator for a job search workflow. You have access to:
1. companies.md - the list of companies to search
2. criteria.md - job matching criteria
3. A browser-use web service that can search career pages and extract jobs

Your job:
1. Assign work to the browser-use service: for each company, create a task with company name and optional search_hint (e.g. "try careers page" or "search for engineering roles" if retrying).
2. Inspect the results summary. If a company has 0 jobs, consider requesting more work with a different search_hint.
3. Output JSON with either:
   - {"done": true, "reason": "..."} when satisfied (all companies searched and results adequate, or no more useful work)
   - {"done": false, "tasks": [{"company": "X", "search_hint": "optional hint"}]} to run more searches

Rules:
- On first run (no results yet), assign tasks for ALL companies in companies.md so they run in parallel.
- On later runs, only assign tasks for companies that need retries (0 jobs, or you suspect incomplete results).
- Keep search_hint brief. Use null if no special hint.
- Maximum 5 rounds. Prefer "done" if results are reasonable."""

    user = f"""## companies.md
{companies_raw}

## criteria.md
{criteria_raw}

## Current results (round {iteration + 1})
{results_summary}

## Your decision
Output valid JSON only. Either {{"done": true, "reason": "..."}} or {{"done": false, "tasks": [{{"company": "X", "search_hint": null}}]}}."""

    llm = _get_llm()
    msg = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
    raw = msg.content.strip() if hasattr(msg, "content") else str(msg)

    log.info("LLM raw response:\n%s", raw)

    # Parse JSON from response (handle markdown code blocks)
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        data = json.loads(raw)
        done = data.get("done", False)
        tasks = data.get("tasks", [])
        reason = data.get("reason", "")
        log.info("LLM parsed: done=%s, reason=%s, tasks=%s", done, reason, json.dumps(tasks, indent=2))
    except json.JSONDecodeError:
        done = True
        tasks = []
        reason = "Failed to parse LLM response"
        log.warning("LLM JSON parse failed: %s", raw[:500])

    if done:
        print(f"  LLM: done. {reason}")
    else:
        companies = [t.get("company", "") for t in tasks if t.get("company")]
        print(f"  LLM: assigning {len(companies)} task(s) in parallel: {companies}")

    return {
        "llm_done": done,
        "tasks_to_run": tasks,
        "iteration": iteration + 1,
    }


async def _run_single_search(
    company: str,
    search_hint: Optional[str],
    criteria_raw: str,
    search_date: str,
) -> list[dict]:
    """Run one browser-use search for a company. Returns list of job dicts."""
    hint = f" Hint: {search_hint}" if search_hint else ""
    task = f"""Find the official career or jobs page for the company "{company}".{hint}
Extract every job listing that matches these criteria. For each job, record the full URL and full job description text.

Criteria:
---
{criteria_raw}
---

Return a JSON object with a "jobs" array. Each job: {{"job_url": "...", "job_description": "..."}}. If no jobs match, return {{"jobs": []}}."""

    log.info("Web-use task for %s:\n%s", company, task[:1000] + ("..." if len(task) > 1000 else ""))

    import httpx
    last_error = None
    for attempt in range(3):
        try:
            from browser_use_sdk import AsyncBrowserUse

            client = AsyncBrowserUse()
            run_result = await client.run(task, output_schema=JobList)
            output = run_result.output if hasattr(run_result, "output") else None

            if output and isinstance(output, JobList):
                if output.jobs:
                    jobs = [
                        {
                            "company_name": company,
                            "search_date": search_date,
                            "job_url": j.job_url,
                            "job_description": j.job_description,
                        }
                        for j in output.jobs
                    ]
                    log.info("Web-use result for %s: %d job(s)", company, len(jobs))
                    for i, j in enumerate(jobs):
                        log.info("  [%s] job %d: url=%s desc_len=%d", company, i + 1, j["job_url"], len(j.get("job_description", "")))
                    return jobs
                else:
                    log.info("Web-use result for %s: 0 job(s) found", company)
                    return []

            # Fallback: parse raw text
            raw = str(getattr(run_result, "output", None) or run_result)
            log.info("Web-use raw result for %s:\n%s", company, raw[:2000] + ("..." if len(raw) > 2000 else ""))
            if "{" in raw and "}" in raw:
                start, end = raw.find("{"), raw.rfind("}") + 1
                data = json.loads(raw[start:end])
                jobs = [
                    {
                        "company_name": company,
                        "search_date": search_date,
                        "job_url": j.get("job_url", ""),
                        "job_description": j.get("job_description", ""),
                    }
                    for j in data.get("jobs", [])
                ]
                log.info("Web-use parsed for %s: %d job(s)", company, len(jobs))
                return jobs
        except (httpx.ConnectError, ConnectionError, OSError) as e:
            last_error = e
            err_str = str(e).strip() or type(e).__name__
            if attempt < 2:
                log.warning("Web-use connection error for %s (attempt %d/3): %s. Retrying in 2s...", company, attempt + 1, err_str)
                await asyncio.sleep(2)
            else:
                break
        except Exception as e:
            last_error = e
            break

    if last_error is not None:
        err_msg = str(last_error).strip() or type(last_error).__name__
        tb = "".join(traceback.format_exception(type(last_error), last_error, last_error.__traceback__))
        log.error("Web-use error for %s: %s\n%s", company, err_msg, tb)
        return [{
            "company_name": company,
            "search_date": search_date,
            "job_url": "",
            "job_description": f"[Error: {err_msg}]",
            "_is_error": True,
        }]
    return []


async def _parallel_web_use_node(state: JobSearchState) -> dict:
    """
    Run all assigned tasks in parallel via the browser-use web service.
    """
    tasks_to_run = state.get("tasks_to_run") or []
    results = list(state.get("results") or [])
    criteria_raw = state["criteria_raw"]
    search_date = state["search_date"]

    if not tasks_to_run:
        return {"results": results}

    # Build coroutines for parallel execution
    coros = [
        _run_single_search(
            t.get("company", ""),
            t.get("search_hint"),
            criteria_raw,
            search_date,
        )
        for t in tasks_to_run
        if t.get("company")
    ]

    print(f"  Running {len(coros)} browser-use call(s) in parallel...")
    batch_results = await asyncio.gather(*coros, return_exceptions=True)

    for item in batch_results:
        if isinstance(item, Exception):
            results.append({
                "company_name": "unknown",
                "search_date": search_date,
                "job_url": "",
                "job_description": f"[Error: {item}]",
                "_is_error": True,
            })
        else:
            results.extend(item)

    total_new = sum(len(r) for r in batch_results if isinstance(r, list))
    error_count = sum(
        1 for r in batch_results
        if isinstance(r, list)
        for j in r
        if j.get("_is_error")
    )
    real_count = total_new - error_count
    print(f"  Got {real_count} job(s) from this round" + (f", {error_count} error(s)" if error_count else "") + ".")
    log.info("Round complete: %d real job(s), %d error(s)", real_count, error_count)
    return {"results": results}


def _route_after_orchestrator(state: JobSearchState) -> str:
    """After orchestrator: run more work or end."""
    if state.get("llm_done"):
        return "end"
    tasks = state.get("tasks_to_run") or []
    if not tasks:
        return "end"
    return "parallel_web_use"


def _route_after_web_use(state: JobSearchState) -> str:
    """After parallel web use: always back to orchestrator to inspect results."""
    return "orchestrator"


def write_final_table(rows: list[dict], out_path: Path, format: str = "csv") -> None:
    # Exclude error placeholders from report
    ok_rows = [r for r in rows if not r.get("_is_error")]
    for r in ok_rows:
        r.pop("_is_error", None)
    for r in rows:
        r.pop("_is_error", None)
    rows_to_write = ok_rows
    if len(ok_rows) < len(rows):
        log.warning("Excluding %d error row(s) from report", len(rows) - len(ok_rows))
    if format == "csv":
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(
                f,
                fieldnames=["company_name", "search_date", "job_url", "job_description"],
                extrasaction="ignore",
            )
            w.writeheader()
            w.writerows(rows_to_write)
    else:
        lines = [
            "| Company | Search date | Job URL | Job description |",
            "| --- | --- | --- | --- |",
        ]
        for r in rows_to_write:
            desc = (r["job_description"] or "")[:200].replace("|", "\\|").replace("\n", " ")
            if len(r["job_description"] or "") > 200:
                desc += "..."
            lines.append(
                f"| {r['company_name']} | {r['search_date']} | {r['job_url']} | {desc} |"
            )
        out_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    base = Path(__file__).resolve().parent
    companies_path = base / "config" / "companies.md"
    criteria_path = base / "config" / "criteria.md"
    search_date = datetime.now().strftime("%Y-%m-%d")

    if not companies_path.exists():
        raise SystemExit("companies.md not found.")
    if not criteria_path.exists():
        raise SystemExit("criteria.md not found.")

    companies_raw = companies_path.read_text(encoding="utf-8").strip()
    criteria_raw = criteria_path.read_text(encoding="utf-8").strip()

    if not companies_raw or not criteria_raw:
        raise SystemExit("companies.md and criteria.md must not be empty.")

    print("Companies and criteria loaded from files.")
    print(f"Search date: {search_date}")
    print("Running LLM orchestrator → parallel browser-use...")
    log.info("=== Job search started ===")
    log.info("Search date: %s", search_date)
    print()

    # Build workflow
    workflow = StateGraph(JobSearchState)

    workflow.add_node("orchestrator", _orchestrator_node)
    workflow.add_node("parallel_web_use", _parallel_web_use_node)

    workflow.add_edge(START, "orchestrator")
    workflow.add_conditional_edges(
        "orchestrator",
        _route_after_orchestrator,
        {"parallel_web_use": "parallel_web_use", "end": END},
    )
    workflow.add_conditional_edges(
        "parallel_web_use",
        _route_after_web_use,
        {"orchestrator": "orchestrator", "end": END},
    )

    graph = workflow.compile()

    initial = {
        "companies_raw": companies_raw,
        "criteria_raw": criteria_raw,
        "search_date": search_date,
        "results": [],
        "iteration": 0,
        "max_iterations": 5,
        "llm_done": False,
        "tasks_to_run": [],
    }

    async def run():
        return await graph.ainvoke(initial)

    final = asyncio.run(run())
    all_rows = final.get("results") or []
    rows = [r for r in all_rows if not r.get("_is_error")]

    if not rows:
        err_count = sum(1 for r in all_rows if r.get("_is_error"))
        if err_count:
            print(f"No jobs collected ({err_count} error(s)). Check network and BROWSER_USE_API_KEY. See job_search.log for details.")
        else:
            print("No job rows collected. Check CLAUDE_API_KEY and BROWSER_USE_API_KEY.")
        return

    out_csv = base / "jobs_report.csv"
    out_md = base / "jobs_report.md"
    write_final_table(rows, out_csv, "csv")
    write_final_table(rows, out_md, "md")
    print(f"\nTotal jobs: {len(rows)}")
    print(f"Table saved to: {out_csv} and {out_md}")
    log.info("=== Job search finished: %d jobs ===", len(rows))
    log.info("Log saved to: %s", _log_file)


if __name__ == "__main__":
    main()
