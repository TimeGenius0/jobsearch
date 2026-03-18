#!/usr/bin/env python3
"""
Cover letter generator.

Usage:
    python cover_letter.py <job_url> [--notes "your notes"]
    python cover_letter.py <job_url> --notes "targeting ML infra role, emphasise Attila AI"

Fetches the job description from the URL, then uses Claude to write a crisp,
personalised cover letter based on the embedded resume and any extra notes.
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

import httpx
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass


# ---------------------------------------------------------------------------
# Resume
# ---------------------------------------------------------------------------
RESUME = """
Product, Science & Engineering Leader

AI founder and product leader with 15+ years building AI products for consumer
services, B2B and enterprise clients. In early-stage startups like Attila AI and
large-scale enterprises like Intuit, I've delivered AI solutions that move the
needle including a marketing campaign recommender that drove 35% omnichannel
penetration growth and a Virtual Sales Assistant that increased cross-sell rates
by 82%. I hold an MSc in Software Management and Electrical Engineering, have led
teams of 40+, and regularly partner with C-suite stakeholders. Also an early-stage
investor, advisor, and aspiring artist.

PROFESSIONAL HIGHLIGHTS

Principal Product Manager, Intuit Mailchimp, Mountain View, CA  (Apr 2025 – Present)
NASDAQ: INTU. 2025 Sales: $18B, employees: 18,000. Hired to report to the CPO.
- Owned Agentic AI strategy: done-for-you campaign recommendations, multimodal
  content generation (layout, text, image), and conversational AI agents.
- Delivered 35% lift in omnichannel penetration growth → +$10M ARR opportunity.
- Led Mailchimp's ChatGPT and Claude apps; built the chat-based agentic AI platform.
- 0→1 agentic content generation to PMF, reducing churn by 78 bps in 1 quarter.
- Established AI quality standards, Evals frameworks, GenAI Trust & Safety guardrails.
- Enabled launch of 6 agentic AI experiences; mentored 8 Principal–Staff PMs on AI
  quality, compliance, and platform integration.

Co-Founder & Chief Product Scientist, AICTOS, San Francisco, CA  (Mar 2023 – May 2025)
AI bootstrapped startup, 2024 Sales: $1.2M, employees: 2.
- Founded and led product for Aictos, a marketplace connecting SMBs with software
  engineering leaders assisted by AI agents for technical leadership and code quality.
- Designed AI agents for technical decision-making, engineering productivity, and
  project risk detection across distributed teams.
- Built a community of 45 experienced CTOs to validate use cases and refine workflows.

Director of Product, ParagonOne / Extern.com (YC 2017), San Francisco, CA  (Apr 2022 – Feb 2023)
Edtech startup backed by YC, 2022 Sales: $8M, employees: 30. Reported to the CTO.
- Led product vision, strategy, and roadmap; overseeing 2 PMs and 5 engineers.
- Pivoted the company to Enterprise/ESG segment after pitching the founders directly.
- Improved SQL conversion rates from 7% to 44% through GTM realignment.

Co-Founder & CPO, Attila AI, Tunis, Tunisia  (Feb 2016 – Jul 2020)
MarketingTech AI startup, 2020 Sales: $3M, employees: 12. Acquired by Craft Foundry.
- Led company from 0→1; hired ~20-person cross-functional team.
- Built ML recommendation engine for banking apps (credit cards, loans, savings).
- Boosted cross-sell conversion rate by 82% vs rule-based systems; +5% in conversions.

VP of Product & Growth, Tayara.tn (subsidiary of Schibsted), Tunis, Tunisia  (Jan 2015 – Jan 2016)
EURONEXT: VEND, 2015 Sales: $1.9B. Hired to report to the head of emerging markets.
- Scaled to 2.5M MAU; 5th most visited site in Tunisia.
- Led team of 10; partnered with 40-person global cross-functional team.

Co-Founder & CPO, Zouz, Tunis, Tunisia  (Mar 2010 – Jun 2014)
Social discovery startup backed by ACP and ATD capital, 2014 Sales: $0.5M, employees: 15.
- Raised seed and Series A funding; grew to 100K MAU.
- 42% activation ratio; 71% 3-month retention.

Product Manager, Sequans Communications, Cupertino, CA  (Apr 2007 – Feb 2010)
NYSE: SQNS — fabless semiconductor (4G/WiMAX SoCs).
- Managed VoIP integration for 4G semiconductor chip.
- Defined GTM strategy for 802.16e SoC; wrote technical white papers on MIMO systems.

EDUCATION
ENST Telecom ParisTech, MS in Electrical Engineering, Paris, France  (2004–2007)

SKILLS
Machine Learning: ML product lifecycle, Transformers/LSTMs, GenAI (GANs, VAEs,
LLMs), MLOps, Edge ML, Neural codecs (EnCodec, SoundStream), data engineering.
"""

SYSTEM_PROMPT = """You are an expert cover letter writer for senior tech and product leaders.
You write crisp, confident, and specific letters — never generic, never sycophantic.
The letter should be 3 short paragraphs:
1. Why this company and role specifically (tie to the JD).
2. Two or three concrete achievements from the resume that directly match the role's needs.
3. A brief, direct close — what you bring and why you'd like to chat.

Tone: direct, warm, no fluff. No "I am writing to express my interest". No bullet points.
Length: under 200 words. Output the letter only — no subject line, no metadata."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def fetch_page_text(url: str) -> str:
    """Fetch a URL and return visible text (HTML stripped via simple heuristic)."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        )
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        if "html" in content_type:
            # Strip tags with a simple regex-free approach via html.parser
            from html.parser import HTMLParser

            class _Stripper(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self._chunks = []
                    self._skip = False

                def handle_starttag(self, tag, attrs):
                    if tag in ("script", "style", "nav", "footer", "head"):
                        self._skip = True

                def handle_endtag(self, tag):
                    if tag in ("script", "style", "nav", "footer", "head"):
                        self._skip = False

                def handle_data(self, data):
                    if not self._skip:
                        stripped = data.strip()
                        if stripped:
                            self._chunks.append(stripped)

                def get_text(self):
                    return "\n".join(self._chunks)

            stripper = _Stripper()
            stripper.feed(resp.text)
            return stripper.get_text()[:8000]
        return resp.text[:8000]


def _get_llm() -> ChatAnthropic:
    key = os.getenv("CLAUDE_API_KEY")
    if not key:
        raise ValueError("CLAUDE_API_KEY not set. Add it to .env.")
    return ChatAnthropic(model="claude-sonnet-4-6", temperature=0.7, max_tokens=512, api_key=key)


async def generate_cover_letter(job_url: str, notes: str) -> str:
    job_text = await fetch_page_text(job_url)

    user_content = f"""JOB DESCRIPTION (fetched from {job_url}):
{job_text}

MY RESUME:
{RESUME}
"""
    if notes.strip():
        user_content += f"\nMY NOTES / EXTRA CONTEXT:\n{notes.strip()}\n"

    user_content += "\nWrite the cover letter now."

    llm = _get_llm()
    response = await llm.ainvoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ])
    return response.content.strip()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate a cover letter for a job posting.")
    parser.add_argument("url", help="URL of the job description")
    parser.add_argument("--notes", default="", help="Extra context or targeting notes")
    args = parser.parse_args()

    print(f"Fetching job description from {args.url} …\n")
    letter = asyncio.run(generate_cover_letter(args.url, args.notes))
    print("=" * 60)
    print(letter)
    print("=" * 60)


if __name__ == "__main__":
    main()
