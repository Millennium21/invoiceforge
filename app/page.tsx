import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, FileText, Repeat, Bell, BarChart3, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "InvoiceForge — Invoicing for freelancers who hate invoicing",
};

const FEATURES = [
  {
    icon: FileText,
    title: "Branded invoices in seconds",
    body: "Your logo, your colour, tax-ready line items. Clean enough that clients actually notice.",
  },
  {
    icon: Repeat,
    title: "Recurring billing on autopilot",
    body: "Set it once for a retainer client and InvoiceForge generates and sends the next one for you.",
  },
  {
    icon: Bell,
    title: "Reminders that chase for you",
    body: "Automatic nudges before and after the due date, so you're not the one sending awkward emails.",
  },
  {
    icon: BarChart3,
    title: "UK tax-friendly reports",
    body: "A monthly revenue and VAT breakdown, exportable as CSV for your accountant.",
  },
  {
    icon: ShieldCheck,
    title: "Built on real multi-tenant security",
    body: "Row-level security isolates every freelancer's data — the same architecture pattern banks use.",
  },
  {
    icon: Smartphone,
    title: "Works from your phone",
    body: "Installable as a PWA, so you can check what's outstanding from a bus stop.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <span className="font-serif text-lg font-semibold">
          Invoice<span className="text-primary">Forge</span>
        </span>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Start free</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-12 sm:px-8 sm:py-20 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              Invoicing for people who'd rather be working
            </span>
            <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">
              Get paid without the spreadsheet gymnastics.
            </h1>
            <p className="max-w-md text-muted-foreground">
              Branded invoices, automated reminders, and UK tax-friendly reports — one focused tool instead of a
              patchwork of spreadsheets and half-used apps.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start free — no card
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#features">See what's included</Link>
              </Button>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-sm -rotate-2 rounded-lg border border-border bg-card p-6 font-mono shadow-xl transition-transform hover:rotate-0">
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Invoice</p>
                  <p className="text-lg font-semibold">INV-0148</p>
                </div>
                <span className="stamp bg-stamp-green-bg text-stamp-green border-stamp-green/50">Paid</span>
              </div>
              <div className="flex flex-col gap-2 py-4 text-sm">
                <div className="flex justify-between">
                  <span className="font-sans text-foreground">Design sprint</span>
                  <span className="tabular-nums">£850.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-foreground">Copy review</span>
                  <span className="tabular-nums">£220.00</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 border-t border-border pt-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">£1,070.00</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT (20%)</span>
                  <span className="tabular-nums">£214.00</span>
                </div>
                <div className="flex justify-between pt-1 text-base font-semibold text-foreground">
                  <span>Total</span>
                  <span className="tabular-nums">£1,284.00</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-border bg-card/50 px-4 py-16 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-10 text-center font-serif text-2xl font-semibold">Everything a freelancer actually needs</h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex flex-col gap-2">
                  <f.icon className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 text-center sm:px-8">
          <h2 className="font-serif text-2xl font-semibold">Free to start. No card required.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Every feature is unlocked on the free tier while this deployment runs in Zero-Cost Mode.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/signup">
              Create your account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-8">
        <span>© {new Date().getFullYear()} InvoiceForge</span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
