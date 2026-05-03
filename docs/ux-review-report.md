# UX/UI Review Report — Dream 1 Factory Management System

**Date:** 2026-04-29
**Tested by:** Claude (automated via Chrome DevTools MCP)
**User:** owner@dream1.local (OWNER role)
**Server:** localhost:2500
**Browser:** Chrome (Desktop 1440x900, Mobile 375x812)

---

## Summary

All 14 pages were tested on desktop and key pages on mobile. The app is **fully functional** — no JS errors, no failed API calls, no console errors on any page. The Arabic RTL layout is well-implemented overall. The main issues are mobile responsiveness on complex pages.

### Results Overview

| Page | Desktop | Mobile | Console Errors |
|------|---------|--------|----------------|
| Dashboard `/app` | ✅ | ✅ | None |
| Orders `/app/orders` | ✅ | ✅ | None |
| Customers `/app/customers` | ✅ | ✅ | None |
| Projects `/app/projects` | ✅ | ✅ | None |
| CRM `/app/crm` | ✅ | ✅ | None |
| Operations `/app/ops` | ✅ | 🔴 Broken | 1 Issue (Next.js) |
| Finance `/app/finance` | ✅ | ✅ | None |
| Reports `/app/reports` | ✅ | 🟡 Partial | None |
| Notifications `/app/notifications` | ✅ | ✅ | None |
| Users `/app/users` | ✅ | ✅ | None |
| Settings `/app/settings` | ✅ | ✅ | None |
| Stage Settings `/app/settings/stages` | ✅ | ✅ | None |
| Floor Display `/floor` | ✅ | 🟡 Not responsive | None |
| Sign In `/sign-in` | ✅ | ✅ | None |

---

## Bug Report

### 🔴 Critical

#### BUG-001: Operations page completely blank on mobile
- **Page:** `/app/ops`
- **Action:** Navigate to Operations on mobile (375px)
- **Expected:** Widgets (queue, projects, team status) should display in a stacked layout
- **Actual:** Page appears completely blank — white screen with only the navbar visible. Content exists in the DOM (confirmed via a11y snapshot) but is positioned off-screen.
- **Screenshot:** `docs/screenshots/m03-ops-mobile.png`
- **Root cause:** The ops dashboard uses a widget grid layout (likely CSS Grid or a drag-and-drop library) that doesn't collapse to a single column on narrow viewports. Widgets are rendered but overflow outside the visible area.
- **Fix suggestion:** Add responsive breakpoints to the ops widget grid:
  ```css
  @media (max-width: 768px) {
    .ops-grid {
      grid-template-columns: 1fr !important;
      width: 100% !important;
    }
    .ops-widget {
      width: 100% !important;
      min-width: unset !important;
    }
  }
  ```

---

### 🟡 Important

#### BUG-002: Floor display not responsive on mobile
- **Page:** `/floor`
- **Action:** View on mobile (375px)
- **Expected:** Layout should adapt — cards stack vertically, text remains readable
- **Actual:** Desktop layout renders unchanged at 375px. Metric cards, queue items, and project sections maintain 3-column layout, causing horizontal overflow. Text is small but still readable.
- **Screenshot:** `docs/screenshots/m06-floor-mobile.png`
- **Note:** Floor display is designed for TV/kiosk use, so mobile support may be intentionally low priority. However, supervisors may check it on phones.
- **Fix suggestion:** Add a mobile breakpoint that stacks sections vertically:
  ```css
  @media (max-width: 768px) {
    .floor-grid {
      grid-template-columns: 1fr;
    }
    .floor-metrics {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  ```

#### BUG-003: Reports daily activity table truncated on mobile
- **Page:** `/app/reports`
- **Action:** Scroll to "الحركة يومياً بيوم" (Daily Activity) table on mobile
- **Expected:** Table columns should be fully visible or horizontally scrollable
- **Actual:** Last column header is clipped ("الا... المض..." instead of "الاستفسارات المضافة"). No horizontal scroll indicator.
- **Screenshot:** `docs/screenshots/m05-reports-mobile.png`
- **Fix suggestion:** Wrap the table in `overflow-x: auto` container:
  ```jsx
  <div className="overflow-x-auto -mx-4 px-4">
    <table className="min-w-[500px]">...</table>
  </div>
  ```

---

### 🟢 Nice-to-have

#### UX-001: Mobile navbar overlaps content
- **Page:** All pages on mobile
- **Observation:** The floating navbar (hamburger + "دريم ١" + bell icon) is positioned in the middle-right of the viewport, overlapping page content. It stays fixed during scroll.
- **Suggestion:** Move navbar to top of page as a sticky header, or reduce its z-index overlap area.

#### UX-002: Dashboard metric cards — "المسلّمة" shows dot instead of zero
- **Page:** `/app` (Dashboard)
- **Observation:** The "المسلّمة" (Delivered) card shows a small teal dot with "مكتملة" text instead of displaying "0" like the other cards. Inconsistent visual pattern.
- **Suggestion:** Show "٠" consistently when the value is zero.

#### UX-003: Orders table on desktop could benefit from row hover state
- **Page:** `/app/orders`
- **Observation:** Order rows in the desktop table don't have hover feedback. Users may not realize rows are clickable.
- **Suggestion:** Add `hover:bg-gray-50` to table rows.

#### UX-004: CRM pipeline cards — empty stage text could be more prominent
- **Page:** `/app/crm`
- **Observation:** Empty pipeline stages show "لا توجد استفسارات في هذه المرحلة." in small gray text. Could use a visual empty state.
- **Suggestion:** Add a dashed border placeholder or icon.

