# Directory Restructure Design

**Date:** 2026-04-01  
**Approach:** C2 — Clean root (flat but clean)

---

## Goal

Reduce root-level clutter so the project is immediately navigable. Keep Python entry points visible at root. Move everything else into purpose-named folders.

---

## Current Problems

- 18+ files at root mixing source code, docs, config, SSH keys, and generated output
- `job-application/` sounds like data storage, not bot source code
- `test_web_use.py` lives at root instead of `tests/`
- `template/` and `companies.md`/`criteria.md` have no clear home
- SSH keys (`Intuit`, `Intuit.pub`) committed at root
- Generated logs and reports (`*.log`, `jobs_report.*`) tracked in git

---

## Target Structure

```
/                                   # entry points only
├── apply.sh                        # main orchestrator
├── cover_letter.py                 # cover letter generator
├── job_search.py                   # job search automation
├── cold_outreach.py                # cold message generator
├── activity_logger.py              # shared logging utility
├── README.md
├── requirements.txt
├── .env
├── .gitignore
│
├── config/                         # static configuration
│   ├── companies.md                # target companies list
│   ├── criteria.md                 # job filtering rules
│   └── template/
│       └── Bilel_BOURAOUI_Cover_Letter.docx
│
├── docs/                           # all documentation
│   ├── ARCHITECTURE.md
│   ├── ADVANCED-FEATURES.md
│   ├── AI_ANSWERING.md
│   ├── EEO-HANDLING.md
│   ├── FILE-UPLOAD-GUIDE.md
│   ├── CHROME-SETUP.md
│   └── superpowers/specs/
│
├── tests/                          # all tests
│   ├── __init__.py
│   ├── test_activity_logger.py
│   ├── test_cover_letter_fit.py
│   └── test_web_use.py             # moved from root
│
├── output/                         # generated cover letters (gitignored)
│
└── bot/                            # browser automation (renamed from job-application/)
    ├── src/                        # TypeScript source (unchanged internally)
    ├── data/                       # profile.json, responses.json, resume.pdf, cover-letter.docx
    ├── screenshots/                # audit trail (gitignored)
    ├── applications/               # application records (gitignored)
    ├── browseruse_agent_data/      # moved from root
    ├── package.json
    ├── tsconfig.json
    └── .env
```

---

## Files Deleted

- `Intuit` — SSH private key, should never be in the repo
- `Intuit.pub` — SSH public key, should never be in the repo

---

## Gitignore Additions

```
job_search.log
activity.log
jobs_report.csv
jobs_report.md
output/
bot/screenshots/
bot/applications/
```

---

## Required Source Changes

| File | Change |
|------|--------|
| `apply.sh` | `job-application/` → `bot/` |
| `cover_letter.py` | `template/` path → `config/template/` |
| `job_search.py` | `companies.md` → `config/companies.md`, `criteria.md` → `config/criteria.md` |

---

## What Does NOT Change

- All Python file names stay exactly as-is
- `bot/src/` internal structure is untouched
- `bot/data/` contents are untouched
- `run.sh`, `setup_venv.sh` stay at root
- All test file names stay as-is
