#!/usr/bin/env bash
# Consolidate kobeOs to a single branch (master), archiving everything first.
# Run from a clone where you have push rights. Review before running.
set -euo pipefail
git fetch origin --prune

# 1. Archive every branch as a tag, so no commit becomes unreachable.
for ref in $(git for-each-ref --format='%(refname:strip=3)' refs/remotes/origin \
             | grep -vx 'HEAD' | grep -vx 'master'); do
  git tag -f "archive/$ref" "origin/$ref"
done
git push origin 'refs/tags/archive/*'   # do this BEFORE deleting anything

# 2. Delete every remote branch except master.
#    Branches with open pull requests are kept; drop them from the grep to include them.
git for-each-ref --format='%(refname:strip=3)' refs/remotes/origin \
  | grep -vx 'HEAD' | grep -vx 'master' \
  | grep -vx 'feat/property-intelligence-foundation' \
  | grep -vx 'feat/kobeai-k9-school-student-integration' \
  | grep -vx 'hotelos-byte-foundation-20260924' \
  | grep -vx 'codex/complete-live-sales' \
  | xargs -n 20 git push origin --delete

git fetch origin --prune
git branch -r
