#!/bin/bash
# Recreate venv with Python 3.10+ (required by browser-use-sdk)
cd "$(dirname "$0")"
PYTHONS="python3.12 python3.11 python3.10 /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3.11"
for py in $PYTHONS; do
  if ver=$($py --version 2>/dev/null); then
    minor=$(echo "$ver" | grep -oE "3\.([0-9]+)" | cut -d. -f2)
    if [ -n "$minor" ] && [ "$minor" -ge 10 ]; then
      echo "Using $py ($ver)"
      rm -rf .venv
      $py -m venv .venv
      . .venv/bin/activate
      pip install -r requirements.txt
      echo ""
      echo "Done. Run: source .venv/bin/activate && python job_search.py"
      exit 0
    fi
  fi
done
echo "ERROR: Python 3.10+ not found."
echo "Install with: brew install python@3.12"
echo "Then run: ./setup_venv.sh"
exit 1
