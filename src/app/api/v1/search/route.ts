import { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { ok, fail } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { getSession } from "@/modules/auth/session";

export type SearchResult = {
  id: string;
  type: "project" | "task" | "customer" | "order";
  title: string;
  subtitle: string;
  href: string;
};

const TAKE = 5;

export async function GET(request: NextRequest) {
  return withRouteErrorHandling(async () => {
    const session = await getSession();
    if (!session) {
      return fail("Authentication required", 401);
    }

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 1) {
      return ok<SearchResult[]>([]);
    }

    const factoryId = session.factoryId;
    const insensitive = { contains: q, mode: "insensitive" as const };

    const [projects, tasks, customers, orders] = await Promise.all([
      db.project.findMany({
        where: {
          factoryId,
          OR: [{ code: insensitive }, { name: insensitive }],
        },
        select: { id: true, code: true, name: true, status: true },
        take: TAKE,
        orderBy: { updatedAt: "desc" },
      }),
      db.projectTask.findMany({
        where: {
          factoryId,
          title: insensitive,
        },
        select: {
          id: true,
          title: true,
          projectId: true,
          project: { select: { code: true, name: true } },
        },
        take: TAKE,
        orderBy: { updatedAt: "desc" },
      }),
      db.customer.findMany({
        where: {
          factoryId,
          OR: [
            { name: insensitive },
            { phone: insensitive },
            { email: insensitive },
          ],
        },
        select: { id: true, name: true, phone: true, city: true },
        take: TAKE,
        orderBy: { updatedAt: "desc" },
      }),
      db.order.findMany({
        where: {
          factoryId,
          OR: [{ code: insensitive }, { title: insensitive }],
        },
        select: {
          id: true,
          code: true,
          title: true,
          customer: { select: { name: true } },
        },
        take: TAKE,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const results: SearchResult[] = [
      ...projects.map((p) => ({
        id: p.id,
        type: "project" as const,
        title: p.name,
        subtitle: p.code,
        href: `/app/projects/${p.id}`,
      })),
      ...tasks.map((t) => ({
        id: t.id,
        type: "task" as const,
        title: t.title,
        subtitle: `${t.project.code} · ${t.project.name}`,
        href: `/app/projects/${t.projectId}`,
      })),
      ...customers.map((c) => ({
        id: c.id,
        type: "customer" as const,
        title: c.name,
        subtitle: [c.phone, c.city].filter(Boolean).join(" · ") || "—",
        href: `/app/customers/${c.id}`,
      })),
      ...orders.map((o) => ({
        id: o.id,
        type: "order" as const,
        title: o.title,
        subtitle: `${o.code} · ${o.customer?.name ?? ""}`,
        href: `/app/orders/${o.id}`,
      })),
    ];

    return ok<SearchResult[]>(results);
  });
}
