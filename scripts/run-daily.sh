#!/bin/bash
source /Users/hh/.zshrc 2>/dev/null
export PATH="/Users/hh/.nvm/versions/node/v24.14.0/bin:/Users/hh/.local/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="/Users/hh"
cd /Users/hh/Desktop/dev/ai-wiki
echo "=== $(date '+%Y-%m-%d %H:%M') ===" >> logs/daily.log
PROMPT=$(cat .claude/prompts/scheduling-add.md)
/Users/hh/.local/bin/claude --dangerously-skip-permissions --print -p "$PROMPT" >> logs/daily.log 2>&1
