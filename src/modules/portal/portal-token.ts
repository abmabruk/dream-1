import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

import { env } from "@/lib/env";

const portalTokenSchema = z.object({
  typ: z.literal("order_portal"),
  accessId: z.string().min(1),
  orderId: z.string().min(1),
});

function getSecret() {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
    throw new Error("AUTH_SECRET must be configured before using portal links.");
  }

  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function signPortalToken(input: {
  accessId: string;
  orderId: string;
}) {
  return new SignJWT({
    typ: "order_portal",
    accessId: input.accessId,
    orderId: input.orderId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("120d")
    .sign(getSecret());
}

export async function verifyPortalToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return portalTokenSchema.parse(payload);
}
