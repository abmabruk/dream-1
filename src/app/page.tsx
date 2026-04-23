export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-6 py-16 lg:px-10">
      <section className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-1 text-sm text-[var(--muted-foreground)]">
            Rebuild foundation for operations, sales, production, and portals
          </span>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-[var(--foreground)]">
              Dream 1 is now starting from a solid product base instead of a prototype shell.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
              This fresh workspace is organized around modules, validated inputs,
              explicit roles, a real database contract, and versioned APIs so we
              can grow the product safely.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className="button-primary" href="/app">
              Open app foundation
            </a>
            <a className="button-secondary" href="/sign-in">
              Open auth entry
            </a>
          </div>
        </div>

        <div className="panel space-y-5">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Architecture snapshot
            </p>
            <h2 className="mt-2 text-2xl font-semibold">What this base includes</h2>
          </div>
          <ul className="space-y-3 text-sm text-[var(--muted-foreground)]">
            <li>Feature modules for auth, users, roles, and orders</li>
            <li>Prisma schema for users, sessions, factories, orders, and assignments</li>
            <li>Zod-based request validation and typed API responses</li>
            <li>Session guard and permission map for owner, manager, supervisor, worker, and customer</li>
            <li>App, worker, and portal route entry points</li>
          </ul>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Database</p>
          <h3 className="mt-3 text-xl font-semibold">PostgreSQL-ready schema</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
            Prisma is wired as the system contract so relationships, enums, and
            auditing are explicit from the start.
          </p>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Auth and roles</p>
          <h3 className="mt-3 text-xl font-semibold">Permission-first design</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
            Guards and role capabilities live outside pages, so authorization
            rules stay maintainable as the product grows.
          </p>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">API</p>
          <h3 className="mt-3 text-xl font-semibold">Versioned contract</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
            Route handlers are set up under `/api/v1` with validation and shared
            response helpers for predictable integration work.
          </p>
        </article>
      </section>
    </main>
  );
}