#### UX-005: Settings page — form fields are read-only but look editable
- **Page:** `/app/settings`
- **Observation:** Some info fields (factory name, slug, dates) in the "مساحة العمل الحالية" section look like form inputs but are read-only display values. Could confuse users.
- **Suggestion:** Use a different visual style (no border, background color) for display-only values vs editable fields.

#### UX-006: Activity log in Ops uses English text
- **Page:** `/app/ops`
- **Observation:** The activity log entries use English: "Task ... moved to in progress", "Project PRJ-00005 created", "Daily queue reordered for 2026-04-28". The rest of the UI is Arabic.
- **Suggestion:** Translate activity log messages to Arabic for consistency.

---

## Visual Design Review (Desktop)

### Strengths
- **RTL support:** Excellent. All pages properly flow right-to-left. Arabic text renders cleanly.
- **Typography:** Consistent font hierarchy — large bold headings, medium subheadings, regular body text. Arabic numerals (٢، ٣، ٤) used correctly.
- **Color system:** Clean teal/green primary color with orange accents for warnings. Red for blocked/stopped states. Consistent across all pages.
- **Card-based layout:** Effective use of bordered cards with generous padding. Good visual breathing room.
- **Status badges:** Clear color-coded status indicators (مسودة = gray, بانتظار العرض = orange, قيد التنفيذ = green).
- **Sidebar navigation:** Well-organized with clear labels. User info displayed at top. Sign-out button clearly visible.
- **Ops dashboard:** The widget-based layout with drag handles, resize, collapse, and remove controls is powerful and well-executed.

### Areas for Improvement
- **Spacing consistency:** Some pages have tighter spacing between cards than others (compare Dashboard vs Projects).
- **Empty states:** Most empty states just show text. Could benefit from illustrations or icons.
- **Loading states:** Not observed during testing (pages loaded fast). Verify skeleton screens exist for slow connections.
- **Focus states:** Not tested via automation. Manual keyboard navigation test recommended.

---

## Mobile Design Review (375px)

### Strengths
- **Orders page:** Automatically converts from table to card layout on mobile. Well done.
- **Hamburger menu:** Sidebar collapses to a clean hamburger + notification bell on mobile.
- **Finance page:** Filters and project list adapt well to narrow viewport.
- **Form layouts:** Create forms (orders, customers, users) stack inputs vertically on mobile. Good.

### Issues
- **Ops page is completely broken** (BUG-001) — highest priority fix.
- **Floor display doesn't adapt** (BUG-002) — lower priority if kiosk-only.
- **Reports tables overflow** (BUG-003) — needs horizontal scroll wrapper.
- **Navbar position** (UX-001) — floating navbar overlaps content.

---

## Accessibility Notes

- **Color contrast:** Primary teal text on white background appears to have adequate contrast. Red (متوقف) on white is good. Orange badges may need contrast check.
- **Touch targets:** Most buttons appear >= 44px on mobile. The small up/down arrows in Stages table may be too small.
- **Semantic HTML:** Good use of headings hierarchy (`h1` for page titles, `h2`/`h3` for sections). Links and buttons are properly labeled.
- **ARIA:** Status badges use appropriate `role` attributes. Live regions present for dynamic updates.

---

## Priority Fix Recommendations

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 P0 | BUG-001: Ops page blank on mobile | Medium — CSS grid responsive fix |
| 🟡 P1 | BUG-003: Reports table overflow on mobile | Small — add `overflow-x-auto` |
| 🟡 P1 | UX-006: Activity log English text | Medium — i18n for log messages |
| 🟡 P2 | BUG-002: Floor display not responsive | Medium — add mobile breakpoints |
| 🟢 P3 | UX-001: Navbar overlap on mobile | Small — CSS position fix |
| 🟢 P3 | UX-002: Inconsistent zero display | Small — conditional render |
| 🟢 P3 | UX-003-005: Various polish items | Small each |

---

## Screenshots Index

### Desktop (1440px)
| # | Page | File |
|---|------|------|
| 1 | Dashboard | `docs/screenshots/01-dashboard.png` |
| 2 | Orders | `docs/screenshots/02-orders.png` |
| 3 | Customers | `docs/screenshots/03-customers.png` |
| 4 | Projects | `docs/screenshots/04-projects.png` |
| 5 | CRM | `docs/screenshots/05-crm.png` |
| 6 | Operations | `docs/screenshots/06-ops.png` |
| 7 | Finance | `docs/screenshots/07-finance.png` |
| 8 | Reports | `docs/screenshots/08-reports.png` |
| 9 | Notifications | `docs/screenshots/09-notifications.png` |
| 10 | Users | `docs/screenshots/10-users.png` |
| 11 | Settings | `docs/screenshots/11-settings.png` |
| 12 | Stage Settings | `docs/screenshots/12-stages.png` |
| 13 | Floor Display | `docs/screenshots/13-floor.png` |

### Mobile (375px)
| # | Page | File |
|---|------|------|
| M1 | Dashboard | `docs/screenshots/m01-dashboard-mobile.png` |
| M2 | Orders | `docs/screenshots/m02-orders-mobile.png` |
| M3 | Operations | `docs/screenshots/m03-ops-mobile.png` |
| M4 | Finance | `docs/screenshots/m04-finance-mobile.png` |
| M5 | Reports | `docs/screenshots/m05-reports-mobile.png` |
| M6 | Floor Display | `docs/screenshots/m06-floor-mobile.png` |
