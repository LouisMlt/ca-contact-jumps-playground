#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test --test-reporter=tap test/*.test.mjs
python3 scripts/generate_data.py --check
python3 scripts/vendor_katex.py --check
node --check src/app.js
node scripts/build.mjs
python3 -m py_compile test/browser/test_playground.py
python3 -m unittest discover -s test/browser -p 'test_*.py' -v
