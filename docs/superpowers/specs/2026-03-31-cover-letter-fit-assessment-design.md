# Cover Letter Fit Assessment & Grading

**Date:** 2026-03-31
**Status:** Approved

## Overview

Extend `cover_letter.py` to produce two outputs per job: the existing `.docx` cover letter and a new fit assessment. The assessment is printed to the terminal and logged. A second grading step compares the current job against the last 10 logged assessments and assigns a grade from 1 (poor fit, low success chance) to 5 (excellent fit, strong success chance).

## Files Changed

- `jobsearch/cover_letter.py` — two new async functions, updated `main()` pipeline
- `jobsearch/activity_logger.py` — two new fields in the log schema, one new read function

## Log Schema Change

`activity.log` gains two new CSV columns appended to the existing schema:

| Column | Type | Description |
|---|---|---|
| `fit_summary` | string | 2–3 sentence plain-text fit assessment |
| `grade` | int (1–5) | Relative grade vs last 10 logged jobs |

Old rows missing these columns are handled by `csv.DictReader` defaulting missing keys to empty string — no migration needed.

## New Functions

### `activity_logger.py`

`log_activity()` gains two optional keyword parameters: `fit_summary: str = ""` and `grade: int | None = None`. Callers that don't pass them get empty values in the log — existing call sites in `cover_letter.py` and the TypeScript CLI are unaffected.

```
get_recent_entries(n=10) -> list[dict]
```
Reads the last `n` rows from `activity.log` that have a non-empty `fit_summary`. Returns them as a list of dicts with keys `company`, `fit_summary`, `grade`. Used to supply context to the grading call.

### `cover_letter.py`

```
generate_fit_assessment(job_text: str, notes: str) -> str
```
Call 2. Sends the job description text and resume to Claude with a focused prompt asking for a 2–3 sentence fit assessment: what aligns, what's weak, overall impression. Returns the summary string.

```
grade_job(fit_summary: str, recent_entries: list[dict]) -> tuple[int, str]
```
Call 3. Sends the current job's fit summary alongside up to 10 previous entries (company, fit_summary, grade) and asks Claude to assign a grade 1–5 relative to those. Returns `(grade, one_line_rationale)`. If fewer than 10 (or zero) prior entries exist, Claude grades on absolute criteria.

## Execution Flow

`main()` becomes a sequential pipeline:

1. Fetch job description text (unchanged)
2. **Call 1** — Generate cover letter → print preview, save `.docx` (unchanged)
3. **Call 2** — `generate_fit_assessment()` → print fit assessment to terminal
4. Read last 10 entries via `get_recent_entries()`
5. **Call 3** — `grade_job()` → print grade + rationale to terminal
6. Log one entry with all fields including `fit_summary` and `grade`

Logging happens once at the end — no intermediate writes.

## Terminal Output Format

```
============================================================
[cover letter text]
============================================================

🎯 Fit Assessment:
<2–3 sentence summary>

📊 Grade: X/5
<one-line rationale comparing to recent jobs>

✅ Cover letter saved to: output/Cover_Letter_Acme_20260331_120000.docx
```

## Error Handling

- If the fit assessment call fails, log the error in `details`, skip grading, and still save the cover letter.
- If the grading call fails, log without a grade (empty `grade` field) and still print the fit assessment.
- `get_recent_entries()` returns an empty list if the log doesn't exist yet — grading falls back to absolute criteria.
