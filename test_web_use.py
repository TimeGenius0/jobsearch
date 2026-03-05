#!/usr/bin/env python3
"""
Test script for the Browser Use web service API.
Loads BROWSER_USE_API_KEY from .env and runs a simple task.
"""

import asyncio
import os
import sys
from pathlib import Path

# Load .env
_base = Path(__file__).resolve().parent
try:
    from dotenv import load_dotenv
    load_dotenv(_base / ".env")
except ImportError:
    pass


async def test_connectivity():
    """Quick connectivity check to api.browser-use.com."""
    print("1. Connectivity check (api.browser-use.com)...")
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api.browser-use.com")
        print(f"   OK (HTTP {r.status_code})")
        return True
    except Exception as e:
        print(f"   FAILED: {type(e).__name__}: {e}")
        return False


async def test_web_use():
    api_key = os.getenv("BROWSER_USE_API_KEY")
    if not api_key:
        print("ERROR: BROWSER_USE_API_KEY not set in .env")
        return 1

    print()
    print("2. Browser Use API test")
    print(f"   API key: {api_key[:10]}...{api_key[-4:]}")
    print(f"   Task: Go to example.com, get main heading")
    print("   Calling API (may take 10-30 seconds)...")
    sys.stdout.flush()

    try:
        from browser_use_sdk import AsyncBrowserUse

        client = AsyncBrowserUse()
        result = await client.run("Go to https://example.com and tell me the main heading text.")
        output = getattr(result, "output", None) or str(result)
        print("   SUCCESS")
        print(f"   Output: {output[:400]}{'...' if len(str(output)) > 400 else ''}")
        return 0
    except Exception as e:
        print("   FAILED")
        print(f"   Error: {type(e).__name__}: {e}")
        if os.getenv("VERBOSE"):
            import traceback
            traceback.print_exc()
        return 1


async def main():
    ok = await test_connectivity()
    if not ok:
        print()
        print("Connectivity failed. Check network, firewall, VPN, or DNS.")
        return 1
    return await test_web_use()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
