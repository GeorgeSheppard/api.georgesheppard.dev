---
name: update-pr-from-branch
description: Update PR title and description based on branch changes
---

# Update PR from Branch Skill

## Overview

This skill analyzes all code changes on your current branch and generates an appropriate PR title and description. It uses standard git commands to read changes and the GitHub MCP to update your PR. It then asks for your confirmation and allows edits before updating.

## What It Does

1. **Analyzes Code Changes**: Examines the diff between your branch and the base branch (master) using `git diff` and `git diff --stat`
2. **Generates Summary**: Creates a PR title and summary based on the files changed and types of modifications
3. **Asks for Approval**: Shows you the generated title and summary with three options:
   - Use these as-is
   - Edit them before applying
   - Cancel (don't update)
4. **Updates PR**: Uses the GitHub MCP to find and update your PR with the new title and summary

## Usage

When you want to update your PR based on the changes you've made, invoke the skill in Claude Code:

```
/update-pr-from-branch
```

The skill will:
- Detect your current branch
- Find the associated PR
- Generate title and description using git commands
- Ask for confirmation
- Update the PR if approved using GitHub MCP

## What Gets Generated

The skill generates:
1. **Title**: Following the pattern `[Action]: [Description]`
   - Examples: `Add: OpenAPI spec generation`, `Update: authentication flow`, `Fix: database query`
2. **Summary**: Key bullet points describing the changes made

## Requirements

- Must be on a branch with an associated GitHub PR
- Git repository with base branch (master)
- Claude Code with GitHub MCP available and configured
