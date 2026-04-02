# 🌐 Chrome Setup for Best Results

The bot works best with **real Chrome** instead of Playwright's Chromium.

## Why Use Real Chrome?

**Benefits:**
- ✅ **No bot detection** - Gmail, LinkedIn, job sites won't flag you
- ✅ **Existing sessions** - Already logged into Gmail, job sites, etc.
- ✅ **Saved passwords** - Autofill from your Chrome password manager
- ✅ **Cookies preserved** - No repeated logins
- ✅ **Browser extensions** - Use password managers, ad blockers, etc.

**Without real Chrome:**
- ⚠️ Gmail detects automation and may block
- ⚠️ Need to log in every time
- ⚠️ Some sites show captchas more often

---

## Installation

### Linux (Chromebook/Ubuntu/Debian)

```bash
# Download and install Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f  # Fix dependencies
```

Or use the package manager:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install google-chrome-stable

# Fedora/RHEL
sudo dnf install google-chrome-stable
```

### macOS

Download from: https://www.google.com/chrome/

Or via Homebrew:
```bash
brew install --cask google-chrome
```

### Windows

Download from: https://www.google.com/chrome/

---

## Verify Installation

Run this to find your Chrome profile:

**Linux:**
```bash
ls ~/.config/google-chrome/Default
```

**macOS:**
```bash
ls ~/Library/Application\ Support/Google/Chrome/Default
```

**Windows (PowerShell):**
```powershell
dir "$env:LOCALAPPDATA\Google\Chrome\User Data\Default"
```

If you see a bunch of files, you're good! ✅

---

## How It Works

When you run `./apply.sh`, the bot:

1. **Detects Chrome profile path** based on your OS
2. **Launches real Chrome** with your existing profile
3. **Preserves all sessions** - Gmail, job sites, etc.
4. **Fills applications** using your logged-in state

**Console output:**
```
🌐 Using Chrome profile: /home/user/.config/google-chrome/Default
✅ Using real Chrome with your existing session
   Gmail and other sites will recognize you as logged in!
```

---

## Fallback Mode

If Chrome isn't installed, the bot falls back to Playwright Chromium:

```
⚠️  Chrome not found. Using Playwright Chromium.
   For best results, install Chrome: https://www.google.com/chrome/
```

**This still works**, but:
- Gmail may show "suspicious activity" warnings
- You'll need to log into sites manually
- Some sites may show more captchas

---

## Using Multiple Chrome Profiles

If you have multiple Chrome profiles (Personal, Work, etc.):

**Find your profiles:**
```bash
# Linux
ls ~/.config/google-chrome/
# Shows: Default, Profile 1, Profile 2, etc.

# macOS  
ls ~/Library/Application\ Support/Google/Chrome/
```

**Use specific profile:**

Edit `src/filler.ts` line ~30:
```typescript
// Change from:
chromeProfilePath = `${homedir}/.config/google-chrome/Default`;

// To:
chromeProfilePath = `${homedir}/.config/google-chrome/Profile 1`;
```

**Or create environment variable:**
```bash
export CHROME_PROFILE_PATH="$HOME/.config/google-chrome/Profile 1"
./apply.sh "url"
```

---

## Troubleshooting

### "Chrome is already running"

**Error:**
```
Error: Failed to launch Chrome because it is already running
```

**Fix:**
Close all Chrome windows before running the bot, or use a different profile.

### "Profile locked"

**Error:**
```
User data directory is already in use
```

**Fix:**
The bot creates a lock file. Close Chrome and try again.

### "Gmail still detects automation"

Even with real Chrome, Gmail may detect Playwright. **Solutions:**

1. **Use existing session** - Log into Gmail in Chrome before running bot
2. **Skip Gmail verification** - Type `n` when asked "Want me to open Gmail?"
3. **Manual email check** - Check email yourself, faster anyway

### Wrong profile path

If detection fails, manually set the path in `src/filler.ts`:

```typescript
// Override auto-detection
chromeProfilePath = '/custom/path/to/chrome/profile';
```

---

## Security Note

**The bot uses your real Chrome profile**, which means:
- ✅ It can access sites you're logged into
- ✅ It uses your saved passwords (if autofill is on)
- ⚠️ Make sure you trust the bot code (it's open source, review it!)
- ⚠️ Don't run on shared computers

**What the bot does NOT do:**
- ❌ Send your passwords anywhere
- ❌ Access sites you don't tell it to
- ❌ Modify your Chrome settings
- ❌ Steal cookies or session data

All code is local. Review `src/filler.ts` if you want to verify.

---

## Alternative: Fresh Profile

If you don't want to use your main Chrome profile, create a fresh one:

```bash
# Create new profile directory
mkdir -p ~/.config/google-chrome-jobbot

# Update filler.ts to use it
chromeProfilePath = `${homedir}/.config/google-chrome-jobbot`;
```

Then manually log into Gmail, LinkedIn, etc. in that profile before running the bot.

---

## Recommended Setup

1. **Install Chrome** (if not already)
2. **Log into Gmail** in Chrome
3. **Save job board logins** (Lever, Greenhouse, etc.) in Chrome
4. **Run the bot** - it inherits all your sessions!

**Result:** Seamless automation with zero login friction! 🚀
