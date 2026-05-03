#!/usr/bin/env python3
import subprocess
import sys
import os

os.chdir('.')

def run_cmd(cmd):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return False
    print(result.stdout)
    return True

# Add all changes
if not run_cmd("git add -A"):
    sys.exit(1)

# Commit changes
commit_msg = """feat: Add Command Center AI Agent Manager dashboard UI

- Create dark-themed minimalist dashboard layout
- Implement left sidebar navigation with Overview, Workers, Activity, History, Settings
- Build worker agent cards with status badges (Idle, Thinking, Completed)
- Add Provision New Worker form with textarea and submit button
- Wire form with useState for task description input
- Add placeholder handleSubmit function for future API integration
- Configure Tailwind CSS v4 with dark theme colors and semantic tokens
- Set up shadcn UI components (Button, Card, Badge, Textarea)"""

if not run_cmd(f'git commit -m "{commit_msg}"'):
    print("No new changes to commit (this is OK if already committed)")

# Fetch main
if not run_cmd("git fetch origin main"):
    sys.exit(1)

# Create new branch from main
if not run_cmd("git checkout -b feature/v0-ui origin/main"):
    # Branch might already exist, try to checkout
    run_cmd("git checkout feature/v0-ui")

# Merge changes from ai-agent-dashboard
if not run_cmd("git merge ai-agent-dashboard --no-edit"):
    print("Merge conflict or other issue occurred")

# Push to remote
if not run_cmd("git push -u origin feature/v0-ui"):
    sys.exit(1)

print("\n✓ Successfully created and pushed feature/v0-ui branch")
