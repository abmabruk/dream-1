export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-6 py-16">
      <section className="panel w-full">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Access control
        </p>
        <h1 className="mt-3 text-3xl font-semibold">You do not have access to this area.</h1>
      </section>
    </main>
  );
}
