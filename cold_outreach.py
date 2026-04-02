#!/usr/bin/env python3
"""
Cold outreach message generator (~200 chars).

Usage:
    python cold_outreach.py <company_url> <job_description_url_or_text>
    python cold_outreach.py <company_url> <job_url> --linkedin "copy-pasted LinkedIn profile text"
    python cold_outreach.py <company_url> <job_url> --linkedin-file person.txt

Fetches the company website and job description, then uses Claude to write a
concise (~200 character) personalised cold outreach message to learn about the
product org of a potential employer.
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from activity_logger import log_activity

import httpx
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass


# ---------------------------------------------------------------------------
# Resume (same as cover_letter.py)
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

SYSTEM_PROMPT = """You are an expert at writing ultra-concise cold outreach messages for senior product leaders exploring career opportunities.

The sender is a senior AI product leader reaching out to learn about the company and, ideally, get a referral or warm intro. The goal is a genuine conversation — not a cold application.

Write a single cold outreach message that:
- Is exactly ~200 characters (hard limit: 220 characters max, aim for 180-200)
- Reads like a genuine human wrote it — never robotic or template-like
- Opens by echoing specific language or framing from the company (a product name, tagline, or positioning) to show real engagement
- Pivots naturally into career curiosity — something like what it's like to work there, how the team is structured, or what they look for — framed as genuine interest, not desperation
- If a LinkedIn profile is provided, personalise to the recipient's specific role, tenure, or career path rather than the company alone
- Ends with a single soft ask: a 15-min chat to learn more about the team and whether there might be a fit
- Tone: direct, warm, peer-to-peer — one senior operator talking to another

Do NOT: mention "cold outreach", use buzzwords like "synergies", say "I came across your profile", sound like a cover letter, or start with "I".
Output the message only — no quotes, no label, no explanation."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_url(s: str) -> bool:
    try:
        result = urlparse(s)
        return result.scheme in ("http", "https")
    except Exception:
        return False


async def fetch_page_text(url: str, max_chars: int = 6000) -> str:
    """Fetch a URL and return visible text (HTML stripped)."""
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
            return stripper.get_text()[:max_chars]
        return resp.text[:max_chars]


CRITIC_PROMPT = """You are a senior recruiter and executive coach who reviews cold outreach messages for senior product leaders exploring career opportunities.

The sender wants to learn about the company and get a referral or warm intro. Evaluate whether this message would make a busy senior employee want to have that conversation.

Critically evaluate the message against the source material. Be specific and harsh — vague praise wastes iterations.

Assess:
1. **Specificity** – Does it use exact language, product names, or framing from the company or the person's profile? Or could it have been written without reading anything?
2. **Career intent clarity** – Does it naturally signal that the sender is exploring opportunities, without sounding desperate or formulaic?
3. **Personalisation** – If a LinkedIn profile was provided, does it speak to *that person's* role, tenure, or career path specifically?
4. **Ask quality** – Is the closing ask clear and easy to say yes to? Does it feel like a peer reaching out, not a candidate begging?
5. **Tone fit** – Does it sound like a peer conversation between two senior operators, or a job-seeker asking for a favour?
6. **Success probability** – On a scale of 1-10, how likely is a busy senior person to reply and offer a referral? Explain why.
7. **Character count** – Is it within 220 chars?

Then write a revised version that fixes every flaw you identified. The revised message must:
- Stay within 220 characters
- Not start with "I"
- Not sound like a cover letter or use buzzwords
- Open with specific language lifted directly from the source material
- Make the career exploration intent feel natural and mutual

Format your response EXACTLY as:
CRITIQUE:
<your critique>

SUCCESS_PROBABILITY: <1-10>

REVISED:
<the revised message, nothing else on this line>"""


def _get_llm(temperature: float = 0.7) -> ChatAnthropic:
    key = os.getenv("CLAUDE_API_KEY")
    if not key:
        raise ValueError("CLAUDE_API_KEY not set. Add it to .env.")
    return ChatAnthropic(model="claude-opus-4-6", temperature=temperature, max_tokens=1024, api_key=key)


def _parse_revised(critic_response: str) -> tuple[str, str, str]:
    """Extract critique, score, and revised message from critic output."""
    critique, score, revised = "", "?", ""
    for line in critic_response.splitlines():
        if line.startswith("CRITIQUE:"):
            critique = line[len("CRITIQUE:"):].strip()
        elif line.startswith("SUCCESS_PROBABILITY:"):
            score = line[len("SUCCESS_PROBABILITY:"):].strip()
        elif line.startswith("REVISED:"):
            revised = line[len("REVISED:"):].strip()
        elif critique and not score.replace("?","").isdigit() and not line.startswith("SUCCESS") and not line.startswith("REVISED"):
            critique += " " + line.strip()
    # Fallback: grab last non-empty line as revised if parsing failed
    if not revised:
        lines = [l.strip() for l in critic_response.splitlines() if l.strip()]
        revised = lines[-1] if lines else ""
    return critique.strip(), score.strip(), revised.strip()


