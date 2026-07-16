import { Resend } from "resend";

// See lib/stripe.ts for why the fallback matters: the SDK throws
// synchronously on a missing key, which would otherwise fail the entire
// `next build`, not just email sending.
export const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder_set_in_env");

const FROM = process.env.RESEND_FROM_EMAIL || "invoices@resend.dev";

/**
 * Thin retry wrapper for outbound email. Email delivery is a good
 * candidate for a blind retry (unlike, say, creating a Stripe Checkout
 * Session) because sending the same email twice is annoying but not
 * unsafe — the reminder Edge Function's `reminders_log` unique constraint
 * is the real duplicate-send guard; this just absorbs transient network
 * blips against the Resend API itself.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 300 * 2 ** i));
      }
    }
  }
  throw lastError;
}

interface SendInvoiceEmailArgs {
  to: string;
  businessName: string;
  invoiceNumber: string;
  amountFormatted: string;
  dueDateFormatted: string;
  publicUrl: string;
  kind: "sent" | "upcoming" | "overdue" | "paid";
}

export async function sendInvoiceEmail(args: SendInvoiceEmailArgs) {
  const subjectByKind: Record<SendInvoiceEmailArgs["kind"], string> = {
    sent: `Invoice ${args.invoiceNumber} from ${args.businessName}`,
    upcoming: `Reminder: invoice ${args.invoiceNumber} is due soon`,
    overdue: `Overdue: invoice ${args.invoiceNumber} from ${args.businessName}`,
    paid: `Receipt: invoice ${args.invoiceNumber} — payment received`,
  };

  const bodyByKind: Record<SendInvoiceEmailArgs["kind"], string> = {
    sent: `${args.businessName} has sent you a new invoice for ${args.amountFormatted}, due ${args.dueDateFormatted}.`,
    upcoming: `Just a reminder that invoice ${args.invoiceNumber} for ${args.amountFormatted} is due ${args.dueDateFormatted}.`,
    overdue: `Invoice ${args.invoiceNumber} for ${args.amountFormatted} was due ${args.dueDateFormatted} and hasn't been paid yet.`,
    paid: `We've received your payment of ${args.amountFormatted} for invoice ${args.invoiceNumber}. Thank you!`,
  };

  return withRetry(() =>
    resend.emails.send({
      from: FROM,
      to: args.to,
      subject: subjectByKind[args.kind],
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #16302a;">
          <p>${bodyByKind[args.kind]}</p>
          <p>
            <a href="${args.publicUrl}" style="display:inline-block;padding:10px 20px;background:#2b4c6f;color:#fff;text-decoration:none;border-radius:6px;">
              View invoice
            </a>
          </p>
          <p style="color:#5b6d66;font-size:12px;">Sent via InvoiceForge on behalf of ${args.businessName}.</p>
        </div>
      `,
    })
  );
}
