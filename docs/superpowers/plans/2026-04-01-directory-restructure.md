# Directory Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the root of the `jobsearch/` repo so only Python entry points and config live at root — docs go to `docs/`, config/template go to `config/`, tests stay in `tests/`, and the bot is renamed from `job-application/` to `bot/`.

**Architecture:** Pure file moves + targeted path updates in three source files (`cover_letter.py`, `job_search.py`, `apply.sh`). No logic changes. Existing tests verify nothing is broken after each step.

**Tech Stack:** Python 3, Bash, git mv

---

## File Map

| Action | From | To |
|--------|------|----|
| delete | `Intuit` | — |
| delete | `Intuit.pub` | — |
| git mv | `ADVANCED-FEATURES.md` | `docs/ADVANCED-FEATURES.md` |
| git mv | `AI_ANSWERING.md` | `docs/AI_ANSWERING.md` |
| git mv | `ARCHITECTURE.md` | `docs/ARCHITECTURE.md` |
| git mv | `CHROME-SETUP.md` | `docs/CHROME-SETUP.md` |
| git mv | `EEO-HANDLING.md` | `docs/EEO-HANDLING.md` |
| git mv | `FILE-UPLOAD-GUIDE.md` | `docs/FILE-UPLOAD-GUIDE.md` |
| git mv | `companies.md` | `config/companies.md` |
| git mv | `criteria.md` | `config/criteria.md` |
| git mv | `template/` | `config/template/` |
| git mv | `test_web_use.py` | `tests/test_web_use.py` |
| git mv | `job-application/` | `bot/` |
| git mv | `browseruse_agent_data/` | `bot/browseruse_agent_data/` |
| edit | `cover_letter.py:42-43` | fix `SCRIPT_DIR.parent` → `SCRIPT_DIR` + new `config/template` path |
| edit | `job_search.py:367-368` | `companies.md` → `config/companies.md`, `criteria.md` → `config/criteria.md` |
| edit | `apply.sh:28` | `job-application` → `bot` |
| edit | `.gitignore` | update `job-application/` → `bot/`, add `bot/browseruse_agent_data/` |

---

### Task 1: Delete SSH keys

**Files:**
- Delete: `Intuit`
- Delete: `Intuit.pub`

- [ ] **Step 1: Remove the files from git and disk**

```bash
git rm Intuit Intuit.pub
```

Expected output:
```
rm 'Intuit'
rm 'Intuit.pub'
```

- [ ] **Step 2: Commit**

```bash
git commit -m "security: remove SSH keys from repo"
```

---

### Task 2: Move markdown docs to `docs/`

**Files:**
- git mv: `ADVANCED-FEATURES.md`, `AI_ANSWERING.md`, `ARCHITECTURE.md`, `CHROME-SETUP.md`, `EEO-HANDLING.md`, `FILE-UPLOAD-GUIDE.md` → `docs/`

Note: `docs/` already exists (contains `superpowers/specs/`).

- [ ] **Step 1: Move all markdown guides**

```bash
git mv ADVANCED-FEATURES.md docs/ADVANCED-FEATURES.md
git mv AI_ANSWERING.md docs/AI_ANSWERING.md
git mv ARCHITECTURE.md docs/ARCHITECTURE.md
git mv CHROME-SETUP.md docs/CHROME-SETUP.md
git mv EEO-HANDLING.md docs/EEO-HANDLING.md
git mv FILE-UPLOAD-GUIDE.md docs/FILE-UPLOAD-GUIDE.md
```

- [ ] **Step 2: Verify root only has expected files**

```bash
ls *.md
```

Expected: only `README.md` remains at root.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: move markdown guides into docs/"
```

---

### Task 3: Move config files and template to `config/`

**Files:**
- Create: `config/`
- git mv: `companies.md` → `config/companies.md`
- git mv: `criteria.md` → `config/criteria.md`
- git mv: `template/` → `config/template/`
- Edit: `job_search.py:367-368`
- Edit: `cover_letter.py:42-43`

- [ ] **Step 1: Create `config/` and move files**

```bash
mkdir -p config
git mv companies.md config/companies.md
git mv criteria.md config/criteria.md
git mv template config/template
```

- [ ] **Step 2: Update `job_search.py` paths (lines 367–368)**

Open `job_search.py`. Find:

```python
    companies_path = base / "companies.md"
    criteria_path = base / "criteria.md"
