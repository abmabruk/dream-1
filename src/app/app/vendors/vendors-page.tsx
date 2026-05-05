"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BottomSheet, EmptyState, MetricCard, useToast } from "@/components/ui";
import type {
  CreateVendorInputType,
  UpdateVendorInputType,
  VendorContactDetail,
  VendorContactInputType,
  VendorDetail,
  VendorListItem,
} from "@/modules/vendors/vendor.schemas";

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { message: string };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json: ApiResponse<T> = await res.json().catch(() => ({ ok: false }));
  if (!res.ok || !json.ok || json.data === undefined) {
    throw new Error(json.error?.message ?? "حدث خطأ في الطلب");
  }
  return json.data;
}

interface Props {
  canManage: boolean;
}

export function VendorsPage({ canManage }: Props) {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeVendor, setActiveVendor] = useState<VendorDetail | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("search", q.trim());
        const data = await api<VendorListItem[]>(
          `/api/v1/vendors${params.size ? `?${params}` : ""}`,
        );
        setVendors(data);
      } catch (err) {
        toast(`✗ ${(err as Error).message}`, "error");
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchList(search);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, fetchList]);

  const openVendor = useCallback(
    async (id: string) => {
      setActiveId(id);
      setActiveVendor(null);
      try {
        const data = await api<VendorDetail>(`/api/v1/vendors/${id}`);
        setActiveVendor(data);
      } catch (err) {
        toast(`✗ ${(err as Error).message}`, "error");
        setActiveId(null);
      }
    },
    [toast],
  );

  const closeDetail = () => {
    setActiveId(null);
    setActiveVendor(null);
  };

  const onCreated = (vendor: VendorDetail) => {
    setCreateOpen(false);
    toast("✓ تم إنشاء المورد", "success");
    void fetchList(search);
    void openVendor(vendor.id);
  };

  const onUpdated = (vendor: VendorDetail) => {
    setActiveVendor(vendor);
    toast("✓ تم حفظ التغييرات", "success");
    void fetchList(search);
  };

  const onDeleted = () => {
    closeDetail();
    toast("✓ تم حذف المورد", "success");
    void fetchList(search);
  };

  const totalContacts = useMemo(
    () => vendors.reduce((sum, v) => sum + v.contactCount, 0),
    [vendors],
  );

  return (
    <main className="space-y-6">
      <section className="panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            الموردون
          </p>
          <h1 className="mt-2 text-3xl font-semibold">قائمة الموردين</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {vendors.length} مورد
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="button-primary"
            onClick={() => setCreateOpen(true)}
          >
            + مورد جديد
          </button>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="إجمالي الموردين" value={String(vendors.length)} />
        <MetricCard label="جهات اتصال" value={String(totalContacts)} />
        <MetricCard
          label="نشطون"
          value={String(vendors.filter((v) => !v.deletedAt).length)}
        />
      </section>

      <section className="panel">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold">الموردون</h2>
          <input
            type="search"
            className="input-field md:w-72"
            placeholder="بحث بالاسم أو الكود أو الهاتف"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
            جاري التحميل...
          </p>
        ) : vendors.length === 0 ? (
          <EmptyState
            heading="لا يوجد موردون"
            description="ابدأ بإضافة مورد جديد لتسجيل المشتريات والأسعار."
            variant="compact"
          />
        ) : (
          <>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-start text-sm">
                <thead className="text-[var(--muted-foreground)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-3 pe-4 font-medium">الاسم</th>
                    <th className="px-4 py-3 font-medium">الكود</th>
                    <th className="px-4 py-3 font-medium">المدينة</th>
                    <th className="px-4 py-3 font-medium">الهاتف</th>
                    <th className="px-4 py-3 font-medium">جهات الاتصال</th>
                    <th className="px-4 py-3 font-medium">آخر استخدام</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr
                      key={v.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`المورد ${v.name}`}
                      className="cursor-pointer border-b border-[var(--border)] last:border-b-0 hover:bg-black/4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring,#0ea5e9)]"
                      onClick={() => openVendor(v.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openVendor(v.id);
                        }
                      }}
                    >
                      <td className="py-4 pe-4">
                        <p className="font-medium">{v.name}</p>
                        {v.deletedAt && (
                          <span className="text-xs text-red-600">محذوف</span>
                        )}
                      </td>
                      <td className="px-4 py-4">{v.code ?? "—"}</td>
                      <td className="px-4 py-4">{v.city ?? "—"}</td>
                      <td className="px-4 py-4 tabular-nums">
                        {v.phone ?? "—"}
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {v.contactCount}
                      </td>
                      <td className="px-4 py-4 text-[var(--muted-foreground)]">
                        {v.lastUsedAt
                          ? new Date(v.lastUsedAt).toLocaleDateString("ar-SA")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 md:hidden">
              {vendors.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 text-start"
                  onClick={() => openVendor(v.id)}
                >
                  <p className="font-semibold">{v.name}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                    <span>الكود: {v.code ?? "—"}</span>
                    <span>المدينة: {v.city ?? "—"}</span>
                    <span>الهاتف: {v.phone ?? "—"}</span>
                    <span>جهات الاتصال: {v.contactCount}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <BottomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="إنشاء مورد"
        desktopWidth={560}
      >
        <VendorForm onSaved={onCreated} mode="create" />
      </BottomSheet>

      <BottomSheet
        open={Boolean(activeId)}
        onClose={closeDetail}
        title={activeVendor?.name ?? "تفاصيل المورد"}
        desktopWidth={640}
      >
        {!activeVendor ? (
          <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
            جاري التحميل...
          </p>
        ) : (
          <VendorDetailEditor
            vendor={activeVendor}
            canManage={canManage}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
            onContactsChanged={(updated) => setActiveVendor(updated)}
          />
        )}
      </BottomSheet>
    </main>
  );
}

