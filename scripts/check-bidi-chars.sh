#!/usr/bin/env bash
# =============================================================================
# Check for bidirectional and directional override control characters in source.
# These can be used to hide malicious code and must not appear in the repo.
# See: https://unicode.org/reports/tr9/ (U+200E, U+200F, U+202A-U+202E, U+2066-U+2069)
# =============================================================================

set -e

ROOT="${1:-.}"
FOUND=0

# Perl one-liner: match LRM, RLM, LRE, RLE, PDF, LRO, RLO, LRI, RLI, FSI, PDI
PERL_BIDI='[\x{200E}\x{200F}\x{202A}\x{202B}\x{202C}\x{202D}\x{202E}\x{2066}\x{2067}\x{2068}\x{2069}]'

echo "Checking for bidi/control characters in ${ROOT}..."

while IFS= read -r -d '' f; do
  out=$(perl -ne "print \"\$ARGV:\$.: \$_\" if /$PERL_BIDI/" "$f" 2>/dev/null || true)
  if [ -n "$out" ]; then
    echo "  BIDI/CTRL: $f"
    echo "$out"
    FOUND=1
  fi
done < <(find "$ROOT" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.md' \) \
  -not -path '*/node_modules/*' \
  -not -path '*/dist/*' \
  -not -path '*/.git/*' \
  -print0 2>/dev/null)

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "FAIL: Bidirectional or directional override control characters found."
  echo "Remove U+200E, U+200F, U+202A-U+202E, U+2066-U+2069 from the files above."
  echo "Use plain ASCII hyphen-minus (0x2D) instead of em/en dash where needed."
  exit 1
fi

echo "OK: No bidi/control characters found."
exit 0
