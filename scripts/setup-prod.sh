#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Dream-1 — Production setup helper
# Use AFTER:
#   - Neon DB created and DATABASE_URL exported
#   - INITIAL_ADMIN_PASSWORD exported (strong)
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

if [[ -z "${INITIAL_ADMIN_PASSWORD:-}" ]]; then
  echo "❌ INITIAL_ADMIN_PASSWORD not set (required for prod seed)"
  exit 1
fi

if [[ "${INITIAL_ADMIN_PASSWORD}" == "dream12345" ]]; then
  echo "❌ INITIAL_ADMIN_PASSWORD must NOT be the default dev password"
  exit 1
fi

echo "▸ Step 1/3 — Generate Prisma client"
npx prisma generate

echo
echo "▸ Step 2/3 — Apply pending migrations"
npx prisma migrate status
read -r -p "Continue with migrate deploy? (yes/N): " confirm
if [[ "${confirm}" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi
npx prisma migrate deploy

echo
echo "▸ Step 3/3 — Seed initial owner + stages"
ALLOW_PROD_SEED=true node prisma/seed.mjs

echo
echo "✅ Done. Sign in at \$APP_URL/sign-in with:"
echo "   email:    owner@dream1.local"
echo "   password: (your INITIAL_ADMIN_PASSWORD)"
echo
echo "Next steps:"
echo "  1. Change owner password via /app/users"
echo "  2. Enable 2FA via /app/settings/security"
echo "  3. Create real users with appropriate roles"
echo "  4. Update Factory.name/slug/etc via /app/settings"
