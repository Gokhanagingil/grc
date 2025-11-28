#!/bin/bash
# Git checkpoint - creates a checkpoint branch if build & smoke are successful

set -e

MESSAGE="${1:-auto: progress checkpoint}"

echo "📝 Git Checkpoint"

# Check if git is available
if ! command -v git &> /dev/null; then
  echo "⚠️  Git not found, skipping checkpoint"
  exit 0
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "⚠️  Not a git repository, skipping checkpoint"
  exit 0
fi

# Check if there are changes
if [ -z "$(git status --porcelain)" ]; then
  echo "ℹ️  No changes to commit"
  exit 0
fi

# Create checkpoint branch
timestamp=$(date '+%Y%m%d-%H%M')
branch_name="auto/progress-$timestamp"

echo "Creating checkpoint branch: $branch_name"

# Checkout or create branch
if ! git checkout -b "$branch_name" 2>/dev/null; then
  # Branch might already exist, try to switch
  git checkout "$branch_name" 2>/dev/null || true
fi

# Stage all changes
git add -A

# Commit
commit_message="$MESSAGE (timestamp: $timestamp)"
if git commit -m "$commit_message" 2>/dev/null; then
  echo "✅ Checkpoint created: $branch_name"
  echo "   Commit: $commit_message"
  exit 0
else
  echo "⚠️  No changes to commit (maybe already committed)"
  exit 0
fi

