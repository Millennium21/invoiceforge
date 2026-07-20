import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payment received" };

export default async function InvoicePaymentSuccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stamp-green-bg">
        <CheckCircle2 className="h-7 w-7 text-stamp-green" />
      </div>
      <h1 className="text-xl font-semibold">Payment received</h1>
      <p className="text-sm text-muted-foreground">
        Thanks! Your payment is being confirmed — it can take a few seconds to reflect here. A receipt is on its
        way to your inbox.
      </p>
      <Link href={`/invoice/${token}`} className="text-sm text-primary hover:underline">
        Back to invoice
      </Link>
    </div>
  );
}
