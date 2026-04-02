"""Tests for cover_letter fit assessment and grading functions."""
import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import cover_letter


def _mock_llm(content: str) -> MagicMock:
    response = MagicMock()
    response.content = content
    llm = MagicMock()
    llm.ainvoke = AsyncMock(return_value=response)
    return llm


def test_generate_fit_assessment_returns_string():
    llm = _mock_llm("Strong match on AI product leadership. Lacks fintech domain depth. Overall good opportunity.")
    with patch("cover_letter._get_llm", return_value=llm):
        result = asyncio.run(cover_letter.generate_fit_assessment("job description text", ""))
    assert isinstance(result, str)
    assert len(result) > 0


def test_generate_fit_assessment_includes_notes_in_prompt():
    llm = _mock_llm("Assessment text.")
    with patch("cover_letter._get_llm", return_value=llm):
        asyncio.run(cover_letter.generate_fit_assessment("job text", "focus on ML infra"))
    call_args = llm.ainvoke.call_args[0][0]  # list of messages
    human_message_content = call_args[1].content
    assert "focus on ML infra" in human_message_content
    system_message_content = call_args[0].content
    assert system_message_content == cover_letter.FIT_ASSESSMENT_SYSTEM


def test_generate_fit_assessment_omits_empty_notes():
    llm = _mock_llm("Assessment text.")
    with patch("cover_letter._get_llm", return_value=llm):
        asyncio.run(cover_letter.generate_fit_assessment("job text", ""))
    call_args = llm.ainvoke.call_args[0][0]
    human_message_content = call_args[1].content
    assert "EXTRA CONTEXT" not in human_message_content


def test_grade_job_no_recent_entries_returns_grade_and_rationale():
    payload = json.dumps({"grade": 4, "rationale": "Strong AI product alignment."})
    llm = _mock_llm(payload)
    with patch("cover_letter._get_llm", return_value=llm):
        grade, rationale = asyncio.run(cover_letter.grade_job("Good fit summary.", []))
    assert grade == 4
    assert rationale == "Strong AI product alignment."


def test_grade_job_with_recent_entries_includes_context_in_prompt():
    payload = json.dumps({"grade": 3, "rationale": "Below average vs recent set."})
    llm = _mock_llm(payload)
    recent = [
        {"company": "Stripe", "fit_summary": "Good fintech fit.", "grade": "4"},
        {"company": "OpenAI", "fit_summary": "Direct AI match.", "grade": "5"},
    ]
    with patch("cover_letter._get_llm", return_value=llm):
        asyncio.run(cover_letter.grade_job("Current fit summary.", recent))
    call_args = llm.ainvoke.call_args[0][0]
    human_content = call_args[1].content
    assert "Stripe" in human_content
    assert "OpenAI" in human_content


def test_grade_job_grade_is_integer():
    payload = json.dumps({"grade": 2, "rationale": "Weak match."})
    llm = _mock_llm(payload)
    with patch("cover_letter._get_llm", return_value=llm):
        grade, _ = asyncio.run(cover_letter.grade_job("Weak fit.", []))
    assert isinstance(grade, int)
