# Job Search Automation Suite

## Why this exists

Job searching is expensive — not in money, but in attention. Writing a tailored cover letter, filling in the same personal details on every ATS form, tracking which companies you've touched, and crafting a cold message to the right person at a company you're excited about: each task individually takes 10–30 minutes, and together they crowd out the things that actually move the needle — real conversations, networking, learning about the product, and showing up sharp in interviews.

This suite automates the repeatable, low-creativity parts of a job search so that time goes toward the irreversible, high-leverage parts:

- **Tracking applications** — every tool writes to a shared `activity.log` (CSV), so you always know what you've applied to, the AI's fit assessment, and a calibrated grade relative to other roles you've seen.
- **Automating the application** — cover letter generation + form filling reduces a 30-minute application to a 3-minute review. You still read the cover letter and submit manually; the machine handles the scaffolding.
- **Freeing time for networking and outreach** — the cold outreach generator produces a 200-character LinkedIn message that sounds like you wrote it, not a bot. With the repetitive work handled, you can reach out to 5× more people without burning out.

## Why it's built this way

Each tool is a **standalone module with explicit parameters**. You can run `cold_outreach.py` without ever touching the bot, use `cover_letter.py` without the job search scraper, and so on. This is intentional:

- **Composability over a monolith.** A single "do everything" script breaks in unpredictable ways. Separate modules fail loudly, are easier to debug, and let you swap out one piece without touching the others.
- **Parameters over hardcoded behaviour.** `--notes`, `--iterations`, `--company`, `--linkedin-file` — every tool exposes the knobs that matter for a given application. A cold message to a PM at a startup you know needs different context than one to a recruiter at a public company. The tool doesn't decide for you; it gives you control.
- **Human in the loop at every irreversible step.** The bot never auto-submits. The cold outreach tool prints every draft and critique for your review. The cover letter is saved to disk before the bot uses it. Automation handles the work; you make the judgment calls.

---

## Modules

### `cover_letter.py` — AI cover letter generator

Fetches the job description from a URL, then runs three Claude calls in sequence:
1. Write a crisp 3-paragraph cover letter tailored to the role.
2. Assess fit: what aligns, what gaps exist, overall impression.
3. Grade the opportunity 1–5, calibrated against the last 10 logged entries.

The letter is formatted into your `.docx` template preserving fonts and layout, and all three outputs are written to `activity.log`.

```bash
python3 cover_letter.py <job_url> [--notes "emphasize AI experience"] [--company "Acme"] [--output letter.docx]
```

### `cold_outreach.py` — LinkedIn cold message generator

Fetches the company website and job description, then runs a generate → critique → revise loop to produce a ~200-character message that reads like a peer-to-peer note, not a cover letter. Optionally personalises to a specific person's LinkedIn profile.

```bash
python3 cold_outreach.py <company_url> <job_url_or_text> [--linkedin "paste profile text"] [--linkedin-file person.txt] [--iterations 2]
```

Each draft and its critique are printed so you can pick the best version or copy-paste the final message directly.

### `job_search.py` — LLM-orchestrated career page scraper