// ────────────────────────────────────────────────────────────
// Vendor create / edit form
// ────────────────────────────────────────────────────────────

function VendorForm({
  initial,
  mode,
  onSaved,
}: {
  initial?: VendorDetail;
  mode: "create" | "edit";
  onSaved: (vendor: VendorDetail) => void;
}) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(event.currentTarget);
    const payload: CreateVendorInputType | UpdateVendorInputType = {
      name: String(fd.get("name") ?? "").trim(),
      code: stringOrUndef(fd.get("code")),
      taxNumber: stringOrUndef(fd.get("taxNumber")),
      email: stringOrUndef(fd.get("email")),
      phone: stringOrUndef(fd.get("phone")),
      website: stringOrUndef(fd.get("website")),
      address: stringOrUndef(fd.get("address")),
      city: stringOrUndef(fd.get("city")),
      paymentTermsDays: numberOrUndef(fd.get("paymentTermsDays")),
      preferredCurrency: stringOrUndef(fd.get("preferredCurrency")),
      notes: stringOrUndef(fd.get("notes")),
    };

    try {
      if (mode === "create") {
        const created = await api<VendorDetail>("/api/v1/vendors", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved(created);
      } else if (initial) {
        const updated = await api<VendorDetail>(
          `/api/v1/vendors/${initial.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
        onSaved(updated);
      }
    } catch (err) {
      setError((err as Error).message);
      toast(`✗ ${(err as Error).message}`, "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="name"
          label="الاسم"
          required
          defaultValue={initial?.name}
        />
        <Field name="code" label="الكود" defaultValue={initial?.code ?? ""} />
        <Field
          name="taxNumber"
          label="الرقم الضريبي"
          defaultValue={initial?.taxNumber ?? ""}
        />
        <Field name="city" label="المدينة" defaultValue={initial?.city ?? ""} />
        <Field
          name="phone"
          label="الهاتف"
          defaultValue={initial?.phone ?? ""}
        />
        <Field
          name="email"
          label="البريد الإلكتروني"
          type="email"
          defaultValue={initial?.email ?? ""}
        />
        <Field
          name="website"
          label="الموقع الإلكتروني"
          type="url"
          defaultValue={initial?.website ?? ""}
        />
        <Field
          name="paymentTermsDays"
          label="مهلة السداد (أيام)"
          type="number"
          defaultValue={initial?.paymentTermsDays?.toString() ?? ""}
        />
        <Field
          name="preferredCurrency"
          label="العملة المفضلة"
          defaultValue={initial?.preferredCurrency ?? ""}
        />
        <div className="md:col-span-2">
          <Field
            name="address"
            label="العنوان"
            defaultValue={initial?.address ?? ""}
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium" htmlFor="notes">
            ملاحظات
          </label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={initial?.notes ?? ""}
            className="input-field mt-2 min-h-24"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="button-primary"
          disabled={pending}
          onClick={(e) => {
            // Defensive: ensure submit fires on first click even if the
            // native click → submit dispatch is suppressed by the dialog
            // wrapper. Using requestSubmit triggers HTML5 validation and
            // the form's onSubmit handler exactly once.
            const form = e.currentTarget.form;
            if (!form) return;
            e.preventDefault();
            form.requestSubmit(e.currentTarget);
          }}
        >
          {pending ? "جاري الحفظ..." : mode === "create" ? "إنشاء" : "حفظ"}
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────
// Detail editor with contacts
// ────────────────────────────────────────────────────────────

function VendorDetailEditor({
  vendor,
  canManage,
  onUpdated,
  onDeleted,
  onContactsChanged,
}: {
  vendor: VendorDetail;
  canManage: boolean;
  onUpdated: (vendor: VendorDetail) => void;
  onDeleted: () => void;
  onContactsChanged: (vendor: VendorDetail) => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"info" | "contacts">("info");

  const handleDelete = async () => {
    if (!confirm("هل تريد حذف هذا المورد؟")) return;
    try {
      await api<{ id: string }>(`/api/v1/vendors/${vendor.id}`, {
        method: "DELETE",
      });
      onDeleted();
    } catch (err) {
      toast(`✗ ${(err as Error).message}`, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-[var(--border)] pb-2">
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 text-sm ${tab === "info" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "hover:bg-black/4"}`}
          onClick={() => setTab("info")}
        >
          المعلومات
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 text-sm ${tab === "contacts" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "hover:bg-black/4"}`}
          onClick={() => setTab("contacts")}
        >
          جهات الاتصال ({vendor.contacts.length})
        </button>
      </div>

      {tab === "info" ? (
        <>
          {canManage ? (
            <VendorForm initial={vendor} mode="edit" onSaved={onUpdated} />
          ) : (
            <ReadOnlyVendor vendor={vendor} />
          )}
          {canManage && !vendor.deletedAt && (
            <button
              type="button"
              className="button-secondary text-red-700"
              onClick={handleDelete}
            >
              حذف المورد
            </button>
          )}
        </>
      ) : (
        <ContactsManager
          vendor={vendor}
          canManage={canManage}
          onChanged={onContactsChanged}
        />
      )}
    </div>
  );
}

function ReadOnlyVendor({ vendor }: { vendor: VendorDetail }) {
  const rows: Array<[string, string | number | null]> = [
    ["الكود", vendor.code],
    ["الرقم الضريبي", vendor.taxNumber],
    ["الهاتف", vendor.phone],
    ["البريد الإلكتروني", vendor.email],
    ["المدينة", vendor.city],
    ["العنوان", vendor.address],
    ["مهلة السداد", vendor.paymentTermsDays],
    ["العملة المفضلة", vendor.preferredCurrency],
    ["ملاحظات", vendor.notes],
  ];
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-2xl border border-[var(--border)] p-3">
          <dt className="text-xs text-[var(--muted-foreground)]">{k}</dt>
          <dd className="mt-1 text-sm">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ContactsManager({
  vendor,
  canManage,
  onChanged,
}: {
  vendor: VendorDetail;
  canManage: boolean;
  onChanged: (vendor: VendorDetail) => void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    const updated = await api<VendorDetail>(`/api/v1/vendors/${vendor.id}`);
    onChanged(updated);
  };

  const addContact = async (input: VendorContactInputType) => {
    try {
      await api<VendorContactDetail>(`/api/v1/vendors/${vendor.id}/contacts`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      setAdding(false);
      await refresh();
      toast("✓ تمت إضافة جهة الاتصال", "success");
    } catch (err) {
      toast(`✗ ${(err as Error).message}`, "error");
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm("حذف جهة الاتصال؟")) return;
    try {
      await api<{ id: string }>(
        `/api/v1/vendors/${vendor.id}/contacts/${contactId}`,
        { method: "DELETE" },
      );
      await refresh();
      toast("✓ تم الحذف", "success");
    } catch (err) {
      toast(`✗ ${(err as Error).message}`, "error");
    }
  };

  return (
    <div className="space-y-3">
      {vendor.contacts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--muted-foreground)]">
          لا توجد جهات اتصال
        </p>
      ) : (
        <ul className="space-y-2">
          {vendor.contacts.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3"
            >
              <div>
                <p className="font-medium">
                  {c.name}
                  {c.isPrimary && (
                    <span className="ms-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs text-[var(--accent-foreground)]">
                      رئيسي
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {[c.role, c.email, c.phone].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  className="text-xs text-red-700 hover:underline"
                  onClick={() => deleteContact(c.id)}
                >
                  حذف
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <>
          {adding ? (
            <ContactForm
              onCancel={() => setAdding(false)}
              onSubmit={addContact}
            />
          ) : (
            <button
              type="button"
              className="button-secondary"
              onClick={() => setAdding(true)}
            >
              + إضافة جهة اتصال
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ContactForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (input: VendorContactInputType) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      await onSubmit({
        name: String(fd.get("name") ?? "").trim(),
        role: stringOrUndef(fd.get("role")),
        email: stringOrUndef(fd.get("email")),
        phone: stringOrUndef(fd.get("phone")),
        isPrimary: fd.get("isPrimary") === "on",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-[var(--border)] p-4"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="name" label="الاسم" required />
        <Field name="role" label="الدور" />
        <Field name="email" label="البريد الإلكتروني" type="email" />
        <Field name="phone" label="الهاتف" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPrimary" /> جهة اتصال رئيسية
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="button-secondary" onClick={onCancel}>
          إلغاء
        </button>
        <button type="submit" className="button-primary" disabled={pending}>
          {pending ? "..." : "إضافة"}
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function Field({
  name,
  label,
  type = "text",
  required = false,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
        {required && (
          <span className="field-required" aria-hidden>
            *
          </span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="input-field"
      />
    </div>
  );
}

function stringOrUndef(v: FormDataEntryValue | null): string | undefined {
  if (v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function numberOrUndef(v: FormDataEntryValue | null): number | undefined {
  const s = stringOrUndef(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
