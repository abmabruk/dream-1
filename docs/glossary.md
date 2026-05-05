# Dream-1 Glossary — Arabic ↔ English naming conventions

This file is the canonical source for naming. ALL new code (UI labels,
notification text, error messages, API responses) MUST use these terms.
When adding a new entity, update this file BEFORE writing the model.

## Core entities

| English (code) | Arabic (UI) | Notes |
|---|---|---|
| Factory | المصنع | tenant root |
| User | المستخدم | staff or customer |
| Role: OWNER | المالك | full admin |
| Role: FACTORY_MANAGER | مدير المصنع | full ops control |
| Role: SALES_MANAGER | مدير المبيعات | CRM + quotes |
| Role: SUPERVISOR | المشرف | floor + ops |
| Role: WORKER | العامل | task execution |
| Role: ACCOUNTANT | المحاسب | finance + invoicing |
| Role: CUSTOMER | العميل | external |
| Inquiry | استفسار / فرصة بيعية | CRM lead, pre-Customer |
| Customer | العميل | post-conversion |
| Order | الطلب | the contract / deal |
| Project | المشروع | execution unit (1+ per Order) |
| ProjectStage | مرحلة المشروع | template stage |
| ProjectStageInstance | مرحلة المشروع | per-project stage instance |
| Location | الموقع / الغرفة | room or area within Project |
| ProjectTask | المهمة | work item |
| WorkQueueItem | طابور اليوم | today's scheduled task |
| Assignment | تكليف | worker → station |
| AttendanceRecord | الحضور | clock in/out |

## Financial entities (added in Phase 2-4)

| English (code) | Arabic (UI) | Notes |
|---|---|---|
| Quote | عرض السعر | internal offer |
| QuoteLine | بند عرض السعر | line item |
| Quote status: DRAFT | مسودة | |
| Quote status: SENT | مُرسَل | sent (internally) |
| Quote status: APPROVED | معتمد | internal approval |
| Quote status: REJECTED | مرفوض | |
| Quote status: SUPERSEDED | مستبدل | replaced by new version |
| Quote status: CANCELLED | ملغي | |
| Quote status: EXPIRED | منتهي الصلاحية | past validUntil |
| Vendor | المورّد | supplier |
| VendorContact | جهة اتصال المورّد | |
| Product | المنتج | catalog item |
| ProductVariant | متغيّر المنتج | size/color/etc |
| ProjectCost | التكلفة | actual spend |
| CostCategory: MATERIAL | مواد | |
| CostCategory: LABOR | عمالة | |
| CostCategory: SERVICE | خدمات | |
| CostCategory: OVERHEAD | مصاريف عامة | |
| CostCategory: OTHER | أخرى | |
| Invoice | الفاتورة | customer-facing tax invoice |
| InvoiceLine | بند الفاتورة | |
| Invoice status: DRAFT | مسودة | |
| Invoice status: SENT | مُرسَلة | |
| Invoice status: PARTIALLY_PAID | مدفوعة جزئياً | |
| Invoice status: PAID | مدفوعة | |
| Invoice status: OVERDUE | متأخرة | past dueDate |
| Invoice status: VOID | ملغاة | reversed |
| Payment | دفعة | money received |
| Payment kind: PAYMENT | دفعة | normal |
| Payment kind: REFUND | استرداد | reverse |
| Payment kind: ADJUSTMENT | تسوية | manual correction |
| PaymentAllocation | توزيع الدفعة | payment ↔ invoices |
| CreditNote | إشعار دائن | ZATCA-mandated credit doc |
| DebitNote | إشعار مدين | ZATCA-mandated debit doc |

## Audit & system

| English (code) | Arabic (UI) | Notes |
|---|---|---|
| AuditLog | سجل التدقيق | security events |
| Notification | الإشعار | |
| Permission | الصلاحية | |
| Session | الجلسة | |

## Conventions

### Numbers
- **Display**: Western digits (0-9), NOT Arabic-Indic (٠-٩). Reason: clearer for accounting + matches invoice/PDF expectations. Use `Intl.NumberFormat("en", { useGrouping: true })` for thousands separator.
- **Currency display**: Use `formatSAR()` from `src/lib/format.ts`. Format: "1,500.00 ر.س" (or "ر.س. 1,500.00" depending on direction).

### Dates
- **Default**: Gregorian (`Intl.DateTimeFormat("ar-SA-u-ca-gregory", ...)`)
- **On invoices/legal docs**: Show BOTH Gregorian and Hijri side by side (Phase 4a)
- **Storage**: ISO 8601 UTC in DB; render in Asia/Riyadh timezone (Factory.timezone)

### Code naming
- **Prisma model names**: PascalCase singular (`Quote`, `QuoteLine`, NOT `Quotes`)
- **Field names**: camelCase (`quotedAmount`, NOT `quoted_amount`)
- **Enum values**: SCREAMING_SNAKE_CASE (`APPROVED`, `IN_PROGRESS`)
- **Status enums**: include explicit `_PENDING`/`_FAILED` rather than relying on bool flags
- **Money fields**: `Decimal(14,2)` for amounts, `Decimal(14,4)` for unit prices
- **FK fields**: `<entity>Id` (e.g. `quoteId`, `invoiceId`)
- **Timestamps**: `createdAt`, `updatedAt`, `<verb>At` for events (`approvedAt`, `paidAt`)
- **Soft delete**: `deletedAt DateTime?` (NOT a `deleted Boolean`)

### File naming
- **Modules**: `src/modules/<domain>/<entity>.{repository,service,schemas}.ts`
- **API routes**: `src/app/api/v1/<resource>/route.ts` (pluralize: `quotes`, `invoices`)
- **Tests**: `*.test.ts` for unit, `*.integration.test.ts` for DB-backed

### Notification copy
- Always Arabic, full sentence, with the entity in context
- Example: "تم اعتماد عرض السعر #2 للطلب ORD-00042"
- NOT: "Quote 2 approved" or "تم الاعتماد"

### Error messages (user-facing)
- Always Arabic
- Concise but complete
- Example: "ليس لديك صلاحية إدارة الفواتير."
- NOT: "Forbidden" or English-mixed

## Add a new term?

When adding a new entity:
1. Add to this glossary FIRST
2. Use the Arabic term consistently in all UI/notifications/errors
3. Use the English code name in Prisma + TypeScript
4. PR review checklist: "Did you add the new term to glossary.md?"
