import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

const sentryWebpackOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.SENTRY_AUTH_TOKEN, // be quiet without token
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
};

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, sentryWebpackOptions)
  : nextConfig;