Reads `config/companies.md` (target companies) and `config/criteria.md` (what you're looking for), then uses a LangGraph workflow to orchestrate a browser-use agent: the LLM assigns searches, the browser-use service runs them in parallel, and the LLM inspects results to decide if retries are needed. Outputs `jobs_report.csv` and `jobs_report.md`.

```bash
python3 job_search.py
```

Requires a `BROWSER_USE_API_KEY` in `.env` in addition to `CLAUDE_API_KEY`.

### `activity_logger.py` — shared audit log

Every tool calls `log_activity()` on success and failure. The log is a CSV at `../activity.log` with columns: `timestamp`, `tool`, `url`, `company`, `outcome`, `details`, `fit_summary`, `grade`. You can open it in a spreadsheet or query it with any CSV tool to see your full application history.

### `bot/` — Playwright form filler (TypeScript)

Opens a real browser, clicks the Apply button, fills every detected field from `data/profile.json`, uploads resume and cover letter, and takes screenshots at each step. Stops before submit. Handles Lever and Greenhouse natively; falls back to generic form detection elsewhere.

```bash
cd bot
npm run apply -- --url "https://jobs.lever.co/company/role-id"
```

---

## Technical choices and trade-offs

| Choice | Reason | Trade-off |
|---|---|---|
| **Python + `langchain_anthropic`** | Claude API is the core value; langchain gives structured output and async support without boilerplate. | Adds a dependency over raw `httpx` + `anthropic` SDK. Acceptable since the abstraction is thin. |
| **LangGraph for `job_search.py`** | The orchestrator–worker loop with conditional retries maps naturally to a state graph. Nodes are composable and the retry logic stays declarative. | Heavier dependency for a workflow that could be a while loop. Worth it for the state management and future extensibility. |
| **TypeScript for the bot** | DOM manipulation and Playwright's API have better IDE support and type safety in TypeScript. The bot interacts with unpredictable HTML; type errors are caught before runtime. | Requires Node.js + a separate install step. Python would have been more consistent with the rest of the suite. |
| **Word template (`.docx` via `python-docx`)** | Preserves exact formatting — fonts, margins, header, footer — that a PDF renderer or Markdown→PDF pipeline would lose or require CSS to recreate. | Fragile: paragraph index manipulation means template structure must stay stable. Documented in the code. |
| **Critique-and-revise loop in `cold_outreach.py`** | A single LLM pass produces generic output. A second call with a critic prompt and the source material forces specificity. Two iterations (configurable) improve quality measurably. | Each iteration is one extra API call. Default of 2 iterations costs ~3× the single-pass price. Set `--iterations 0` to skip if cost matters. |
| **Parallel `asyncio.gather` in `job_search.py`** | Searching 10 companies sequentially would take 10× longer. Parallel calls reduce wall-clock time to roughly the slowest single call. | Higher burst API usage. If the browser-use service rate-limits, errors surface together rather than one at a time. |
| **CSV for `activity.log`** | Zero infrastructure: no database, no schema migrations, works offline. Queryable with Excel, `csvkit`, `pandas`, or `grep`. | No deduplication: the same URL can appear multiple times if you re-run a tool. Treat it as an append-only log. |
| **`CLAUDE_API_KEY` not `ANTHROPIC_API_KEY`** | Historical naming in this repo. The value is a standard Anthropic API key — same key, different env var name. | If you use other Anthropic tooling in the same shell, you may need to export both names. |

---

## Project structure

```
~/dev/jobsearch/
├── apply.sh                     # One-command application workflow
├── jobsearch/
│   ├── cover_letter.py          # Cover letter generator + fit assessment + grading
│   ├── cold_outreach.py         # LinkedIn cold message generator
│   ├── job_search.py            # LLM-orchestrated career page scraper
│   ├── activity_logger.py       # Shared CSV audit log
│   ├── config/
│   │   ├── companies.md         # Target companies for job_search.py
│   │   ├── criteria.md          # Job criteria for job_search.py
│   │   └── template/
│   │       └── Bilel_BOURAOUI_Cover_Letter.docx
│   └── output/                  # Generated cover letters
├── bot/
│   ├── src/                     # Playwright form filler (TypeScript)
│   └── data/
│       ├── profile.json         # Your personal info
│       ├── resume.pdf           # Your resume
│       └── cover-letter.docx    # Auto-generated by apply.sh
└── activity.log                 # Shared audit log (auto-created)
```

---

## Quick start (all-in-one application)

```bash
cd ~/dev/jobsearch

# Generate cover letter + fill application form
./apply.sh "https://jobs.lever.co/clickup/role" "emphasize AI experience"
```

What it does:
1. Generates a custom cover letter (AI, formatted .docx)
2. Copies it to `bot/data/cover-letter.docx`
3. Opens a browser and fills the entire application
4. Uploads resume + cover letter
5. **Stops before submit** — you review and click manually

---

## Setup (first time)

### 1. Python dependencies
```bash
cd ~/dev/jobsearch/jobsearch
pip3 install python-docx langchain-anthropic langchain-core httpx python-dotenv langgraph --break-system-packages
```

### 2. Node.js dependencies
```bash
cd ~/dev/jobsearch/bot
npm install
npx playwright install chromium
```

### 3. API keys
```bash
# Claude API key (required by all Python tools)
echo "CLAUDE_API_KEY=sk-ant-..." > ~/dev/jobsearch/jobsearch/.env

# Browser-use API key (required only by job_search.py)
echo "BROWSER_USE_API_KEY=your_key" >> ~/dev/jobsearch/jobsearch/.env
```

### 4. Profile and resume

The bot reads personal data from `bot/data/` — this directory is gitignored to keep your information out of version control. Template files in the same directory show the expected structure.

```bash
cd ~/dev/jobsearch/jobsearch/bot/data

# Copy templates to their live names
cp profile.template.json profile.json
cp responses.template.json responses.json

# Edit with your real information
nano profile.json
nano responses.json

# Add your resume (PDF)
cp ~/path/to/your/resume.pdf resume.pdf
```

See the [Configuration](#configuration) section below for a field-by-field reference.

---

## Configuration

All personal data lives in `bot/data/`. This directory is gitignored — your information never enters version control. Template files (tracked in git) document the expected format.

### `bot/data/profile.json`

Created from `profile.template.json`. Fields used by the form-filler bot:

| Field | Description |
|---|---|
| `personalInfo.firstName` / `lastName` | Your name as it appears on applications |
| `personalInfo.email` | Primary application email |
| `personalInfo.phone` | Phone number in `+1-555-000-0000` format |
| `personalInfo.linkedin` | Full LinkedIn profile URL |
| `personalInfo.github` | GitHub profile URL (optional) |
| `location.address` | Full street address for address fields |
| `work.currentTitle` | Your current or most recent job title |
| `work.currentCompany` | Your current or most recent employer |
| `work.yearsExperience` | Total years of professional experience |
| `work.resumePath` | **Absolute path** to your `resume.pdf` |
| `work.coverLetterPath` | **Absolute path** to your `cover-letter.docx` |
| `preferences.workAuthorization` | e.g. `"US Citizen"`, `"H1B"`, `"Require Sponsorship"` |
| `preferences.remotePreference` | `"remote"`, `"hybrid"`, or `"onsite"` |
| `preferences.requiresVisaSponsorship` | `true` / `false` |

```bash
cp bot/data/profile.template.json bot/data/profile.json
nano bot/data/profile.json
```

### `bot/data/responses.json`

Created from `responses.template.json`. Answers pre-filled into common application questions:

| Field | Description |
|---|---|
| `salaryExpectation` | Salary range string shown in compensation fields |
| `availableStartDate` | e.g. `"2 weeks notice"`, `"Immediately"` |
| `referralSource` | How you heard about the role (e.g. `"LinkedIn"`) |
| `veteranStatus` | Standard EEO veteran status answer |
| `disability` / `gender` / `race` | EEO fields — set to `"Prefer not to say"` to skip disclosure |

```bash
cp bot/data/responses.template.json bot/data/responses.json
nano bot/data/responses.json
```

### `bot/data/resume.pdf`

Copy your resume PDF here:

```bash
cp ~/path/to/your/resume.pdf bot/data/resume.pdf
```

The bot uploads this file to resume upload fields automatically.

### `bot/data/cover-letter.docx`

Generated automatically by `apply.sh` / `cover_letter.py` — you don't create this manually. It gets overwritten each time you generate a new cover letter.

### Cold outreach LinkedIn profiles

When personalising a cold message to a specific person, paste their LinkedIn profile text into a `.txt` file in `bot/data/` and reference it with `--linkedin-file`:

```bash
# Paste profile text from the browser
nano bot/data/john_doe.txt

python3 cold_outreach.py <company_url> <job_url> --linkedin-file bot/data/john_doe.txt
```

See `bot/data/linkedin.template.txt` for instructions on how to copy a profile from LinkedIn.

---

## Usage

### Cover letter

```bash
cd jobsearch

# Company name auto-extracted from the URL
python3 cover_letter.py "https://boards.greenhouse.io/stripe/jobs/123"

# With targeting notes and manual company override
python3 cover_letter.py "https://jobs.lever.co/openai/role" \
  --notes "emphasize LLM product work" \
  --company "OpenAI"
```

Output: `output/Cover_Letter_CompanyName_TIMESTAMP.docx`
Also prints: fit assessment and grade (1–5) relative to other roles you've logged.

### Cold outreach

```bash
cd jobsearch

# Minimal — fetches company and job pages automatically
python3 cold_outreach.py "https://acme.com" "https://jobs.lever.co/acme/pm-role"

# Personalised to a specific person
python3 cold_outreach.py "https://acme.com" "https://jobs.lever.co/acme/pm-role" \
  --linkedin-file people/john_doe.txt

# Fewer API calls (faster, cheaper)
python3 cold_outreach.py "https://acme.com" "https://jobs.lever.co/acme/pm-role" \
  --iterations 1
```

Prints each draft with critique and success probability. Copy the final message from the `FINAL MESSAGE` block.

### Job search scraper

Edit `config/companies.md` with target companies (one per line or as a list) and `config/criteria.md` with what you're looking for (title, seniority, remote preference, etc.), then run:

```bash
cd jobsearch
python3 job_search.py
```

Output: `jobs_report.csv` and `jobs_report.md` with matching job URLs and descriptions.

### Application form filler (bot only)

```bash
cd bot
npm run apply -- --url "https://jobs.lever.co/company/role-id"
```

Requires `data/cover-letter.docx` to already exist (generated by `cover_letter.py` or `apply.sh`).

---

## Customisation

### Profile (bot)
```bash
nano ~/dev/jobsearch/jobsearch/bot/data/profile.json
```

Key fields: `personalInfo` (name, email, phone, LinkedIn), `work.resumePath`, `preferences.remotePreference`. See the [Configuration](#configuration) section for all fields.

### Cover letter template
```bash
libreoffice ~/dev/jobsearch/jobsearch/config/template/Bilel_BOURAOUI_Cover_Letter.docx
```

The script replaces the body paragraphs but keeps the header, footer, fonts, and margins from the template.

### Resume content
The resume is embedded as a string constant in both `cover_letter.py` and `cold_outreach.py`. Edit the `RESUME` constant directly in each file.

### Target companies and criteria
```bash
nano ~/dev/jobsearch/jobsearch/config/companies.md
nano ~/dev/jobsearch/jobsearch/config/criteria.md
```

---

## Supported platforms (bot)

- **Lever** — `jobs.lever.co`
- **Greenhouse** — `boards.greenhouse.io`
- **Generic** — best-effort on any other form

---

## Safety

- Never auto-submits applications
- Visible browser — you see exactly what's happening
- Screenshot audit trail saved to `bot/screenshots/`
- API key stored locally only (`.env`, gitignored)
- No data sent to external services except the Claude API for AI calls

---

## Troubleshooting

**`CLAUDE_API_KEY not set`**
```bash
echo "CLAUDE_API_KEY=sk-ant-..." > ~/dev/jobsearch/jobsearch/.env
```

**`Template not found`**
```bash
ls ~/dev/jobsearch/jobsearch/config/template/
# If missing, restore from git or ask for the file
```

**`Resume not found`**
```bash
cp ~/path/to/resume.pdf ~/dev/jobsearch/bot/data/resume.pdf
```

**Browser doesn't open**
```bash
cd ~/dev/jobsearch/bot
npx playwright install chromium
```

**`job_search.py` — no jobs collected**

Check that `BROWSER_USE_API_KEY` is set in `.env` and the browser-use service is reachable. See `job_search.log` for full error traces.

**Cold outreach message too long**

The critic enforces a 220-character hard limit. If the final message exceeds it, run with `--iterations 3` to give the critic more passes.

---

## Workflow diagram

```
Job URL
   ↓
[cover_letter.py]
   ↓ fetches JD → generates letter + fit assessment + grade
   ↓ saves .docx to output/
   ↓ logs to activity.log
   ↓
[apply.sh] copies .docx → bot/data/cover-letter.docx
   ↓
[bot: npm run apply]
   ↓ opens browser
   ↓ clicks Apply
   ↓ fills all fields
   ↓ uploads resume + cover letter
   ↓ takes screenshots
   ↓ STOPS — you review
   ↓
You submit manually


Separately:

[cold_outreach.py]
   ↓ fetches company site + JD
   ↓ draft → critique → revise (N iterations)
   ↓ prints final message + all drafts
   ↓ logs to activity.log
   ↓
You copy-paste to LinkedIn


[job_search.py]
   ↓ reads companies.md + criteria.md
   ↓ LLM orchestrator assigns parallel browser-use tasks
   ↓ collects matching jobs → retries if needed
   ↓ writes jobs_report.csv / jobs_report.md
```
