# 🤖 AI-Powered Question Answering

The application bot now includes **intelligent question answering** for open-ended questions based on your resume.

## How It Works

When the bot encounters a textarea or open-ended question, it:

1. **Detects the question type** - Uses pattern matching to identify questions that need detailed answers
2. **Extracts context** - Looks for question text from labels, placeholders, aria-labels
3. **Generates answer** - Uses Claude to answer based on your resume
4. **Fills the field** - Auto-populates with the AI-generated response

## What Questions Get AI Answers?

Questions containing these triggers:
- "describe"
- "explain"
- "tell us about"
- "why are you"
- "what experience"
- "how have you"
- "give an example"
- "share a time"
- "specific example"
- "ai-powered", "product you", "project you"
- "technologies", "impact", "role"

## Example Questions Answered

### ✅ Handled by AI:

**"Please describe a specific AI-powered product you've launched or managed end-to-end."**

AI Answer:
> At Intuit Mailchimp, I owned end-to-end agentic AI strategy including done-for-you campaign recommendations and multimodal content generation (layout, text, image). I led development of the chat-based agentic AI platform which delivered a 35% lift in omnichannel penetration growth, translating to +$10M ARR opportunity. I also built the recommendation engine at Attila AI that boosted cross-sell conversion rates by 82% using NLP and predictive analytics.

**"What technologies or models were involved and what measurable impact did it have?"**

AI Answer:
> I worked with Transformers/LSTMs, GenAI (GANs, VAEs, LLMs), and established AI quality standards including Evals frameworks and GenAI Trust & Safety guardrails. Measurable impacts include 35% omnichannel penetration growth at Mailchimp, 78 bps churn reduction in one quarter, and 82% improvement in cross-sell conversion rates at Attila AI.

### ❌ Not handled by AI (filled directly from profile.json):

- Name, email, phone → from `profile.json`
- Location, work authorization → from `profile.json`
- Salary, start date → from `responses.json`

## Configuration

### API Key Required

The AI answering uses Claude API. Make sure your API key is set:

```bash
# In ~/dev/jobsearch/jobsearch/.env
CLAUDE_API_KEY=sk-ant-...
```

The application bot automatically loads this file.

### Fallback Behavior

If no API key is found:
- ⚠️ Warning displayed: "AI question answering disabled"
- Fields left blank for manual filling
- Everything else works normally

## Resume Data

The AI answers are based on your resume embedded in `question-answerer.ts`.

**To update:**
1. Edit `/home/bilelburaway/dev/jobsearch/bot/src/question-answerer.ts`
2. Update the `RESUME_TEXT` constant
3. Rebuild: `npm run build`

## System Prompt

The AI is instructed to:
- ✅ Be specific and concrete (numbers, metrics, examples)
- ✅ Be concise (2-3 sentences unless more detail needed)
- ✅ Be direct (no fluff)
- ✅ Stay accurate (only use resume content)
- ❌ Never make up information not in the resume

If the resume doesn't have relevant info, it responds: "Not applicable based on my background"

## Monitoring

When the bot detects and answers a question, you'll see:

```
🤔 AI answering: "Please describe a specific AI-powered product you've launched..."
✅ AI answer: "At Intuit Mailchimp, I owned end-to-end agentic AI strategy..."
```

Review these answers in the browser before submitting!

## Cost

- Model: `claude-sonnet-4`
- Max tokens per answer: 300
- Temperature: 0.7
- Approximate cost: ~$0.003 per question answered

For a typical application with 2-3 open-ended questions: **~$0.01 total**

## Tips

1. **Review AI answers** - The bot stops before submit so you can edit
2. **Update your resume** - Keep `RESUME_TEXT` current for best answers
3. **Check screenshots** - Saved to `screenshots/` folder
4. **Manual override** - You can always edit fields the AI filled

## Example Flow

```
Opening application...
🔘 Clicking apply button
✅ Navigated to application form

📄 Resume uploaded
📝 Cover letter uploaded
✅ Name filled: Bilel Buraway
✅ Email filled: bilel@example.com
✅ Phone filled: +1-650-555-1234

🤔 AI answering: "Describe a specific AI product..."
✅ AI answer: "At Intuit Mailchimp, I owned..."

🤔 AI answering: "What technologies were involved..."
✅ AI answer: "I worked with Transformers/LSTMs..."

📸 Screenshot taken
⏸️  BROWSER LEFT OPEN FOR REVIEW
👉 Please review the form and click submit manually.
```

## Troubleshooting

**"AI question answering disabled"**
- Check `CLAUDE_API_KEY` in `~/dev/jobsearch/jobsearch/.env`
- Make sure the file exists and has the correct format

**AI answer seems wrong**
- Edit it manually before submitting
- Update `RESUME_TEXT` to include missing information
- Rebuild with `npm run build`

**AI not detecting question**
- Check if question contains trigger words (see list above)
- Manually add to field if needed
- Consider updating trigger list in `question-answerer.ts`

---

Built to save you from writing the same achievements story 50 times! 🚀
