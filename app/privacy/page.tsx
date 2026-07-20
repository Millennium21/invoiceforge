import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">
        This is a template policy for a portfolio/demo deployment of InvoiceForge, not legal advice. Replace it
        with a policy reviewed by a qualified professional before handling real client data in production.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">What we collect</h2>
        <p className="text-sm text-muted-foreground">
          Your account email, business profile and branding details, the clients and invoices you create, and
          payment records from Stripe. Client contact details you enter are processed on your behalf as the data
          controller for your own business relationships.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">How we use it</h2>
        <p className="text-sm text-muted-foreground">
          Solely to operate the invoicing service: generating and sending invoices, processing payments via
          Stripe, sending reminder emails via Resend, and producing your own reports. We don't sell data or use
          it for advertising.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Your rights</h2>
        <p className="text-sm text-muted-foreground">
          Under UK GDPR you can export a full copy of your data or permanently delete your account at any time
          from Settings — no need to contact support first.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Data retention</h2>
        <p className="text-sm text-muted-foreground">
          Your data is retained for as long as your account is active. Deleting your account permanently removes
          your profile, clients, invoices, and payment records within our systems.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Third parties</h2>
        <p className="text-sm text-muted-foreground">
          We use Supabase (hosting, database, authentication), Stripe (payments), Resend (email), and optionally
          PostHog (product analytics) to operate the service. Each processes data under their own privacy terms.
        </p>
      </section>
    </div>
  );
}
