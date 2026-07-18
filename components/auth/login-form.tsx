"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";

export function LoginForm({ mode = "login" }: { mode?: "login" | "signup" }) {
  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState<"email" | "google" | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  function callbackUrl() {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", redirectTo);
    if (mode === "signup") url.searchParams.set("consent", "1");
    return url.toString();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !consent) {
      toast.error("Please accept the Privacy Policy and Terms to continue.");
      return;
    }
    setLoading("email");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  async function handleGoogle() {
    if (mode === "signup" && !consent) {
      toast.error("Please accept the Privacy Policy and Terms to continue.");
      return;
    }
    setLoading("google");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setLoading(null);
      toast.error(error.message);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stamp-green-bg">
          <Mail className="h-6 w-6 text-stamp-green" />
        </div>
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to <span className="font-tabular">{email}</span>. It'll expire shortly, so use it
          soon.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading !== null}>
        {loading === "google" ? "Redirecting…" : "Continue with Google"}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {mode === "signup" ? (
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I agree to the{" "}
              <a href="/terms" className="underline hover:text-foreground">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </a>
              .
            </span>
          </label>
        ) : null}

        <Button type="submit" disabled={loading !== null}>
          {loading === "email" ? "Sending…" : "Continue with email"}
        </Button>
      </form>
    </div>
  );
}
