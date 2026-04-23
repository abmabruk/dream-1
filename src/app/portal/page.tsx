export default function PortalEntryPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 px-6 py-16">
      <section className="panel w-full">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Customer portal
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Open this area using a secure order portal link.</h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted-foreground)]">
          Portal pages are generated from signed order-specific tokens and read
          live data from the factory workspace. Customers should arrive here
          from a link shared by the internal team.
        </p>
      </section>
    </main>
  );
}
