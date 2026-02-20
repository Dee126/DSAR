#!/usr/bin/env bash
# CI guardrail: fail if any .ts/.tsx file exceeds MAX_LINES (default 400).
# Usage: ./scripts/check-file-size.sh [max_lines]

MAX_LINES="${1:-400}"
FAILED=0

while IFS= read -r file; do
  lines=$(wc -l < "$file")
  if [ "$lines" -gt "$MAX_LINES" ]; then
    echo "FAIL: $file has $lines lines (max $MAX_LINES)"
    FAILED=1
  fi
done < <(find src -name "*.ts" -o -name "*.tsx" | grep -v node_modules)

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "Some files exceed the $MAX_LINES-line hard cap."
  echo "See docs/ARCHITECTURE.md for refactoring guidelines."
  exit 1
fi

echo "OK: All files are within the $MAX_LINES-line limit."
