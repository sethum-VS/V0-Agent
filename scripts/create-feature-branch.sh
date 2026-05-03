#!/bin/bash
set -e

cd /vercel/share/v0-project

# Add all changes
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
  echo "No changes to commit"
else
  # Commit the changes
  git commit -m "feat: Add Command Center AI Agent Manager dashboard UI

- Create dark-themed minimalist dashboard layout
- Implement left sidebar navigation with Overview, Workers, Activity, History, Settings
- Build worker agent cards with status badges (Idle, Thinking, Completed)
- Add Provision New Worker form with textarea and submit button
- Wire form with useState for task description input
- Add placeholder handleSubmit function for future API integration
- Configure Tailwind CSS v4 with dark theme colors and semantic tokens
- Set up shadcn UI components (Button, Card, Badge, Textarea)"
fi

# Create and switch to new branch from main
git fetch origin main
git checkout -b feature/v0-ui origin/main

# Cherry-pick or merge changes from current branch
git merge ai-agent-dashboard --no-edit

# Push to remote
git push -u origin feature/v0-ui

echo "✓ Successfully created and pushed feature/v0-ui branch"
