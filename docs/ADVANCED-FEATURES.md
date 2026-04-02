# 🚀 Advanced Features

## Multi-Page Form Support

The bot now automatically handles complex multi-page applications!

### What it detects:
- ✅ "Next" / "Continue" / "Save and Continue" buttons
- ✅ Multi-step wizards (up to 10 pages)
- ✅ Progress indicators
- ✅ Dynamic form fields that appear after clicking Next

### How it works:
1. Fills all visible fields on page 1
2. Takes screenshot
3. Clicks "Next" button
4. Repeats for each page
5. Stops when no more "Next" buttons found

**Example platforms:**
- Workday (notorious for multi-page forms)
- iCIMS
- Oracle Taleo
- Custom corporate portals

---

## Account Creation Support

Automatically creates accounts when required!

### Detects account creation pages by:
- Headings: "Create an account", "Sign up", "Register"
- Password confirmation fields
- "Choose a password" labels

### Auto-fills:
- ✅ Email address (from profile.json)
- ✅ First name / Last name
- ✅ Password (auto-generated: `TempPass123!`)
- ✅ Password confirmation

### Password management:
- Default password: `TempPass123!`
- Displayed in console after creation
- **Save it!** You'll need it to check application status later

**TODO:** Make password configurable in profile.json

---

## Email Verification ✅

**FULLY IMPLEMENTED!** The bot now handles email verification automatically.

### How it works:
1. ✅ Detects "verify your email" pages
2. ✅ Opens Gmail in new browser tab (assumes you're already logged in)
3. ✅ Auto-fetches verification code from email
4. ✅ Enters code in application form
5. ✅ Continues application flow

### Supported patterns:
- ✅ 4-digit codes: `1234`
- ✅ 6-digit codes: `123456`
- ✅ Alphanumeric codes: `ABC123`, `XYZ789`
- ✅ Common email patterns: "Your code is 123456", "Verification code: ABC123"

### What you need:
- Gmail account already logged in (in your default browser profile)
- Or manually log in when the Gmail tab opens (bot waits 30 seconds)

### Console output:
```
📧 Email verification page detected!
📧 Opening Gmail in new tab (assuming active session)...
✅ Gmail inbox loaded
📧 Checking Gmail for verification email from Company Name...
   (Will check every 5 seconds for up to 120 seconds)
   Check #1...
   Check #2...
   ✅ Found verification code: 123456
🔑 Entering verification code: 123456
✅ Verification code submitted
```

### Fallback:
If auto-retrieval fails:
```
⚠️  Could not auto-retrieve verification code
   Please check the Gmail tab and enter the code manually
   Press Enter in this terminal when done...
```

Just enter the code yourself and press Enter to continue!

---

## Page Screenshots

Every step is documented:

```
screenshots/
├── company-01-initial.png          # Landing page
├── company-account-created.png     # After creating account
├── company-page-1-filled.png       # First form page
├── company-page-2-filled.png       # Second form page (if multi-page)
├── company-page-3-filled.png       # Third page...
└── company-final.png               # Final review screen
```

Use these to:
- Verify what was filled
- Debug issues
- Keep audit trail

---

## Platform-Specific Handling

### Currently supported:
- **Lever** - jobs.lever.co
- **Greenhouse** - boards.greenhouse.io  
- **Generic** - Fallback for any other platform

### Coming soon:
- **Workday** - Multi-page wizard specialist
- **iCIMS** - Account creation + multi-page
- **Ashby** - Modern ATS
- **BambooHR** - Simple forms
- **Rippling ATS** - (like the Peach Finance application)

---

## Safety Features

### Never auto-submits:
- Always stops before final "Submit" button
- Leaves browser open for your review
- You control when to click submit

### Timeout handling:
- Gracefully handles slow-loading pages
- Falls back to DOM-ready if network stays busy
- Won't get stuck on analytics/tracking scripts

### Error recovery:
- Screenshots every step for debugging
- Saves state to JSON
- Continues filling even if one field fails

---

## Usage

Everything is automatic! Just run:

```bash
./apply.sh "https://job-url" "optional notes"
```

The bot will:
1. Generate cover letter
2. Open browser
3. Create account (if needed)
4. Fill all pages
5. Handle "Next" buttons
6. Screenshot everything
7. Stop for your review

**Manual intervention needed for:**
- Captchas (rare on application forms)
- Email verification (coming soon, will be automatic)
- Final submit click (by design - you review first!)

---

## Configuration

### Make password configurable:

Add to `profile.json`:
```json
{
  "account": {
    "password": "YourSecurePassword123!"
  }
}
```

*Note: This field doesn't exist yet. For now, password is hardcoded as `TempPass123!`*

---

## Troubleshooting

**"Bot got stuck on page 2"**
- Check screenshots/ folder
- Look for captcha or unusual field
- Submit manual intervention needed

**"Account creation failed"**
- Check if email already exists (account may already be created)
- Look for password requirements (min length, special chars)
- Screenshot will show error message

**"Email verification timeout"**
- Gmail integration not fully enabled yet
- Manually check email and enter code
- Bot will wait on verification page

**"Too many pages"**
- Bot stops after 10 pages (safety limit)
- Probably got stuck in a loop
- Check screenshots to see what happened

---

## Future Enhancements

1. **AI Question Answering**
   - Detect open-ended questions
   - Generate answers based on resume
   - Example: "Describe your biggest achievement"

2. **Full Gmail Integration**
   - Auto-login to Gmail
   - Extract verification codes
   - Click verification links

3. **Resume Parsing**
   - Extract text from resume.pdf
   - Use for answering questions dynamically

4. **Application Tracking**
   - Save application status
   - Track which jobs applied to
   - Set reminders for follow-ups

5. **Platform Learning**
   - Learn from successful applications
   - Build platform-specific selectors
   - Improve accuracy over time
