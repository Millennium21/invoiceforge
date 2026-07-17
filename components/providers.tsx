"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";

function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();

  React.useEffect(() => {
    if (!pathname || !posthogClient) return;
    const url = searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    posthogClient.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, posthogClient]);

  return null;
}

function PostHogProvider({ children }: { children: React.ReactNode }) {
  const initialized = React.useRef(false);

  React.useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || initialized.current) return;
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: false, // we send pageviews manually so route changes are tracked
      person_profiles: "identified_only",
    });
    initialized.current = true;
  }, []);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <React.Suspense fallback={null}>
        <PostHogPageview />
      </React.Suspense>
      {children}
    </PHProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PostHogProvider>
        {children}
        <Toaster position="bottom-right" />
      </PostHogProvider>
    </ThemeProvider>
  );
}
