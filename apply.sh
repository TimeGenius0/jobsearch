#!/bin/bash
# Complete job application workflow:
# 1. Generate cover letter
# 2. Copy to application bot data folder
# 3. Run application filler

set -e

if [ -z "$1" ]; then
  echo "Usage: ./apply.sh <job_url> [notes]"
  echo ""
  echo "Examples:"
  echo "  ./apply.sh 'https://jobs.lever.co/clickup/role'"
  echo "  ./apply.sh 'https://boards.greenhouse.io/stripe/job/123' 'emphasize fintech'"
  echo ""
  echo "Company name is auto-extracted from URL."
  exit 1
fi

JOB_URL="$1"
NOTES="${2:-}"

# Clean URL (remove whitespace, newlines)
JOB_URL=$(echo "$JOB_URL" | tr -d '\n\r\t ' | xargs)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JOBSEARCH_DIR="$SCRIPT_DIR/jobsearch"
APP_BOT_DIR="$SCRIPT_DIR/bot"
OUTPUT_DIR="$SCRIPT_DIR/output"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Job Application Workflow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Job URL: $JOB_URL"
[ -n "$NOTES" ] && echo "📝 Notes: $NOTES"
echo ""

# Step 1: Generate cover letter (company name auto-extracted)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Generating cover letter..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$JOBSEARCH_DIR"
if [ -n "$NOTES" ]; then
  python3 cover_letter.py "$JOB_URL" --notes "$NOTES"
else
  python3 cover_letter.py "$JOB_URL"
fi

# Find the most recent cover letter
LATEST_COVER=$(ls -t "$OUTPUT_DIR"/Cover_Letter_*.docx | head -1)

if [ -z "$LATEST_COVER" ]; then
  echo ""
  echo "❌ No cover letter generated. Check for errors above."
  exit 1
fi

echo ""
echo "✅ Cover letter generated: $LATEST_COVER"
echo ""

# Step 2: Copy to application bot data folder
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Copying to application bot..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cp "$LATEST_COVER" "$APP_BOT_DIR/data/cover-letter.docx"
echo "✅ Cover letter copied to: $APP_BOT_DIR/data/cover-letter.docx"
echo ""

# Step 3: Run application filler
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Launching application bot..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Browser will open and fill the application form."
echo "⚠️  REVIEW EVERYTHING before clicking submit!"
echo ""

cd "$APP_BOT_DIR"
npm run apply -- --url "$JOB_URL"
