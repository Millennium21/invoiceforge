import { PostHog } from "posthog-node";

let serverClient: PostHog | null = null;

/**
 * Server-side capture (from Server Actions / webhook handlers), separate
 * from the client-side posthog-js instance in components/providers.tsx.
 * Lazily constructed and a no-op if no key is configured, so local dev
 * without a PostHog project doesn't throw.
 */
function getServerClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!serverClient) {
    serverClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return serverClient;
}

export type AnalyticsEvent =
  | "signup_completed"
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "subscription_started"
  | "subscription_canceled";

export function captureServerEvent(
  userId: string,
  event: AnalyticsEvent,
  properties?: Record<string, unknown>
) {
  const client = getServerClient();
  if (!client) return;
  client.capture({ distinctId: userId, event, properties });
}
