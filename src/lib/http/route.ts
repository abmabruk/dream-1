import { ZodError } from "zod";

import { fail } from "./api-response";
import { HttpError } from "./http-error";

export async function withRouteErrorHandling<T>(
  handler: () => Promise<T>
): Promise<T> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ZodError) {
      return fail("Validation failed", 422, error.flatten()) as T;
    }

    if (error instanceof HttpError) {
      return fail(error.message, error.status, error.details) as T;
    }

    console.error(error);
    return fail("Internal server error", 500) as T;
  }
}
