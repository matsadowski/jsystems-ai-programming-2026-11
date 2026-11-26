#!/usr/bin/env bash
# Usage: md2pdf.sh <report.md> [lang]  -> writes <report>.html and <report>.pdf next to the .md
# Needs: python3 and google-chrome (or chromium) for headless printing.
set -euo pipefail
src="$1"; lang="${2:-en}"; base="${src%.md}"
here="$(cd "$(dirname "$0")" && pwd)"
python3 -I "$here/md2html.py" "$src" "$base.html" "$lang"
chrome="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"
"$chrome" --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer \
  --virtual-time-budget=4000 --print-to-pdf="$(realpath "$base.pdf")" "file://$(realpath "$base.html")" 2>/dev/null
echo "wrote $base.html and $base.pdf"
