/**
 * Feature flags for dark-launching new modules.
 *
 * Flags are env-driven (per Vercel env scope). To enable a flag:
 *   FLAGS_QUOTES=true npm run dev
 * In Vercel: set the env var per environment (dev/preview/prod).
 *
 * Default behavior: flag is OFF unless env var is the literal string "true".
 *
 * To swap to a remote flag service (LaunchDarkly, GrowthBook, etc.) later,
 * change the implementation of `isEnabled()`. Callers won't change.
 */

export const FLAG_NAMES = [
  "quotes",
  "invoices",
  "payments",
  "vendors",
  "products",
  "online_payments",
  "zatca_einvoicing",
  "two_factor_auth",
] as const;

export type FlagName = (typeof FLAG_NAMES)[number];

function envKey(flag: FlagName): string {
  return `FLAGS_${flag.toUpperCase()}`;
}

/**
 * Check if a feature flag is enabled.
 * Server-side only (reads process.env). For client checks, fetch from API.
 */
export function isEnabled(flag: FlagName): boolean {
  return process.env[envKey(flag)] === "true";
}

/**
 * Get a snapshot of all flag states (e.g. to send to client).
 * Returns a typed record.
 */
export function getFlags(): Record<FlagName, boolean> {
  return Object.fromEntries(FLAG_NAMES.map((f) => [f, isEnabled(f)])) as Record<FlagName, boolean>;
}

/**
 * Throw if a flag is required but disabled.
 * Used at the top of feature routes to fail fast with a clear message.
 */
export function requireFlag(flag: FlagName): void {
  if (!isEnabled(flag)) {
    throw new Error(`Feature "${flag}" is not enabled. Set ${envKey(flag)}=true to enable.`);
  }
}
