export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-6 py-16 lg:px-10">
      <section className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-1 text-sm text-[var(--muted-foreground)]">
            إعادة بناء الأساس للعمليات والمبيعات والإنتاج والبوابات
          </span>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-[var(--foreground)]">
              دريم ١ تنطلق الآن من قاعدة منتج صلبة بدلاً من هيكل نموذج أولي.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
              مساحة العمل الجديدة هذه منظمة حول الوحدات والمدخلات المتحقق منها
              والأدوار الصريحة وعقد قاعدة بيانات حقيقي وواجهات برمجة إصدارات
              حتى نتمكن من تنمية المنتج بأمان.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className="button-primary" href="/app">
              فتح أساس التطبيق
            </a>
            <a className="button-secondary" href="/sign-in">
              فتح صفحة تسجيل الدخول
            </a>
          </div>
        </div>

        <div className="panel space-y-5">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              لمحة عن البنية
            </p>
            <h2 className="mt-2 text-2xl font-semibold">ما تتضمنه هذه القاعدة</h2>
          </div>
          <ul className="space-y-3 text-sm text-[var(--muted-foreground)]">
            <li>وحدات ميزات للمصادقة والمستخدمين والأدوار والطلبات</li>
            <li>مخطط Prisma للمستخدمين والجلسات والمصانع والطلبات والمهام</li>
            <li>التحقق من الطلبات بناءً على Zod واستجابات API المكتوبة</li>
            <li>حارس جلسة وخريطة أذونات للمالك والمدير والمشرف والعامل والعميل</li>
            <li>نقاط دخول مسار التطبيق والعامل والبوابة</li>
          </ul>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">قاعدة البيانات</p>
          <h3 className="mt-3 text-xl font-semibold">مخطط جاهز لـ PostgreSQL</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
            Prisma مرتبط كعقد النظام حتى تكون العلاقات والتعدادات والتدقيق
            صريحة من البداية.
          </p>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">المصادقة والأدوار</p>
          <h3 className="mt-3 text-xl font-semibold">تصميم يُقدّم الأذونات أولاً</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
            الحراس وقدرات الأدوار تعيش خارج الصفحات، لذا تظل قواعد التفويض
            قابلة للصيانة مع نمو المنتج.
          </p>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">واجهة برمجة التطبيقات</p>
          <h3 className="mt-3 text-xl font-semibold">عقد ذو إصدارات</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
            معالجات المسارات مُعدّة تحت `/api/v1` مع التحقق من الصحة ومساعدي
            الاستجابة المشتركة لأعمال التكامل القابلة للتنبؤ.
          </p>
        </article>
      </section>
    </main>
  );
}
