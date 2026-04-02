"""Tests for activity_logger extensions."""
import csv
import sys
from pathlib import Path

import pytest

# Allow importing activity_logger from the parent directory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import activity_logger


def _write_csv(path: Path, rows: list[dict]) -> None:
    fields = ["timestamp", "tool", "url", "company", "outcome", "details", "fit_summary", "grade"]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def test_get_recent_entries_empty_log(tmp_path):
    activity_logger.LOG_PATH = tmp_path / "activity.log"
    assert activity_logger.get_recent_entries() == []


def test_get_recent_entries_no_log_file(tmp_path):
    activity_logger.LOG_PATH = tmp_path / "nonexistent.log"
    assert activity_logger.get_recent_entries() == []


def test_get_recent_entries_skips_rows_without_fit_summary(tmp_path):
    log = tmp_path / "activity.log"
    activity_logger.LOG_PATH = log
    _write_csv(log, [
        {"timestamp": "2026-01-01T10:00:00", "tool": "cover-letter", "url": "http://a.com",
         "company": "Acme", "outcome": "success", "details": "", "fit_summary": "", "grade": ""},
        {"timestamp": "2026-01-02T10:00:00", "tool": "cover-letter", "url": "http://b.com",
         "company": "Beta", "outcome": "success", "details": "", "fit_summary": "Good fit.", "grade": "4"},
    ])
    result = activity_logger.get_recent_entries()
    assert len(result) == 1
    assert result[0]["company"] == "Beta"


def test_get_recent_entries_returns_last_n(tmp_path):
    log = tmp_path / "activity.log"
    activity_logger.LOG_PATH = log
    rows = [
        {"timestamp": f"2026-01-0{i}T10:00:00", "tool": "cover-letter",
         "url": f"http://co{i}.com", "company": f"Co{i}", "outcome": "success",
         "details": "", "fit_summary": f"Summary {i}.", "grade": str(i)}
        for i in range(1, 6)
    ]
    _write_csv(log, rows)
    result = activity_logger.get_recent_entries(n=3)
    assert len(result) == 3
    assert result[0]["company"] == "Co3"
    assert result[2]["company"] == "Co5"


def test_log_activity_writes_fit_summary_and_grade(tmp_path):
    log = tmp_path / "activity.log"
    activity_logger.LOG_PATH = log
    activity_logger.log_activity(
        "cover-letter", "http://x.com", "Xco", "success", "out.docx",
        fit_summary="Strong match.", grade=5
    )
    with log.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 1
    assert rows[0]["fit_summary"] == "Strong match."
    assert rows[0]["grade"] == "5"


def test_log_activity_defaults_fit_fields_to_empty(tmp_path):
    log = tmp_path / "activity.log"
    activity_logger.LOG_PATH = log
    activity_logger.log_activity("cover-letter", "http://x.com", "Xco", "success")
    with log.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert rows[0]["fit_summary"] == ""
    assert rows[0]["grade"] == ""
