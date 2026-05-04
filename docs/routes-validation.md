# Route validation with `defineRoute`

`defineRoute` (in `src/lib/http/with-validation.ts`) is the standard wrapper for
Next.js App Router API routes. It collapses our common boilerplate
(`withRouteErrorHandling` + `requireApiPermission` + manual JSON parsing) into a
single declaration, and validates `params`, `query`, and `body` with Zod.

## Why

Of the 66 v1 API routes today, only 2 use Zod. The rest hand-roll
`await request.json().catch(() => null)` plus `if (!body) return fail(...)`,
which is error-prone and inconsistent. `defineRoute` gives us:

- a single permission check,
- typed `params` / `query` / `body` reaching the handler,
- consistent 400 error messages with the offending field path,
- no change to the response shape (`fail()` / `ok()` are still used).

## Anatomy

```ts
export const POST = defineRoute({
  permission: "costs:manage",          // Permission union from roles.ts
  params: z.object({ id: z.string() }),// from /[id]/ segment
  query: z.object({ ... }).optional(), // ?foo=bar
  body: CostInput,                     // JSON body schema
  async handler({ session, params, query, body, request }) {
    // ...
    return ok(result, { status: 201 });
  },
});
```

The handler receives:

- `session: AppSession` — the resolved session (factoryId, role, userId, etc.)
- `params` / `query` / `body` — parsed and typed per the schemas you supplied.
  Omitted schemas yield `{}` / `undefined`.
- `request: Request` — escape hatch for headers, etc.

Repeated query keys collapse to arrays automatically (`?cat=A&cat=B` ->
`{ cat: ["A", "B"] }`). Use `z.union([z.string(), z.array(z.string())])` if a
key may be either single or repeated.

## Audit logs

`defineRoute` is intentionally orthogonal to `src/lib/audit.ts`. Call the audit
helper from inside your handler after the mutation succeeds:

```ts
async handler({ session, body, params }) {
  const cost = await service.create(...);
  await recordAudit({ session, action: "cost.create", entityId: cost.id });
  return ok(cost, { status: 201 });
}
```

## Migration: before / after

### Before — `src/app/api/v1/projects/[id]/costs/route.ts`

```ts
export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { CostService } from "@/modules/finance/cost.service";

const service = new CostService();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("costs:manage");
    if (!access.ok) return access.response;
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    if (!body) return fail("Request body is required", 400);

    const cost = await service.create(
      access.session.factoryId,
      { userId: access.session.userId, role: access.session.role },
      { ...body, projectId: id },
    );

    return ok(cost, { status: 201 });
  });
}
```

Issues:
- No body schema — bad input becomes a service-layer 500 or worse, persisted garbage.
- Repeated `await context.params` boilerplate.
- Manual `if (!body)` pattern across every route.

### After

```ts
export const dynamic = "force-dynamic";

import { z } from "zod";

import { ok } from "@/lib/http/api-response";
import { defineRoute } from "@/lib/http/with-validation";
import { CostService } from "@/modules/finance/cost.service";
import { CostInput } from "@/modules/finance/cost.schemas";

const service = new CostService();

export const POST = defineRoute({
  permission: "costs:manage",
  params: z.object({ id: z.string().min(1) }),
  body: CostInput,
  async handler({ session, params, body }) {
    const cost = await service.create(
      session.factoryId,
      { userId: session.userId, role: session.role },
      { ...body, projectId: params.id },
    );
    return ok(cost, { status: 201 });
  },
});
```

## Rules of thumb

1. **One `defineRoute` per HTTP verb export.** Don't try to multiplex.
2. **Schemas live with the module**, not inline next to the route — share them
   with services and tests. Routes import them.
3. **Don't catch `ZodError` yourself.** `withRouteErrorHandling` already maps
   it to a 422; `defineRoute` returns 400 for the input it parsed.
4. **GET routes** can still use `defineRoute` with only `permission` + `params`
   + `query`. Skip `body`.
5. **Stay additive.** Do not migrate routes alongside unrelated changes —
   Phase 6 has a dedicated sweep.
