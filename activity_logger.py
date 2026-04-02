"""Shared activity logger for job search tools."""

import csv
from datetime import datetime
from pathlib import Path

LOG_PATH = Path(__file__).resolve().parent.parent / "activity.log"

FIELDS = ["timestamp", "tool", "url", "company", "outcome", "details", "fit_summary", "grade"]


def log_activity(
    tool: str,
    url: str,
    company: str,
    outcome: str,
    details: str = "",
    fit_summary: str = "",
    grade: int | None = None,
) -> None:
    """Append one row to the shared activity log."""
    with LOG_PATH.open("a", newline="", encoding="utf-8") as f:
        write_header = f.tell() == 0
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        if write_header:
            writer.writeheader()
        writer.writerow({
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "tool": tool,
            "url": url,
            "company": company,
            "outcome": outcome,
            "details": details,
            "fit_summary": fit_summary,
            "grade": grade if grade is not None else "",
        })


def get_recent_entries(n: int = 10) -> list[dict]:
    """Return the last n log rows that have a non-empty fit_summary.

    Returns a list of dicts with keys: company, fit_summary, grade.
    Returns [] if the log does not exist or has no qualifying rows.
    """
    if not LOG_PATH.exists():
        return []
    with LOG_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [
            {"company": r.get("company", ""), "fit_summary": r["fit_summary"], "grade": r.get("grade", "")}
            for r in reader
            if r.get("fit_summary", "").strip()
        ]
    return rows[-n:]
