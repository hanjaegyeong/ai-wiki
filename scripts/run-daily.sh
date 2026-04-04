#!/bin/bash
export PATH="/Users/hh/.nvm/versions/node/v24.14.0/bin:/Users/hh/.local/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/hh/Desktop/dev/ai-wiki
PROMPT=$(cat .claude/prompts/daily-keyword.md)
/Users/hh/.local/bin/claude --dangerously-skip-permissions -p "$PROMPT" >> logs/daily.log 2>&1