```

Replace with:

```python
    companies_path = base / "config" / "companies.md"
    criteria_path = base / "config" / "criteria.md"
```

- [ ] **Step 3: Update `cover_letter.py` paths (lines 42–43)**

Open `cover_letter.py`. Find:

```python
TEMPLATE_PATH = SCRIPT_DIR.parent / "template" / "Bilel_BOURAOUI_Cover_Letter.docx"
OUTPUT_DIR = SCRIPT_DIR.parent / "output"
```

Replace with:

```python
TEMPLATE_PATH = SCRIPT_DIR / "config" / "template" / "Bilel_BOURAOUI_Cover_Letter.docx"
OUTPUT_DIR = SCRIPT_DIR / "output"
```

- [ ] **Step 4: Run tests to verify nothing is broken**

```bash
python -m pytest tests/test_cover_letter_fit.py tests/test_activity_logger.py -v
```

Expected: all tests pass (tests mock the LLM, so no API calls needed).

- [ ] **Step 5: Commit**

```bash
git add cover_letter.py job_search.py
git commit -m "refactor: move config and template into config/, update paths"
```

---

### Task 4: Move `test_web_use.py` into `tests/`

**Files:**
- git mv: `test_web_use.py` → `tests/test_web_use.py`

- [ ] **Step 1: Move the file**

```bash
git mv test_web_use.py tests/test_web_use.py
```

- [ ] **Step 2: Verify tests still discoverable**

```bash
python -m pytest tests/ --collect-only 2>&1 | grep "test session\|test_web_use\|ERROR"
```

Expected: `test_web_use.py` appears in collected tests, no errors.

- [ ] **Step 3: Commit**

```bash
git commit -m "test: move test_web_use.py into tests/"
```

---

### Task 5: Rename `job-application/` to `bot/` and absorb `browseruse_agent_data/`

**Files:**
- git mv: `job-application/` → `bot/`
- git mv: `browseruse_agent_data/` → `bot/browseruse_agent_data/`
- Edit: `apply.sh:28`
- Edit: `.gitignore`

- [ ] **Step 1: Rename the bot directory**

```bash
git mv job-application bot
```

- [ ] **Step 2: Move `browseruse_agent_data/` inside `bot/`**

```bash
git mv browseruse_agent_data bot/browseruse_agent_data
```

- [ ] **Step 3: Update `apply.sh` line 28**

Open `apply.sh`. Find:

```bash
APP_BOT_DIR="$SCRIPT_DIR/job-application"
```

Replace with:

```bash
APP_BOT_DIR="$SCRIPT_DIR/bot"
```

- [ ] **Step 4: Update `.gitignore`**

Open `.gitignore`. Find:

```
# Browser automation
screenshots/
browseruse_agent_data/

# Personal & sensitive data
data/resume.pdf
data/cover-letter.docx
data/profile.json
data/linkedin.txt
data/responses.json
job-application/applications/
template/*.docx
```

Replace with:

```
# Browser automation
bot/screenshots/
bot/browseruse_agent_data/

# Personal & sensitive data
bot/data/resume.pdf
bot/data/cover-letter.docx
bot/data/profile.json
bot/data/linkedin.txt
bot/data/responses.json
bot/applications/
config/template/*.docx
```

- [ ] **Step 5: Stage and commit**

```bash
git add apply.sh .gitignore
git commit -m "refactor: rename job-application to bot, move browseruse_agent_data inside"
```

---

### Task 6: Final verification

- [ ] **Step 1: Confirm root is clean**

```bash
ls /home/bilelburaway/dev/jobsearch/jobsearch/
```

Expected root contents:
```
activity_logger.py
apply.sh
cold_outreach.py
config/
cover_letter.py
docs/
job_search.py
output/        (gitignored, may or may not exist)
README.md
requirements.txt
run.sh
setup_venv.sh
tests/
bot/
.env
.gitignore
```

- [ ] **Step 2: Run full test suite**

```bash
python -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 3: Confirm no stale references to old paths**

```bash
grep -r "job-application\|/template\b" --include="*.py" --include="*.sh" --include="*.md" .
```

Expected: no matches (or only matches inside `docs/` where old paths are documented historically).

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git status
# only commit if there are unstaged changes
```
