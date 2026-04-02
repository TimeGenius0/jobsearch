# 📋 EEO & Diversity Questionnaire Handling

The bot automatically fills Equal Employment Opportunity (EEO) and diversity questionnaires using your preferences from `responses.json`.

## Supported Questions

### ✅ Veteran Status
- "Are you a protected veteran?"
- "Veteran status"
- "Military service"

**Common options:**
- "I am not a protected veteran" (default)
- "I am a protected veteran"
- "I decline to self-identify"

### ✅ Disability Status
- "Do you have a disability?"
- "Disability status"
- "Do you identify as a person with a disability?"

**Common options:**
- "I do not wish to answer" (default)
- "No, I do not have a disability"
- "Yes, I have a disability"
- "I decline to self-identify"

### ✅ Gender
- "Gender"
- "Sex"
- "Gender identity"

**Common options:**
- "Prefer not to say" (default)
- "Male"
- "Female"
- "Non-binary"
- "Decline to self-identify"

### ✅ Race/Ethnicity
- "Race"
- "Ethnicity"
- "Racial/ethnic background"

**Common options:**
- "Prefer not to say" (default)
- "White"
- "Black or African American"
- "Hispanic or Latino"
- "Asian"
- "Native American or Alaska Native"
- "Native Hawaiian or Other Pacific Islander"
- "Two or more races"
- "Decline to self-identify"

---

## Configuration

Edit `data/responses.json`:

```json
{
  "salaryExpectation": "$180,000 - $220,000",
  "availableStartDate": "2 weeks notice",
  "referralSource": "LinkedIn",
  
  // EEO Questions - Set your preferences
  "veteranStatus": "I am not a protected veteran",
  "disability": "I do not wish to answer",
  "gender": "Prefer not to say",
  "race": "Prefer not to say"
}
```

### Setting Your Preferences

**To decline all EEO questions:**
```json
{
  "veteranStatus": "Decline to self-identify",
  "disability": "I do not wish to answer",
  "gender": "Prefer not to say",
  "race": "Prefer not to say"
}
```

**To provide answers:**
```json
{
  "veteranStatus": "I am not a protected veteran",
  "disability": "No, I do not have a disability",
  "gender": "Male",
  "race": "Asian"
}
```

---

## How It Works

### Detection Strategy

The bot looks for EEO questions by:
1. **Field names** - `name*="veteran"`, `name*="disability"`, etc.
2. **Labels** - `aria-label*="gender"`, `for*="race"`, etc.
3. **IDs** - `id*="ethnicity"`, etc.

### Field Types Supported

**Dropdowns (most common):**
```html
<select name="veteran_status">
  <option>I am not a protected veteran</option>
  <option>I am a protected veteran</option>
  <option>I decline to self-identify</option>
</select>
```

**Radio buttons:**
```html
<input type="radio" name="disability" value="no">
<input type="radio" name="disability" value="yes">
<input type="radio" name="disability" value="decline">
```

### Fallback Behavior

If exact match fails:
1. Try to find "decline" or "prefer not" option
2. Select first available option (usually "decline")
3. Skip if no match found (leaves blank)

---

## Platform-Specific Handling

### Lever (`jobs.lever.co`)
- EEO questions usually at the end of form
- Consistently uses `<select>` dropdowns
- Field names match question text

### Greenhouse (`boards.greenhouse.io`)
- Often on separate "EEO" or "Diversity" page
- Uses fieldsets with radio buttons
- Multiple pages may have EEO questions

### Generic/Other Platforms
- Best-effort detection
- Tries both dropdowns and radio buttons
- Logs which questions were filled

---

## Legal Notes

### Why These Questions Exist

EEO questions are:
- **Voluntary** - You can always decline to answer
- **Used for compliance** - Companies track diversity metrics for EEOC reporting
- **Not used in hiring decisions** - Legally separate from application review
- **Confidential** - Stored separately from your application

### Your Rights

You can:
- ✅ Decline to answer any or all questions
- ✅ Choose "Prefer not to say" for all
- ✅ Skip questions entirely (bot will try to select "decline" option)

The bot respects your preferences exactly as configured in `responses.json`.

---

## Examples

### Example 1: Decline Everything
```json
{
  "veteranStatus": "Decline to self-identify",
  "disability": "Decline to self-identify",
  "gender": "Decline to self-identify",
  "race": "Decline to self-identify"
}
```

### Example 2: Answer Honestly
```json
{
  "veteranStatus": "I am not a protected veteran",
  "disability": "No, I do not have a disability",
  "gender": "Female",
  "race": "Hispanic or Latino"
}
```

### Example 3: Mixed Approach
```json
{
  "veteranStatus": "I am not a protected veteran",
  "disability": "I do not wish to answer",
  "gender": "Prefer not to say",
  "race": "Two or more races"
}
```

---

## Console Output

When filling EEO questions, you'll see:

```
📋 Looking for EEO/diversity questions...
  ✓ Veteran status
  ✓ Disability status
  ✓ Gender
  ✓ Race/Ethnicity
```

If a question isn't found, it's silently skipped (no error).

---

## Troubleshooting

**"EEO questions weren't filled"**
- Check screenshots to see if questions exist
- Some platforms ask on final page only
- May use non-standard field names

**"Wrong option was selected"**
- Edit `responses.json` with exact text from dropdown
- Check screenshots to see available options
- Fallback selects "decline" if exact match fails

**"Got stuck on EEO page"**
- May require clicking "Submit" or "Next" manually
- Check for required fields not detected
- Screenshot will show what's missing

**"Privacy concerns"**
- Set all to "Decline to self-identify"
- Bot will never submit without your review
- You can change answers before final submit

---

## Future Enhancements

- [ ] Auto-detect "required" vs "optional" questions
- [ ] Smart defaults based on previous applications
- [ ] Support for multi-select checkboxes (e.g., "Select all that apply")
- [ ] LGBTQ+ inclusive options (gender identity, sexual orientation)
- [ ] International EEO questions (UK, EU, etc.)

---

**Bottom line:** The bot handles diversity questionnaires automatically based on your preferences. You stay in control, and everything is reviewable before submit.
