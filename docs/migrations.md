# Database migrations

## Local dev

```sh
# Create a new migration after editing prisma/schema.prisma
npx prisma migrate dev --name <descriptive_name>
```

## Production (Neon)

Migrations are NOT auto-applied during Vercel deploy. To apply:

1. Open the GitHub Actions tab → "DB Migrate (manual)" workflow
2. Click "Run workflow"
3. Choose environment (production / staging)
4. Optionally check "Dry run" first to preview
5. The "production" environment requires a maintainer approval before the job runs (configure in repo Settings → Environments → production → Required reviewers)

## Why not auto-apply?

Auto-applying migrations on every Vercel build means:
- No review gate
- Failed migration leaves the DB in a half-state mid-deploy
- Concurrent preview deploys can race

Separating migration deploy from build gives us approval gates, dry-run, and explicit control.

## One-time setup (repo admin)

1. GitHub repo → Settings → Environments → New environment "production"
2. Add Required reviewers (yourself + any maintainer)
3. Add secret: DATABASE_URL = <Neon production connection string>
4. Repeat for "staging" if desired
