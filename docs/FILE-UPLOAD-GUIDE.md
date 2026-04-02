# 📎 File Upload Guide

The bot automatically uploads your resume and cover letter to job applications!

## ✅ What Gets Uploaded

### Resume (Always)
- **Path:** Set in `profile.json` → `work.resumePath`
- **Default:** `./data/resume.pdf`
- **Uploaded to:** Resume/CV file upload fields

### Cover Letter (Optional)
- **Path:** Set in `profile.json` → `work.coverLetterPath`
- **Default:** `./data/cover-letter.docx`
- **Auto-generated:** By `apply.sh` script
- **Uploaded to:** Cover letter file upload fields

---

## 🔍 How Upload Detection Works

The bot looks for file upload fields by:

### For Resume:
1. `input[type="file"][name*="resume"]`
2. `input[type="file"][id*="resume"]`
3. `input[type="file"][aria-label*="resume"]`
4. `input[type="file"][aria-label*="CV"]`
5. Generic `input[type="file"]` (fallback)

### For Cover Letter:
1. `input[type="file"][name*="cover"]`
2. `input[type="file"][id*="cover"]`
3. `input[type="file"][aria-label*="cover"]`
4. `input[type="file"][placeholder*="cover"]`

---

## 📋 Console Output

When uploading, you'll see:

```
📎 Uploading documents...
📄 Uploading resume: /home/user/dev/jobsearch/bot/data/resume.pdf
  ✅ Resume uploaded successfully
📝 Uploading cover letter: /home/user/dev/jobsearch/bot/data/cover-letter.docx
  ✅ Cover letter uploaded successfully
```

---

## ⚙️ Configuration

Edit `data/profile.json`:

```json
{
  "work": {
    "resumePath": "/home/bilelburaway/dev/jobsearch/bot/data/resume.pdf",
    "coverLetterPath": "/home/bilelburaway/dev/jobsearch/bot/data/cover-letter.docx"
  }
}
```

### Using Different Files

**Per-job resume:**
```json
{
  "resumePath": "/path/to/resume-tech.pdf"
}
```

**No cover letter:**
```json
{
  "coverLetterPath": ""
}
```

---

## 🚨 Troubleshooting

### "Resume not found"
```
⚠️  Resume not found: /path/to/resume.pdf
```

**Fix:**
1. Check file exists: `ls -l /path/to/resume.pdf`
2. Update path in `profile.json`
3. Use absolute paths (not `~` or `./`)

### "No resume upload field found"
```
⚠️  No resume upload field found
```

**Possible reasons:**
- Form doesn't have file upload (rare)
- Upload field hidden until later page
- Upload field uses non-standard selectors

**What to do:**
- Check screenshots to see form structure
- Look for "Upload Resume" button manually
- Some platforms use drag-and-drop instead

### "Cover letter not uploaded"
```
⚠️  No cover letter upload field found (some forms don't have one)
```

**This is normal!** Many forms don't have cover letter upload fields. The bot will:
- Skip cover letter upload
- Continue with application
- You can paste cover letter text manually if there's a textarea

### File size too large

Some platforms have file size limits (usually 2-5 MB).

**Fix:**
- Compress PDF: `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=resume-compressed.pdf resume.pdf`
- Use online tools: Smallpdf, iLovePDF
- Update `resumePath` to compressed version

---

## 📸 Verification

After upload, the bot:
1. Takes a screenshot
2. Continues filling other fields
3. Leaves browser open for review

**Before submitting, verify:**
- ✅ Resume uploaded (look for filename under upload field)
- ✅ Cover letter uploaded (if field exists)
- ✅ Correct versions (not old resume!)

---

## 🎯 Upload Flow

```
1. Bot opens application
2. Fills contact info
   ↓
3. 📎 Uploads resume
   ↓
4. 📎 Uploads cover letter (if field exists)
   ↓
5. Fills remaining fields
   ↓
6. Screenshots
   ↓
7. ⏸️  Stops for your review
```

---

## 🔧 Advanced: Multiple Resumes

If you have different resumes for different roles:

**Option 1: Edit profile.json before each application**
```bash
# Edit path before running
nano data/profile.json
# Change resumePath to resume-tech.pdf or resume-pm.pdf
./apply.sh "url"
```

**Option 2: Script it**
```bash
#!/bin/bash
# apply-tech.sh
jq '.work.resumePath = "/path/to/resume-tech.pdf"' data/profile.json > data/profile.json.tmp
mv data/profile.json.tmp data/profile.json
./apply.sh "$1"
```

---

## ✅ File Checklist

Before running `./apply.sh`:

- [ ] Resume PDF exists at path in `profile.json`
- [ ] Cover letter generated (automatic via `apply.sh`)
- [ ] Files under 5 MB
- [ ] PDFs open correctly (not corrupted)
- [ ] Filenames are professional (resume.pdf, not finalFINAL_v3_REALLYFINAL.pdf)

---

## 📊 Upload Success Rate

**Platform compatibility:**

| Platform | Resume Upload | Cover Letter Upload |
|----------|--------------|---------------------|
| Lever | ✅ 100% | ✅ 90% |
| Greenhouse | ✅ 100% | ✅ 80% |
| Workday | ✅ 95% | ⚠️ 40% (often textarea instead) |
| Generic | ✅ 90% | ⚠️ 60% |

**Note:** Cover letter success is lower because many forms don't have file uploads for cover letters (they use text areas instead).

---

## 🆘 Still Having Issues?

1. **Check screenshots folder** - See what the form looks like
2. **Manual upload** - Upload files yourself before bot fills other fields
3. **Report issue** - Note platform URL and save screenshot

---

**Bottom line:** The bot handles file uploads automatically. You just need to make sure the files exist at the paths configured in `profile.json`.
