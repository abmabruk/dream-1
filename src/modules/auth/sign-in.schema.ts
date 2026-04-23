import { z } from "zod";

export const signInSchema = z.object({
  email: z.email().max(160),
  password: z.string().min(8).max(200),
});

export type SignInInput = z.infer<typeof signInSchema>;
