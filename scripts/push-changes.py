#!/usr/bin/env python3
import subprocess
import sys
import os

os.chdir('.')

def run_cmd(cmd):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return False
    return True

# Add all changes
if not run_cmd("git add -A"):
    sys.exit(1)

# Commit changes
commit_msg = """fix: Fix UI rendering and add AI workflow manager API

- Fix next.config.mjs by removing broken withWorkflow import that crashed dev server
- Add app/api/manager/route.ts with @upstash/workflow integration
- Implement 'plan-workers' workflow step using AI SDK generateText
- Generate OpenClaw SOUL.md persona JSON from task descriptions
- Add suppressHydrationWarning to body element for Grammarly compatibility
- Fix lucide-react version to 0.468.0
- Clean up globals.css duplicate CSS variables"""

if not run_cmd(f'git commit -m "{commit_msg}"'):
    print("No changes to commit or commit failed")
    sys.exit(1)

# Push to current branch
if not run_cmd("git push"):
    print("Push failed")
    sys.exit(1)

print("\n✓ Successfully pushed changes to current branch")
