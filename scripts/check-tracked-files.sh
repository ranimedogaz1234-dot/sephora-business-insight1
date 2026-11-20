#!/usr/bin/env bash
# Fails if private datasets or secret files are tracked or staged.
# Usage: bash scripts/check-tracked-files.sh   (checks index = tracked + staged files)
set -euo pipefail

files=$(git ls-files)
status=0

csv=$(echo "$files" | grep -iE '\.(csv|parquet|feather|pkl|zip|sqlite|sqlite3|db)$' | grep -v '^backend/tests/fixtures/' || true)
if [ -n "$csv" ]; then
  echo "ERROR: data files must not be committed:"; echo "$csv"; status=1
fi

envs=$(echo "$files" | grep -E '(^|/)\.env(\..*)?$' | grep -vE '\.env\.example$' || true)
if [ -n "$envs" ]; then
  echo "ERROR: environment files must not be committed:"; echo "$envs"; status=1
fi

keys=$(echo "$files" | grep -iE '\.(pem|key)$' || true)
if [ -n "$keys" ]; then
  echo "ERROR: key files must not be committed:"; echo "$keys"; status=1
fi

# Common secret patterns inside tracked text files
if git grep -nIE '(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' -- . ':!scripts/check-tracked-files.sh'; then
  echo "ERROR: possible secret found in tracked files"; status=1
fi

# Fixture CSVs must stay small (synthetic only)
for f in $(echo "$files" | grep '^backend/tests/fixtures/.*\.csv$' || true); do
  if [ "$(wc -c < "$f")" -gt 20000 ]; then
    echo "ERROR: fixture $f is too large to be synthetic"; status=1
  fi
done

# Local guard: source code must never be silently excluded by an over-broad
# ignore rule (only meaningful in a working copy, not in a fresh CI checkout).
ignored_src=$(git ls-files --others --ignored --exclude-standard -- backend/app frontend/src \
  | grep -vE '(__pycache__/|\.pyc$)' || true)
if [ -n "$ignored_src" ]; then
  echo "ERROR: source files are ignored by .gitignore and would not be committed:"
  echo "$ignored_src"; status=1
fi

[ $status -eq 0 ] && echo "Repository safety check passed."
exit $status
