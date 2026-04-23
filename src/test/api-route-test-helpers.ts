import { fail } from "@/lib/http/api-response";
import type { UserRole } from "@/modules/auth/roles";

type SessionOverrides = Partial<{
  userId: string;
  factoryId: string;
  factoryName: string;
  factoryCurrency: string;
  factoryTimezone: string;
  role: UserRole;
  email: string;
  displayName: string;
}>;

export function createApiSession(overrides: SessionOverrides = {}) {
  return {
    userId: "user_1",
    factoryId: "factory_1",
    factoryName: "Dream 1 Factory",
    factoryCurrency: "SAR",
    factoryTimezone: "Asia/Riyadh",
    role: "OWNER" as UserRole,
    email: "owner@dream1.local",
    displayName: "Dream Owner",
    ...overrides,
  };
}

export function allowApiAccess(overrides: SessionOverrides = {}) {
  return {
    ok: true as const,
    session: createApiSession(overrides),
  };
}

export function denyApiAccess(message = "Authentication required", status = 401) {
  return {
    ok: false as const,
    response: fail(message, status),
  };
}

export function jsonRequest(method: string, body?: unknown) {
  return new Request("http://localhost/test", {
    method,
    headers:
      body === undefined
        ? undefined
        : {
            "content-type": "application/json",
          },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function invalidJsonRequest(method: string) {
  return new Request("http://localhost/test", {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: "{",
  });
}

export async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}
