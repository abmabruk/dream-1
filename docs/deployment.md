# Dream-1 Deployment Guide — Vercel + Neon

## ١. تجهيز Neon Postgres

1. أنشئ مشروع Neon من <https://console.neon.tech>
2. **Region**: اختر `eu-central-1` (Frankfurt) أو `me-central-1` (UAE) — أقرب لـKSA لأداء + امتثال PDPL لبيانات المقيمين السعوديين
3. انسخ `DATABASE_URL` من Connection Details (مع `?sslmode=require`)
4. (اختياري) فعّل **Branching** — يساعد لاحقاً في PR previews + integration tests

## ٢. تجهيز Vercel

1. اربط الـrepo `abmabruk/dream-1` من <https://vercel.com/new>
2. **Framework**: Next.js (auto-detected)
3. **Build Command**: `npm run build` (الافتراضي — لا يشغّل migrations؛ مفصول بقصد، انظر §٣)
4. **Output**: `.next` (الافتراضي)
5. **Node Version**: 20.x

### Environment Variables (Production + Preview + Development)

في Vercel → Settings → Environment Variables:

| Variable                 | Value                            | Notes                   |
| ------------------------ | -------------------------------- | ----------------------- |
| `DATABASE_URL`           | (من Neon)                        | Production + Preview    |
| `AUTH_SECRET`            | `openssl rand -base64 64`        | فريد لكل بيئة، سرّي     |
| `APP_URL`                | `https://your-domain.vercel.app` | بدون slash آخر          |
| `CRON_SECRET`            | `openssl rand -base64 32`        | لـ`/api/cron/*`         |
| `INITIAL_ADMIN_PASSWORD` | (قوي)                            | للـseed الأولي فقط      |
| `LOG_LEVEL`              | `info`                           | اختياري                 |
| `SENTRY_DSN`             | (من Sentry)                      | اختياري                 |
| `NEXT_PUBLIC_SENTRY_DSN` | (نفس Sentry)                     | اختياري — client-side   |
| `SENTRY_AUTH_TOKEN`      | (token من Sentry)                | اختياري — لـsource maps |

**لا تعيّن** `ALLOW_PROD_SEED` ولا `ALLOW_UNAUTH_CRON` في production.

## ٣. تطبيق Migrations على Neon

> **مهم**: `prisma migrate deploy` تم نقله من `next build` (Phase 1.5) لمنع التطبيق التلقائي عند كل deploy. التطبيق يدوي عبر GitHub Action أو محلياً.

### الخيار أ — GitHub Action (مُفضّل)

1. ادفع `pr.yml` و `db-migrate.yml` إلى `.github/workflows/`:
   - الـPAT المُستخدَم لازم يحمل `workflow` scope
   - أو أضفهم من GitHub UI (Code → Add file → Create new file)
   - الملفات محفوظة في `/tmp/db-migrate.yml` و `/tmp/pr.yml` لو كنت تشتغل من نفس البيئة
2. في GitHub repo → Settings → Environments → New environment "production":
   - أضف Required reviewer: نفسك
   - أضف secret: `DATABASE_URL` = Neon prod URL
3. شغّل workflow يدوياً: Actions → "DB Migrate (manual)" → Run workflow → environment=production

### الخيار ب — محلياً

```bash
DATABASE_URL="<neon-prod-url>" npx prisma migrate deploy
```

> ⚠️ في كلتا الحالتين: راجع `prisma migrate status` قبل التطبيق للتأكد من المايجريشنز المعلّقة.

## ٤. Seed الـowner الأولي على Neon

```bash
INITIAL_ADMIN_PASSWORD="<strong-password>" \
ALLOW_PROD_SEED=true \
DATABASE_URL="<neon-prod-url>" \
node prisma/seed.mjs
```

ينشئ:

- Factory افتراضي ("Dream 1 Factory")
- ٤ مستخدمين (owner + supervisor + 2 workers) — كلهم بنفس الـpassword
- ٦ stages أساسية

**فوراً بعد**: سجّل دخول كـowner، غيّر الـpassword، فعّل 2FA، أنشئ المستخدمين الحقيقيين.

## ٥. الاختبار النهائي

بعد الـdeploy:

1. زر `https://your-domain.vercel.app/sign-in`
2. سجّل دخول كـowner
3. أنشئ inquiry → convert → quote → invoice → payment (دورة كاملة)
4. /app/settings/security → فعّل 2FA
5. شيك الـnotifications تشتغل
6. شيك `/api/v1/health` يرجع `{ok: true}`

## ٦. Cron Jobs (Vercel)

Vercel يقرأ `vercel.json` تلقائياً:

- `/api/cron/invoice-overdue` — يومياً ٦ص UTC (يُعلّم الفواتير المتأخرة + ينبّه المحاسبين)
- `/api/cron/quote-expiry` — يومياً ٧ص UTC (يحوّل عروض السعر منتهية الصلاحية لـEXPIRED + ينبّه)

كلاهما يحتاج `CRON_SECRET` معيّن في Vercel envs.

## ٧. Branch Protection (موصى به)

في GitHub → Settings → Branches → Add rule لـ`main`:

- ✅ Require pull request reviews (1 reviewer)
- ✅ Require status checks (after pr.yml workflow lands)
- ✅ Dismiss stale reviews on push
- ✅ Require linear history
- ❌ Allow force pushes (لا)

## ٨. Post-deploy checklist

- [ ] Migrations طُبّقت بنجاح (`prisma migrate status` فاضي pending)
- [ ] Owner سجّل دخول وغيّر كلمة المرور
- [ ] 2FA مفعّل لـowner
- [ ] Sentry يستقبل أحداث (لو ضبطت DSN) — اختبر بـ`/api/v1/health` خطأ يدوي
- [ ] AuditLog فيه entries بعد sign-in
- [ ] Cron jobs مجدولة في Vercel (ينظر تلقائياً من vercel.json)
- [ ] Backup أو point-in-time-restore مفعّل في Neon plan

## ٩. المسؤوليات (Operations)

- **Migration changes**: راجع `prisma migrate status` أسبوعياً، طبّق المُعلّقة عبر GHA
- **AuditLog retention**: لا يوجد حالياً — أضف cron يدوي بعد ٢٤ شهر
- **Notifications cleanup**: NotificationRepository.syncForUser ينظّف الـmanaged types تلقائياً؛ الـemitted (INVOICE_PAID etc.) تبقى حتى يحدّدها المستخدم كـmark read
- **Portal tokens**: TTL ١٤ يوم؛ revoke عبر POST `/api/v1/portal/revoke/[accessId]`
- **2FA recovery**: لو فقد المستخدم جهازه + recovery codes، owner يقدر يلغي 2FA من DB يدوياً

## ١٠. Rollback

في حال خطأ كارثي بعد الـdeploy:

1. **Vercel**: Settings → Deployments → اختر آخر deploy ناجح → "Promote to Production"
2. **Neon**: Branches → Production branch → Restore from point-in-time (قبل الـmigration المعطلة)
3. **Code**: `git revert <merge-sha>` على main + push → Vercel rebuild
