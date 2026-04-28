export default function PortalEntryPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 px-6 py-16">
      <section className="panel w-full">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          بوابة العميل
        </p>
        <h1 className="mt-3 text-3xl font-semibold">افتح هذه المنطقة باستخدام رابط بوابة الطلب الآمن.</h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted-foreground)]">
          تُنشأ صفحات البوابة من رموز مُوقَّعة خاصة بكل طلب وتقرأ بيانات حية
          من مساحة عمل المصنع. يجب على العملاء الوصول إلى هنا من رابط مشترك من قبل الفريق الداخلي.
        </p>
      </section>
    </main>
  );
}
