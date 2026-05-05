import "server-only";

import type { ZodType } from "zod";

import { fail } from "./api-response";
import { withRouteErrorHandling } from "./route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import type { Permission } from "@/modules/auth/roles";
import type { AppSession } from "@/modules/auth/session";

/**
 * Build a route handler with permission check + Zod validation
 * for body / query / params.
 *
 * Replaces the boilerplate of:
 *   1. requireApiPermission()
 *   2. parse params
 *   3. parse body
 *   4. parse query
 *   5. try/catch
 *
 * Usage:
 *   export const POST = defineRoute({
 *     permission: "costs:manage",
 *     params: z.object({ id: z.string().min(1) }),
 *     body: CostInput,
 *     async handler({ session, params, body }) {
 *       const cost = await service.create(session.factoryId, ...);
 *       return ok(cost, { status: 201 });
 *     },
 *   });
 */
export interface RouteContext<P, Q, B> {
  session: AppSession;
  params: P;
  query: Q;
  body: B;
  request: Request;
}

export interface DefineRouteOptions<P, Q, B> {
  permission: Permission;
  params?: ZodType<P>;
  query?: ZodType<Q>;
  body?: ZodType<B>;
  handler: (ctx: RouteContext<P, Q, B>) => Promise<Response>;
}

type NextRouteContext = { params: Promise<Record<string, string>> };

function formatIssues(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>) {
  return issues
    .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
    .join(", ");
}

export function defineRoute<
  P = Record<string, string>,
  Q = Record<string, string | string[]>,
  B = unknown,
>(opts: DefineRouteOptions<P, Q, B>) {
  return async function routeHandler(
    request: Request,
    context: NextRouteContext = { params: Promise.resolve({}) },
  ): Promise<Response> {
    return withRouteErrorHandling(async () => {
      // 1. Permission
      const access = await requireApiPermission(opts.permission);
      if (!access.ok) return access.response;

      // 2. Params (from Next route segment)
      let params: P = {} as P;
      if (opts.params) {
        const raw = await context.params;
        const parsed = opts.params.safeParse(raw);
        if (!parsed.success) {
          return fail(
            "Invalid route parameters: " + formatIssues(parsed.error.issues),
            400,
          );
        }
        params = parsed.data;
      }

      // 3. Query (URLSearchParams -> object, repeated keys collapse to array)
      let query: Q = {} as Q;
      if (opts.query) {
        const url = new URL(request.url);
        const rawQuery: Record<string, string | string[]> = {};
        for (const key of new Set(url.searchParams.keys())) {
          const all = url.searchParams.getAll(key);
          rawQuery[key] = all.length > 1 ? all : all[0];
        }
        const parsed = opts.query.safeParse(rawQuery);
        if (!parsed.success) {
          return fail(
            "Invalid query parameters: " + formatIssues(parsed.error.issues),
            400,
          );
        }
        query = parsed.data;
      }

      // 4. Body (JSON only)
      let body: B = undefined as B;
      if (opts.body) {
        const method = request.method.toUpperCase();
        if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
          return fail(
            "Body validation requested but method does not support a body",
            500,
          );
        }
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return fail("Request body must be valid JSON", 400);
        }
        const parsed = opts.body.safeParse(raw);
        if (!parsed.success) {
          return fail(
            "Invalid request body: " + formatIssues(parsed.error.issues),
            400,
          );
        }
        body = parsed.data;
      }

      // 5. Handler
      return opts.handler({
        session: access.session,
        params,
        query,
        body,
        request,
      });
    });
  };
}
