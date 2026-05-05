import type { InvoiceDetail } from "@/modules/invoices/invoice.schemas";
import { INVOICE_STATUS_LABELS_AR } from "@/modules/invoices/invoice.schemas";

const CURRENCY_AR = "ر.س";

function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value: string | number | null | undefined): string {
  if (value == null || value === "") return "0.00";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQty(value: string | number | null | undefined): string {
  if (value == null || value === "") return "0";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  // Show up to 4 decimals, strip trailing zeros
  const fixed = n.toFixed(4);
  return fixed.replace(/\.?0+$/, "");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return escapeHtml(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Render an invoice as a standalone, printable HTML document.
 * Designed for browser print preview (Cmd+P) → PDF export.
 * RTL Arabic layout, Western digits, currency in ر.س.
 */
export function renderInvoiceHtml(invoice: InvoiceDetail): string {
  const sellerName = escapeHtml(invoice.sellerNameSnapshot ?? "—");
  const sellerTax = escapeHtml(invoice.sellerTaxNumberSnapshot ?? "");
  const sellerAddr = escapeHtml(invoice.sellerAddressSnapshot ?? "");

  const buyerName = escapeHtml(invoice.buyerNameSnapshot ?? "—");
  const buyerTax = escapeHtml(invoice.buyerTaxNumberSnapshot ?? "");
  const buyerAddr = escapeHtml(invoice.buyerAddressSnapshot ?? "");

  const number = escapeHtml(invoice.number);
  const issueDate = formatDate(invoice.issueDate);
  const dueDate = formatDate(invoice.dueDate);
  const statusLabel = INVOICE_STATUS_LABELS_AR[invoice.status] ?? invoice.status;

  const taxRatePct = (() => {
    const n = Number(invoice.taxRate);
    if (!Number.isFinite(n)) return invoice.taxRate;
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  })();

  const lineRows = invoice.lines
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line, idx) => {
      const desc = escapeHtml(line.description);
      const sku = line.sku ? `<div class="muted">SKU: ${escapeHtml(line.sku)}</div>` : "";
      return `
        <tr>
          <td class="num">${idx + 1}</td>
          <td>${desc}${sku}</td>
          <td class="num">${formatQty(line.quantity)}</td>
          <td class="num">${formatMoney(line.unitPrice)}</td>
          <td class="num">${formatMoney(line.lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  const notesBlock = invoice.notes
    ? `<section class="notes">
         <h3>ملاحظات</h3>
         <p>${escapeHtml(invoice.notes)}</p>
       </section>`
    : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>فاتورة ${number}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    --ink: #111827;
    --muted: #6b7280;
    --line: #e5e7eb;
    --accent: #1f2937;
    --bg-soft: #f9fafb;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #f3f4f6;
    color: var(--ink);
    font-family: 'IBM Plex Sans Arabic', 'Tahoma', 'Arial', sans-serif;
    font-size: 13px;
    line-height: 1.5;
  }
  .page {
    max-width: 210mm;
    min-height: 297mm;
    margin: 16px auto;
    padding: 20mm;
    background: #fff;
    box-shadow: 0 1px 6px rgba(0,0,0,0.08);
  }
  .toolbar {
    max-width: 210mm;
    margin: 12px auto 0;
    padding: 0 20mm;
    display: flex;
    gap: 8px;
    justify-content: flex-start;
  }
  .toolbar button {
    background: var(--accent);
    color: #fff;
    border: 0;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
  }
  .toolbar button.secondary {
    background: #fff;
    color: var(--accent);
    border: 1px solid var(--line);
  }
  header.invoice-head {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid var(--accent);
  }
  .seller h1 {
    margin: 0 0 6px;
    font-size: 18px;
    color: var(--accent);
  }
  .seller .line { color: var(--muted); }
  .meta {
    text-align: left;
  }
  .meta h2 {
    margin: 0 0 6px;
    font-size: 22px;
    color: var(--accent);
  }
  .meta .row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 2px 0;
    font-size: 12px;
  }
  .meta .row .k { color: var(--muted); }
  .badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--bg-soft);
    border: 1px solid var(--line);
    font-size: 12px;
    color: var(--accent);
  }
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin: 18px 0;
  }
  .party {
    background: var(--bg-soft);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px 14px;
  }
  .party h3 {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--muted);
    font-weight: 600;
  }
  .party .name { font-weight: 700; font-size: 14px; }
  .party .line { color: var(--muted); font-size: 12px; }
  table.lines {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  table.lines thead th {
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    text-align: right;
    padding: 8px 10px;
    font-size: 12px;
  }
  table.lines tbody td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
    font-size: 12px;
  }
  table.lines .num { text-align: left; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.lines tbody tr:nth-child(even) { background: var(--bg-soft); }
  .muted { color: var(--muted); font-size: 11px; }
  .totals-wrap {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 16px;
    margin-top: 18px;
  }
  .totals {
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .totals .row {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    font-size: 13px;
  }
  .totals .row + .row { border-top: 1px solid var(--line); }
  .totals .row.grand {
    background: var(--accent);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
  }
  .totals .row .v { font-variant-numeric: tabular-nums; }
  section.notes {
    margin-top: 18px;
    padding: 12px 14px;
    background: var(--bg-soft);
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  section.notes h3 {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--muted);
  }
  section.notes p { margin: 0; white-space: pre-wrap; }
  footer.invoice-foot {
    margin-top: 28px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    text-align: center;
    color: var(--muted);
    font-size: 11px;
  }

  @media print {
    html, body { background: #fff; }
    .toolbar { display: none !important; }
    .page {
      margin: 0;
      box-shadow: none;
      max-width: none;
      min-height: 0;
      padding: 0;
    }
    @page {
      size: A4;
      margin: 20mm;
    }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">طباعة / حفظ PDF</button>
    <button class="secondary" onclick="window.close()">إغلاق</button>
  </div>
  <div class="page">
    <header class="invoice-head">
      <div class="seller">
        <h1>${sellerName}</h1>
        ${sellerTax ? `<div class="line">الرقم الضريبي: ${sellerTax}</div>` : ""}
        ${sellerAddr ? `<div class="line">${sellerAddr}</div>` : ""}
      </div>
      <div class="meta">
        <h2>فاتورة ضريبية</h2>
        <div class="row"><span class="k">رقم الفاتورة</span><span class="v">${number}</span></div>
        <div class="row"><span class="k">تاريخ الإصدار</span><span class="v">${issueDate}</span></div>
        <div class="row"><span class="k">تاريخ الاستحقاق</span><span class="v">${dueDate}</span></div>
        <div class="row"><span class="k">الحالة</span><span class="v"><span class="badge">${escapeHtml(statusLabel)}</span></span></div>
      </div>
    </header>

    <section class="parties">
      <div class="party">
        <h3>البائع</h3>
        <div class="name">${sellerName}</div>
        ${sellerTax ? `<div class="line">الرقم الضريبي: ${sellerTax}</div>` : ""}
        ${sellerAddr ? `<div class="line">${sellerAddr}</div>` : ""}
      </div>
      <div class="party">
        <h3>المشتري</h3>
        <div class="name">${buyerName}</div>
        ${buyerTax ? `<div class="line">الرقم الضريبي: ${buyerTax}</div>` : ""}
        ${buyerAddr ? `<div class="line">${buyerAddr}</div>` : ""}
      </div>
    </section>

    <table class="lines">
      <thead>
        <tr>
          <th style="width:40px">#</th>
          <th>الوصف</th>
          <th style="width:90px" class="num">الكمية</th>
          <th style="width:120px" class="num">سعر الوحدة (${CURRENCY_AR})</th>
          <th style="width:130px" class="num">الإجمالي (${CURRENCY_AR})</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows || `<tr><td colspan="5" class="muted" style="text-align:center; padding:18px">لا توجد بنود</td></tr>`}
      </tbody>
    </table>

    <div class="totals-wrap">
      <div></div>
      <div class="totals">
        <div class="row"><span class="k">الإجمالي قبل الضريبة</span><span class="v">${formatMoney(invoice.subtotal)} ${CURRENCY_AR}</span></div>
        <div class="row"><span class="k">الخصم</span><span class="v">${formatMoney(invoice.discountAmount)} ${CURRENCY_AR}</span></div>
        <div class="row"><span class="k">ضريبة القيمة المضافة (${taxRatePct}%)</span><span class="v">${formatMoney(invoice.taxAmount)} ${CURRENCY_AR}</span></div>
        <div class="row grand"><span class="k">الإجمالي المستحق</span><span class="v">${formatMoney(invoice.total)} ${CURRENCY_AR}</span></div>
        <div class="row"><span class="k">المدفوع</span><span class="v">${formatMoney(invoice.amountPaid)} ${CURRENCY_AR}</span></div>
        <div class="row"><span class="k">المتبقي</span><span class="v">${formatMoney(invoice.amountDue)} ${CURRENCY_AR}</span></div>
      </div>
    </div>

    ${notesBlock}

    <footer class="invoice-foot">
      تم إصدار الفاتورة بواسطة Dream 1
    </footer>
  </div>
</body>
</html>`;
}
