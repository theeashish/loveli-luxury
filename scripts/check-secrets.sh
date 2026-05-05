#!/usr/bin/env bash
# =============================================================================
# Secret scanner. Blocks commits containing common credential patterns.
# Run via lint-staged on every commit. Run in CI on every push.
# =============================================================================
set -euo pipefail

EXIT_CODE=0
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Patterns that should never appear in committed code
declare -a PATTERNS=(
  # Supabase
  "eyJhbGciOiJIUzI1NiI"
  # Flutterwave
  "FLWSECK-[a-zA-Z0-9]{20}"
  "FLWSECK_TEST-[a-zA-Z0-9]{20}-X"
  # Stripe (in case anyone tries)
  "sk_live_[a-zA-Z0-9]{24}"
  "sk_test_[a-zA-Z0-9]{24}"
  "rk_live_[a-zA-Z0-9]{24}"
  # Resend
  "re_[a-zA-Z0-9]{20}"
  # Generic AWS
  "AKIA[0-9A-Z]{16}"
  # Generic private keys
  "-----BEGIN RSA PRIVATE KEY-----"
  "-----BEGIN OPENSSH PRIVATE KEY-----"
  "-----BEGIN PRIVATE KEY-----"
  # Basic .env content patterns
  "SUPABASE_SERVICE_ROLE_KEY=.{20,}"
  "FLUTTERWAVE_SECRET_KEY=.{10,}"
)

# Files that should never be committed
declare -a FORBIDDEN_FILES=(
  ".env"
  ".env.local"
  ".env.production"
  ".env.development"
  "service-account.json"
  "credentials.json"
)

# Check forbidden files
for forbidden in "${FORBIDDEN_FILES[@]}"; do
  if git ls-files --error-unmatch "$forbidden" 2>/dev/null; then
    echo -e "${RED}ERROR: forbidden file is tracked: $forbidden${NC}"
    echo "Add to .gitignore and remove with: git rm --cached $forbidden"
    EXIT_CODE=1
  fi
done

# Scan staged files (or all tracked files in CI)
if [ -n "${CI:-}" ]; then
  FILES_TO_SCAN=$(git ls-files | grep -vE '\.(lock|lockb|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$' || true)
else
  FILES_TO_SCAN=$(git diff --cached --name-only --diff-filter=ACM | grep -vE '\.(lock|lockb|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$' || true)
fi

if [ -z "$FILES_TO_SCAN" ]; then
  echo "No files to scan."
  exit 0
fi

for pattern in "${PATTERNS[@]}"; do
  while IFS= read -r file; do
    if [ -f "$file" ]; then
      # Skip the secret-scan script itself and the .env.example file
      if [[ "$file" == "scripts/check-secrets.sh" ]] || [[ "$file" == ".env.example" ]]; then
        continue
      fi
      if grep -E "$pattern" "$file" > /dev/null 2>&1; then
        echo -e "${RED}ERROR: secret pattern matched in $file${NC}"
        echo -e "${YELLOW}  Pattern: $pattern${NC}"
        EXIT_CODE=1
      fi
    fi
  done <<< "$FILES_TO_SCAN"
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "Secret scan passed."
else
  echo -e "${RED}Secret scan failed. Commit blocked.${NC}"
  echo "If this is a false positive, refactor to avoid the pattern."
fi

exit "$EXIT_CODE"
