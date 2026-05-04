"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BottomSheet, EmptyState, MetricCard, useToast } from "@/components/ui";
import { formatSAR } from "@/lib/format";
import type {
  CreateProductInputType,
  ProductDetail,
  ProductListItem,
  UpdateProductInputType,
  VariantDetail,
  VariantInputType,
} from "@/modules/products/product.schemas";

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

export function ProductsPage({ canManage }: Props) {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<ProductDetail | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = useCallback(
    async (q: string, cat: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("search", q.trim());
        if (cat) params.set("category", cat);
        const data = await api<ProductListItem[]>(
          `/api/v1/products${params.size ? `?${params}` : ""}`,
        );
        setProducts(data);
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
      void fetchList(search, category);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, category, fetchList]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(p.category);
    return Array.from(set).sort();
  }, [products]);

  const openProduct = useCallback(
    async (id: string) => {
      setActiveId(id);
      setActiveProduct(null);
      try {
        const data = await api<ProductDetail>(`/api/v1/products/${id}`);
        setActiveProduct(data);
      } catch (err) {
        toast(`✗ ${(err as Error).message}`, "error");
        setActiveId(null);
      }
    },
    [toast],
  );

  const closeDetail = () => {
    setActiveId(null);
    setActiveProduct(null);
  };

  const onCreated = (product: ProductDetail) => {
    setCreateOpen(false);
    toast("✓ تم إنشاء المنتج", "success");
    void fetchList(search, category);
    void openProduct(product.id);
  };

  const onUpdated = (product: ProductDetail) => {
    setActiveProduct(product);
    toast("✓ تم حفظ التغييرات", "success");
    void fetchList(search, category);
  };

  const onDeleted = () => {
    closeDetail();
    toast("✓ تم حذف المنتج", "success");
    void fetchList(search, category);
  };

  const totalVariants = useMemo(
    () => products.reduce((s, p) => s + p.variantCount, 0),
    [products],
  );

  return (
    <main className="space-y-6">
      <section className="panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            المنتجات
          </p>
          <h1 className="mt-2 text-3xl font-semibold">كتالوج المنتجات</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {products.length} منتج
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="button-primary"
            onClick={() => setCreateOpen(true)}
          >
            + منتج جديد
          </button>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="إجمالي المنتجات" value={String(products.length)} />
        <MetricCard label="عدد المتغيرات" value={String(totalVariants)} />
        <MetricCard label="الفئات" value={String(categories.length)} />
      </section>

      <section className="panel">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold">المنتجات</h2>
          <div className="flex flex-col gap-2 md:flex-row">
            <select
              className="input-field md:w-56"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">كل الفئات</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="search"
              className="input-field md:w-72"
              placeholder="بحث بالكود أو الاسم"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
            جاري التحميل...
          </p>
        ) : products.length === 0 ? (
          <EmptyState
            heading="لا توجد منتجات"
            description="ابدأ بإضافة منتج لإدارة الكتالوج وعروض الأسعار."
            variant="compact"
          />
        ) : (
          <>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-start text-sm">
                <thead className="text-[var(--muted-foreground)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-3 pe-4 font-medium">الكود</th>
                    <th className="px-4 py-3 font-medium">الاسم</th>
                    <th className="px-4 py-3 font-medium">الفئة</th>
                    <th className="px-4 py-3 font-medium">الوسوم</th>
                    <th className="px-4 py-3 font-medium">السعر</th>
                    <th className="px-4 py-3 font-medium">المتغيرات</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer border-b border-[var(--border)] last:border-b-0 hover:bg-black/4"
                      onClick={() => openProduct(p.id)}
                    >
                      <td className="py-4 pe-4 font-mono text-xs">
                        {p.code}
                      </td>
                      <td className="px-4 py-4 font-medium">{p.name}</td>
                      <td className="px-4 py-4">{p.category ?? "—"}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {p.tags.length === 0 ? (
                            <span className="text-[var(--muted-foreground)]">
                              —
                            </span>
                          ) : (
                            p.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs"
                              >
                                {t}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {formatSAR(p.defaultUnitPrice)}
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {p.variantCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 md:hidden">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 text-start"
                  onClick={() => openProduct(p.id)}
                >
                  <p className="font-mono text-xs text-[var(--muted-foreground)]">
                    {p.code}
                  </p>
                  <p className="mt-1 font-semibold">{p.name}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                    <span>الفئة: {p.category ?? "—"}</span>
                    <span>السعر: {formatSAR(p.defaultUnitPrice)}</span>
                    <span>المتغيرات: {p.variantCount}</span>
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
        title="إنشاء منتج"
        desktopWidth={560}
      >
        <ProductForm onSaved={onCreated} mode="create" />
      </BottomSheet>

      <BottomSheet
        open={Boolean(activeId)}
        onClose={closeDetail}
        title={activeProduct?.name ?? "تفاصيل المنتج"}
        desktopWidth={640}
      >
        {!activeProduct ? (
          <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
            جاري التحميل...
          </p>
        ) : (
          <ProductDetailEditor
            product={activeProduct}
            canManage={canManage}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
            onVariantsChanged={(p) => setActiveProduct(p)}
          />
        )}
      </BottomSheet>
    </main>
  );
}

// ────────────────────────────────────────────────────────────
// Product create / edit form
// ────────────────────────────────────────────────────────────

function ProductForm({
  initial,
  mode,
  onSaved,
}: {
  initial?: ProductDetail;
  mode: "create" | "edit";
  onSaved: (p: ProductDetail) => void;
}) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(event.currentTarget);
    const tagsRaw = String(fd.get("tags") ?? "").trim();
    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;
    const payload: CreateProductInputType | UpdateProductInputType = {
      code: String(fd.get("code") ?? "").trim(),
      name: String(fd.get("name") ?? "").trim(),
      description: stringOrUndef(fd.get("description")),
      category: stringOrUndef(fd.get("category")),
      tags,
      defaultUnitPrice: numberOrZero(fd.get("defaultUnitPrice")),
      estimatedUnitCost: numberOrUndef(fd.get("estimatedUnitCost")),
      currency: stringOrUndef(fd.get("currency")),
      lowStockThreshold: intOrUndef(fd.get("lowStockThreshold")),
    };

    try {
      if (mode === "create") {
        const created = await api<ProductDetail>("/api/v1/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved(created);
      } else if (initial) {
        const updated = await api<ProductDetail>(
          `/api/v1/products/${initial.id}`,
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
          name="code"
          label="الكود"
          required
          defaultValue={initial?.code}
        />
        <Field
          name="name"
          label="الاسم"
          required
          defaultValue={initial?.name}
        />
        <Field
          name="category"
          label="الفئة"
          defaultValue={initial?.category ?? ""}
        />
        <Field
          name="tags"
          label="الوسوم (مفصولة بفواصل)"
          defaultValue={initial?.tags?.join(", ") ?? ""}
        />
        <Field
          name="defaultUnitPrice"
          label="سعر الوحدة الافتراضي"
          type="number"
          step="0.0001"
          required
          defaultValue={initial?.defaultUnitPrice ?? "0"}
        />
        <Field
          name="estimatedUnitCost"
          label="تكلفة الوحدة المقدرة"
          type="number"
          step="0.0001"
          defaultValue={initial?.estimatedUnitCost ?? ""}
        />
        <Field
          name="currency"
          label="العملة"
          defaultValue={initial?.currency ?? "SAR"}
        />
        <Field
          name="lowStockThreshold"
          label="حد التنبيه للمخزون"
          type="number"
          defaultValue={initial?.lowStockThreshold?.toString() ?? ""}
        />
        <div className="md:col-span-2">
          <label className="text-sm font-medium" htmlFor="description">
            الوصف
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={initial?.description ?? ""}
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
        <button type="submit" className="button-primary" disabled={pending}>
          {pending ? "جاري الحفظ..." : mode === "create" ? "إنشاء" : "حفظ"}
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────
// Detail editor with variants
// ────────────────────────────────────────────────────────────

function ProductDetailEditor({
  product,
  canManage,
  onUpdated,
  onDeleted,
  onVariantsChanged,
}: {
  product: ProductDetail;
  canManage: boolean;
  onUpdated: (p: ProductDetail) => void;
  onDeleted: () => void;
  onVariantsChanged: (p: ProductDetail) => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"info" | "variants">("info");

  const handleDelete = async () => {
    if (!confirm("هل تريد حذف هذا المنتج؟")) return;
    try {
      await api<{ id: string }>(`/api/v1/products/${product.id}`, {
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
          className={`rounded-full px-4 py-1.5 text-sm ${tab === "variants" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "hover:bg-black/4"}`}
          onClick={() => setTab("variants")}
        >
          المتغيرات ({product.variants.length})
        </button>
      </div>

      {tab === "info" ? (
        <>
          {canManage ? (
            <ProductForm initial={product} mode="edit" onSaved={onUpdated} />
          ) : (
            <ReadOnlyProduct product={product} />
          )}
          {canManage && !product.deletedAt && (
            <button
              type="button"
              className="button-secondary text-red-700"
              onClick={handleDelete}
            >
              حذف المنتج
            </button>
          )}
        </>
      ) : (
        <VariantsManager
          product={product}
          canManage={canManage}
          onChanged={onVariantsChanged}
        />
      )}
    </div>
  );
}

function ReadOnlyProduct({ product }: { product: ProductDetail }) {
  const rows: Array<[string, string | number | null]> = [
    ["الكود", product.code],
    ["الفئة", product.category],
    ["السعر", formatSAR(product.defaultUnitPrice)],
    ["التكلفة المقدرة", formatSAR(product.estimatedUnitCost)],
    ["العملة", product.currency],
    ["حد التنبيه", product.lowStockThreshold],
    ["الوصف", product.description],
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

function VariantsManager({
  product,
  canManage,
  onChanged,
}: {
  product: ProductDetail;
  canManage: boolean;
  onChanged: (p: ProductDetail) => void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    const updated = await api<ProductDetail>(`/api/v1/products/${product.id}`);
    onChanged(updated);
  };

  const addVariant = async (input: VariantInputType) => {
    try {
      await api<VariantDetail>(
        `/api/v1/products/${product.id}/variants`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      setAdding(false);
      await refresh();
      toast("✓ تمت إضافة المتغير", "success");
    } catch (err) {
      toast(`✗ ${(err as Error).message}`, "error");
    }
  };

  const deleteVariant = async (variantId: string) => {
    if (!confirm("حذف هذا المتغير؟")) return;
    try {
      await api<{ id: string }>(
        `/api/v1/products/${product.id}/variants/${variantId}`,
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
      {product.variants.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--muted-foreground)]">
          لا توجد متغيرات
        </p>
      ) : (
        <ul className="space-y-2">
          {product.variants.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3"
            >
              <div>
                <p className="font-medium">
                  {v.name}
                  {!v.isActive && (
                    <span className="ms-2 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                      غير نشط
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  <span className="font-mono">{v.code}</span>
                  {Number(v.unitPriceDelta) !== 0 && (
                    <span className="ms-2">
                      فرق السعر: {formatSAR(v.unitPriceDelta)}
                    </span>
                  )}
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  className="text-xs text-red-700 hover:underline"
                  onClick={() => deleteVariant(v.id)}
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
            <VariantForm
              onCancel={() => setAdding(false)}
              onSubmit={addVariant}
            />
          ) : (
            <button
              type="button"
              className="button-secondary"
              onClick={() => setAdding(true)}
            >
              + إضافة متغير
            </button>
          )}
        </>
      )}
    </div>
  );
}

function VariantForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (input: VariantInputType) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      await onSubmit({
        code: String(fd.get("code") ?? "").trim(),
        name: String(fd.get("name") ?? "").trim(),
        unitPriceDelta: numberOrUndef(fd.get("unitPriceDelta")),
        estimatedUnitCostDelta: numberOrUndef(fd.get("estimatedUnitCostDelta")),
        isActive: fd.get("isActive") !== "off",
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
        <Field name="code" label="كود المتغير" required />
        <Field name="name" label="اسم المتغير" required />
        <Field
          name="unitPriceDelta"
          label="فرق سعر الوحدة"
          type="number"
          step="0.0001"
        />
        <Field
          name="estimatedUnitCostDelta"
          label="فرق التكلفة المقدرة"
          type="number"
          step="0.0001"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked
          value="on"
        />{" "}
        نشط
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
  step,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  step?: string;
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
        step={step}
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

function numberOrZero(v: FormDataEntryValue | null): number {
  return numberOrUndef(v) ?? 0;
}

function intOrUndef(v: FormDataEntryValue | null): number | undefined {
  const n = numberOrUndef(v);
  if (n === undefined) return undefined;
  return Math.trunc(n);
}
