#!/bin/bash
# Run job search using the project venv
cd "$(dirname "$0")"
. .venv/bin/activate
exec python3 job_search.py
