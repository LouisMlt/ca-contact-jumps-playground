#!/usr/bin/env bash
# Verify the exact staged tree or pushed commit, including browser checks.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
revision="${1:?A staged tree or commit is required}"
tree="$(git rev-parse "${revision}^{tree}")"
stamp="$(git rev-parse --git-path playground-verified-tree)"
if [[ -f "$stamp" && "$(cat "$stamp")" == "$tree" && "${PLAYGROUND_RECHECK:-0}" != 1 ]]; then
  echo "This exact source tree already passed local checks: $tree"
  exit 0
fi
snapshot="$(mktemp -d "${TMPDIR:-/tmp}/ca-playground-check.XXXXXX")"
trap 'rm -rf -- "$snapshot"' EXIT
git archive "$tree" | tar -x -C "$snapshot"
echo "Checking exact Git source tree $tree before commit/push."
bash "$snapshot/scripts/check-local.sh"
printf '%s\n' "$tree" > "$stamp"
