# Job search from company career pages

This project uses a **LLM workflow** to find companies’ career pages, extract job listings that match your criteria, and build a table with job URL, description, company name, and search date.

## Architecture: LLM workflow → Browser Use service

The script uses [LangGraph](https://langchain-ai.github.io/langgraph/) to run a workflow:

1. **LLM node** – For each company, an LLM (Claude) reads the company name and `criteria.md`, then formulates a concise task for the browser automation agent.
2. **Browser Use node** – The task is sent to the [Browser Use Cloud](https://cloud.browser-use.com) API (via `browser-use-sdk`), which runs a real browser to find the career page and extract jobs.
3. **Loop** – The workflow repeats for each company, then merges results into one table.

## Setup

Put your API keys in a `.env` file:

```bash
cp .env.example .env
# Edit .env and set:
# BROWSER_USE_API_KEY=your-browser-use-api-key
# CLAUDE_API_KEY=your-claude-api-key
```

- **BROWSER_USE_API_KEY** – [Browser Use Cloud](https://cloud.browser-use.com) (free trial available).
- **CLAUDE_API_KEY** – For the LLM that formulates tasks (default model: `claude-sonnet-4-20250514`).

The script loads `.env` automatically. Do not commit `.env` (it is in `.gitignore`).

## Project layout

| File | Purpose |
|------|--------|
| `companies.md` | List of company names (one per line or as list items). |
| `criteria.md` | Job matching criteria (titles, keywords, exclusions) in plain text. |
| `job_search.py` | LLM workflow script (LangGraph + browser-use-sdk). |
| `jobs_report.csv` | Final table: company, search date, job URL, job description. |
| `jobs_report.md` | Same table in Markdown. |

## Usage

1. **Edit inputs**
   - Put target companies in `companies.md`.
   - Put your job criteria in `criteria.md`.

2. **Install and configure** (Python 3.10+ required; 3.9 will fail with `str | None` errors)
   ```bash
   # Recreate venv with Python 3.10+ if you get "Unable to evaluate type annotation 'str | None'"
   rm -rf .venv
   python3.12 -m venv .venv   # or python3.11, python3.10
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env and set BROWSER_USE_API_KEY and CLAUDE_API_KEY
   ```

3. **Run** (use the project venv so dependencies are available)
   ```bash
   source .venv/bin/activate
   python job_search.py
   ```
   Or: `./run.sh`

4. **Output**
   - The LLM formulates a task per company, then the Browser Use service runs it.
   - Results are merged and written to:
     - `jobs_report.csv` – full table (company, search date, job URL, job description).
     - `jobs_report.md` – same as Markdown (description truncated in the table for readability).

## Table columns

| Column | Description |
|--------|-------------|
| `company_name` | From `companies.md`. |
| `search_date` | Date the search was run (YYYY-MM-DD). |
| `job_url` | Full URL of the job posting. |
| `job_description` | Full text of the job description. |

## Requirements

- **Python 3.10+** (browser-use-sdk uses type syntax that requires 3.10+)
- Browser Use API key (for the web service)
- Claude (Anthropic) API key (for the LLM workflow)
# jobsearch
