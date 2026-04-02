# 🤖 Job Application Bot

Semi-automated job application filler using Playwright. Handles 80% of the tedious form filling while keeping you in control.

## Features

- ✅ Auto-fills common fields (name, email, phone, LinkedIn, etc.)
- ✅ Uploads resume automatically
- ✅ **Generates custom cover letters** using AI (via cover_letter.py)
- ✅ Platform-specific handlers for Lever, Greenhouse, and generic forms
- ✅ Screenshots every step for audit trail
- ✅ **Stops before submit** - you always review and click submit manually
- ✅ Human-like delays to avoid bot detection
- ✅ Visible browser (headed mode) so you see exactly what's happening

## Setup

1. **Install dependencies:**
   ```bash
   cd ~/dev/jobsearch/bot
   npm install
   ```

2. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```

3. **Set up Python dependencies (for cover letter generation):**
   ```bash
   cd ~/dev/jobsearch/jobsearch
   pip3 install python-docx langchain-anthropic httpx --break-system-packages
   ```

4. **Add your API key:**
   ```bash
   # Create .env file in ~/dev/jobsearch/jobsearch/
   echo "CLAUDE_API_KEY=your_key_here" > ~/dev/jobsearch/jobsearch/.env
   ```

5. **Create your data files:**
   ```bash
   npm run setup
   ```

   This creates:
   - `data/profile.json` - Your personal info
   - `data/responses.json` - Answers to common questions

6. **Edit the files with your real information:**
   ```bash
   # Edit profile
   nano data/profile.json
   
   # Add your resume
   cp ~/path/to/your/resume.pdf data/resume.pdf
   ```

## Usage

### Generate Cover Letter (Stand-alone)

```bash
cd ~/dev/jobsearch/jobsearch
python3 cover_letter.py <job_url> --company "Company Name" --notes "emphasize AI experience"
```

Output: `~/dev/jobsearch/output/Cover_Letter_CompanyName_TIMESTAMP.docx`

### Fill a Job Application (with auto-generated cover letter)

```bash
npm run apply -- --url "https://jobs.lever.co/company/role-id"
```

What happens:
1. Generates a custom cover letter for the job (saved to `data/cover-letter.docx`)
2. Opens the job application in a visible browser
3. Auto-fills all detected fields
4. Uploads your resume + cover letter
5. Takes screenshots at each step
6. **Stops and leaves browser open** for you to review
7. You manually review the form and click submit
8. Press Ctrl+C when done

### Supported Platforms

- **Lever** (`jobs.lever.co`)
- **Greenhouse** (`boards.greenhouse.io`)
- **Generic forms** (fallback for any other platform)

More platforms coming soon (Workday, Ashby, BambooHR).

## File Structure

```
~/dev/jobsearch/
├── bot/                          # Browser automation bot
│   ├── src/
│   │   ├── cli.ts
│   │   ├── filler.ts
│   │   └── platforms/
│   ├── data/
│   │   ├── profile.json
│   │   ├── responses.json
│   │   ├── resume.pdf
│   │   └── cover-letter.docx    # Auto-generated
│   ├── applications/            # Saved states
│   └── screenshots/             # Progress screenshots
├── jobsearch/                   # Cover letter generator
│   └── cover_letter.py
├── template/                    # .docx template
│   └── Bilel_BOURAOUI_Cover_Letter.docx
└── output/                      # Generated cover letters
```

## Example: profile.json

```json
{
  "personalInfo": {
    "firstName": "Bilel",
    "lastName": "Buraway",
    "email": "bilel@example.com",
    "phone": "+1-555-123-4567",
    "linkedin": "https://linkedin.com/in/bilelburaway",
    "portfolio": "https://yourportfolio.com",
    "github": "https://github.com/yourusername"
  },
  "location": {
    "city": "San Francisco",
    "state": "CA",
    "country": "USA"
  },
  "work": {
    "currentTitle": "Principal Product Manager",
    "yearsExperience": 10,
    "resumePath": "./data/resume.pdf"
  },
  "preferences": {
    "workAuthorization": "US Citizen",
    "willingToRelocate": false,
    "remotePreference": "remote"
  }
}
```

## Tips

- **Run in headed mode:** You'll see exactly what the bot is doing
- **Review before submitting:** The bot NEVER auto-submits - always review
- **Check screenshots:** Saved to `screenshots/` folder for audit trail
- **Customize responses:** Edit `data/responses.json` for each company/role
- **Cover letters:** Auto-generated using Claude, formatted with your template

## Troubleshooting

**"Profile not found"**
- Run `npm run setup` first
- Make sure you're in the right directory

**"Resume upload failed"**
- Check that `data/resume.pdf` exists
- Update `resumePath` in `data/profile.json`

**"Cover letter generation failed"**
- Check `CLAUDE_API_KEY` in `~/dev/jobsearch/jobsearch/.env`
- Make sure template exists: `~/dev/jobsearch/config/template/Bilel_BOURAOUI_Cover_Letter.docx`

**Browser doesn't open**
- Make sure Playwright is installed: `npx playwright install chromium`

## Workflow

**Recommended flow for each job:**

1. Find a job posting URL
2. Generate cover letter first (review it):
   ```bash
   cd ~/dev/jobsearch/jobsearch
   python3 cover_letter.py <url> --company "CompanyName"
   ```
3. Copy the generated `.docx` to `~/dev/jobsearch/bot/data/cover-letter.docx`
4. Run the application filler:
   ```bash
   cd ~/dev/jobsearch/bot
   npm run apply -- --url <url>
   ```
5. Review + submit manually

---

Built to help Bilel find new opportunities faster. Good luck! 🍀
