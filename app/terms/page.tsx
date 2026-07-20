import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">
        This is a template for a portfolio/demo deployment, not legal advice. Replace it with terms reviewed by a
        qualified professional before operating this as a real business.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">The service</h2>
        <p className="text-sm text-muted-foreground">
          InvoiceForge is a tool for creating invoices, tracking payments, and managing clients. It is not legal,
          tax, or accounting advice, and it doesn't guarantee compliance with any specific jurisdiction's
          requirements — you're responsible for the accuracy of invoices you send and any obligations arising
          from them.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Payments</h2>
        <p className="text-sm text-muted-foreground">
          Payments are processed by Stripe. Depending on the deployment's configuration, client payments may
          settle to a single operator account rather than being routed to individual freelancers — check with
          your specific deployment's operator for how funds are handled.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Your account</h2>
        <p className="text-sm text-muted-foreground">
          You're responsible for the accuracy of the information you enter and for keeping your account secure.
          You can export or permanently delete your data at any time from Settings.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Availability</h2>
        <p className="text-sm text-muted-foreground">
          The service is provided as-is, without warranty of uptime or fitness for a particular purpose.
        </p>
      </section>
    </div>
  );
}
