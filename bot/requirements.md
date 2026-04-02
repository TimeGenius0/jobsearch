# Job Application Bot - Requirements

## Goal
Build a semi-automated job application system that handles 80% of the tedious work while keeping human oversight.

## Tech Stack
- **Playwright** (cross-browser automation, handles modern SPAs)
- **Node.js/TypeScript**
- **JSON data templates** (user info, resume path, cover letter templates)

## Core Features

### 1. Data Management
- `data/profile.json` - User's personal info (name, email, phone, LinkedIn, etc.)
- `data/resume.pdf` - Resume file
- `data/cover-letter-template.md` - Template with placeholders like {{company}}, {{role}}
- `data/responses.json` - Answers to common questions ("Why do you want to work here?", "Salary expectations", etc.)

### 2. Application Filler (`src/filler.ts`)
Takes a job URL and:
- Opens the page
- Detects form fields (name, email, phone, resume upload, etc.)
- Fills in data from profile.json
- Handles file uploads (resume, cover letter)
- Takes screenshots at each step (`screenshots/[company]-[timestamp].png`)
- **STOPS before final submit** - waits for user confirmation

### 3. Question Scraper (`src/scraper.ts`)
- Fetches a job posting URL
- Extracts company name, role title, custom questions
- Saves to `applications/[company]-[date].json`
- Useful for pre-filling answers before running filler

### 4. CLI Interface (`src/cli.ts`)
```bash
# Scrape job posting to see what questions they ask
npm run scrape -- --url "https://jobs.lever.co/company/role"

# Fill application (stops before submit)
npm run apply -- --url "https://jobs.lever.co/company/role"

# Resume from last screenshot (if you need to retry)
npm run apply -- --resume applications/company-2026-03-26.json
```

### 5. Smart Form Detection
Support common platforms:
- Lever
- Greenhouse
- Workday (notoriously awful)
- Ashby
- BambooHR
- Generic HTML forms

Each gets a platform-specific handler that knows:
- Where the submit button is
- How to handle multi-step forms
- How to detect "Apply with LinkedIn" shortcuts

## Non-Goals (for v1)
- ❌ Auto-submitting (always require human review)
- ❌ Captcha solving (user handles these)
- ❌ Login automation for job boards (user logs in manually first)
- ❌ Cover letter AI generation (use templates + manual tweaks)

## Directory Structure
```
bot/
├── src/
│   ├── cli.ts           # Command-line interface
│   ├── filler.ts        # Main form filler
│   ├── scraper.ts       # Job posting scraper
│   ├── platforms/       # Platform-specific handlers
│   │   ├── lever.ts
│   │   ├── greenhouse.ts
│   │   ├── workday.ts
│   │   └── generic.ts
│   └── utils.ts         # Helpers (template rendering, etc.)
├── data/
│   ├── profile.json     # User data
│   ├── resume.pdf
│   ├── cover-letter-template.md
│   └── responses.json   # Common question answers
├── applications/        # Saved application states
├── screenshots/         # Progress screenshots
├── package.json
└── README.md            # Setup + usage guide
```

## User Experience
1. User finds a job posting
2. Runs: `npm run scrape -- --url "..."`  (sees what questions the form asks)
3. Optionally updates responses.json with custom answers
4. Runs: `npm run apply -- --url "..."`
5. Bot fills everything, takes screenshots
6. Browser stays open at final review screen
7. User reviews, clicks submit manually

## Success Metrics
- Reduces application time from 15 min → 3 min per job
- Supports 80% of common job boards
- Never submits without human review
- Creates audit trail (screenshots, saved state)

## Build Instructions for Agent
1. Initialize npm project with TypeScript + Playwright
2. Create directory structure
3. Build filler.ts with screenshot capability
4. Add platform detection logic
5. Create sample data templates
6. Write README with setup instructions
7. Test on a real job posting (user will provide URL)

**Important:** Use `--headed` mode (visible browser) so user can see what's happening. Add delays between actions to look human-like (avoid bot detection).