async def generate_outreach(
    company_url: str,
    job_source: str,
    linkedin_text: str,
    iterations: int = 2,
) -> dict:
    """Return dict with keys: message, drafts (list of iteration dicts)."""
    # Fetch company website
    print(f"Fetching company website: {company_url} …")
    company_text = await fetch_page_text(company_url, max_chars=4000)

    # Fetch or use job description
    if is_url(job_source):
        print(f"Fetching job description: {job_source} …")
        job_text = await fetch_page_text(job_source, max_chars=4000)
    else:
        job_text = job_source.strip()

    source_block = f"""COMPANY WEBSITE (from {company_url}):
{company_text}

JOB DESCRIPTION:
{job_text}

MY RESUME (for context — do not mention it directly in the message):
{RESUME}
"""
    if linkedin_text.strip():
        source_block += f"\nTHE PERSON'S LINKEDIN PROFILE (posts, bio, experience):\n{linkedin_text.strip()}\n"

    user_content = source_block + "\nWrite the cold outreach message now. Remember: ~200 characters, career exploration framing (learning about the team, potential fit, referral), genuine and peer-to-peer."

    llm = _get_llm(temperature=0.8)
    critic_llm = _get_llm(temperature=0.4)

    # --- Draft 1 ---
    print("Generating draft 1 …")
    response = await llm.ainvoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ])
    current_message = response.content.strip()

    drafts = [{"round": 1, "message": current_message}]

    # --- Critique + revise loop ---
    for i in range(iterations):
        print(f"Critiquing and revising (round {i + 2}) …")
        critic_content = f"""{source_block}
CURRENT MESSAGE (draft {i + 1}, {len(current_message)} chars):
{current_message}

Evaluate and revise."""
        critic_response = await critic_llm.ainvoke([
            SystemMessage(content=CRITIC_PROMPT),
            HumanMessage(content=critic_content),
        ])
        raw = critic_response.content.strip()
        critique, score, revised = _parse_revised(raw)

        if revised and len(revised) <= 220:
            current_message = revised
        # Keep the best candidate even if parser missed REVISED: tag
        elif not revised:
            current_message = current_message  # keep previous

        drafts.append({
            "round": i + 2,
            "message": current_message,
            "critique": critique,
            "success_probability": score,
            "raw_critic": raw,
        })

    return {"message": current_message, "drafts": drafts}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Generate a ~200-character cold outreach message."
    )
    parser.add_argument(
        "company_url",
        help="URL of the company website (e.g. https://acme.com)",
    )
    parser.add_argument(
        "job",
        help="URL of the job description, OR paste the job description text directly",
    )
    parser.add_argument(
        "--linkedin",
        default="",
        metavar="TEXT",
        help="Copy-pasted LinkedIn profile text (bio, posts, experience)",
    )
    parser.add_argument(
        "--linkedin-file",
        default="",
        metavar="FILE",
        help="Path to a file containing the LinkedIn profile text",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=2,
        metavar="N",
        help="Number of critique-and-revise iterations after the first draft (default: 2)",
    )
    args = parser.parse_args()

    linkedin_text = args.linkedin
    # Auto-detect: if --linkedin value looks like a file path, read it
    if linkedin_text and Path(linkedin_text).exists():
        linkedin_text = Path(linkedin_text).read_text()
    if args.linkedin_file:
        lf = Path(args.linkedin_file)
        if not lf.exists():
            print(f"Error: LinkedIn file not found: {lf}", file=sys.stderr)
            sys.exit(1)
        linkedin_text = lf.read_text()

    company_url = args.company_url.strip()
    job_source = args.job.strip()

    try:
        result = asyncio.run(
            generate_outreach(
                company_url=company_url,
                job_source=job_source,
                linkedin_text=linkedin_text,
                iterations=args.iterations,
            )
        )

        # Print iteration trail
        final_score = "?"
        for draft in result["drafts"]:
            r = draft["round"]
            msg = draft["message"]
            print(f"\n{'─' * 60}")
            print(f"DRAFT {r}  ({len(msg)} chars)")
            print(msg)
            if "critique" in draft and draft["critique"]:
                print(f"\nCritique: {draft['critique']}")
            if "success_probability" in draft:
                final_score = draft["success_probability"]
                print(f"Success probability: {draft['success_probability']}/10")

        final = result["message"]
        print(f"\n{'=' * 60}")
        print("FINAL MESSAGE")
        print("=" * 60)
        print(final)
        print("=" * 60)
        print(f"Length: {len(final)} characters")

        job_url = job_source if job_source.startswith("http") else company_url
        log_activity(
            "cold-outreach",
            job_url,
            company_url,
            "success",
            f"len={len(final)},score={final_score}/10",
        )
    except Exception as e:
        job_url = job_source if job_source.startswith("http") else company_url
        log_activity("cold-outreach", job_url, company_url, "error", str(e))
        raise


if __name__ == "__main__":
    main()
