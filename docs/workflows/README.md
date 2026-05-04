# GitHub Actions Workflow Templates

These two workflow files **belong in `.github/workflows/`** but were not pushed by the bot because the personal access token used lacked the `workflow` scope.

## How to add them

### Option A — GitHub UI (easiest)

1. Open GitHub repo → click "Add file" → "Create new file"
2. Name: `.github/workflows/pr.yml`
3. Paste contents of [`pr.yml`](./pr.yml)
4. Commit
5. Repeat for `.github/workflows/db-migrate.yml` from [`db-migrate.yml`](./db-migrate.yml)

### Option B — Local with `workflow`-scoped PAT

```bash
# Update your PAT to include "workflow" scope at:
# https://github.com/settings/tokens

mkdir -p .github/workflows
cp docs/workflows/pr.yml .github/workflows/
cp docs/workflows/db-migrate.yml .github/workflows/
git rm docs/workflows/pr.yml docs/workflows/db-migrate.yml docs/workflows/README.md
git add -A
git commit -m "ci: add PR and migration workflows"
git push
```

## What each workflow does

### `pr.yml` — Pull-request checks

Runs on every PR (and pushes to main):

- TypeScript check (`tsc --noEmit`)
- ESLint (continue-on-error: true while lint warnings are still being cleaned)
- Unit tests (excludes `*.integration.test.ts`)

### `db-migrate.yml` — Manual migration deploy

Triggered manually via Actions tab → "DB Migrate (manual)" → Run workflow:

- Choose environment: `production` or `staging` (each gated by GitHub Environments review rules)
- Optionally toggle dry-run to preview without applying
- Runs `prisma migrate deploy` against `${{ secrets.DATABASE_URL }}` of the chosen environment
- Outputs `prisma migrate status` before/after for audit trail

**Setup**: GitHub Settings → Environments → New environment "production" → Required reviewers + secret `DATABASE_URL`.
