/**
 * Money is stored and computed as integer minor units (pence) everywhere in
 * this app — never a float — which avoids classic floating-point rounding
 * bugs (0.1 + 0.2 !== 0.3) and maps 1:1 onto Stripe's own `amount` format,
 * so no conversion happens at the Stripe boundary either.
 *
 * This function is called from two places: the invoice form (client-side,
 * purely for a live preview) and the `createInvoice` / `updateInvoice`
 * server actions (server-side, authoritative). The server always
 * recomputes totals itself from the submitted line items rather than
 * trusting a client-supplied total — a tampered request can change what
 * line items say, but it can never change what the customer is actually
 * charged.
 */

export type DiscountType = "none" | "percent" | "fixed";

export interface LineItemInput {
  quantity: number;
  unitPricePence: number;
}

export interface InvoiceTotalsInput {
  discountType: DiscountType;
  discountValue: number; // percent (0-100) or pence, depending on discountType
  taxRatePercent: number;
}

export interface InvoiceTotals {
  subtotalPence: number;
  discountPence: number;
  taxPence: number;
  totalPence: number;
}

export function computeInvoiceTotals(
  items: LineItemInput[],
  options: InvoiceTotalsInput
): InvoiceTotals {
  const subtotalPence = items.reduce((sum, item) => {
    const lineTotal = Math.round(item.quantity * item.unitPricePence);
    return sum + (Number.isFinite(lineTotal) ? lineTotal : 0);
  }, 0);

  let discountPence = 0;
  if (options.discountType === "percent") {
    discountPence = Math.round((subtotalPence * clampNonNegative(options.discountValue)) / 100);
  } else if (options.discountType === "fixed") {
    discountPence = Math.round(clampNonNegative(options.discountValue));
  }
  discountPence = Math.min(discountPence, subtotalPence);

  const taxableAmountPence = subtotalPence - discountPence;
  const taxPence = Math.round((taxableAmountPence * clampNonNegative(options.taxRatePercent)) / 100);
  const totalPence = taxableAmountPence + taxPence;

  return { subtotalPence, discountPence, taxPence, totalPence };
}

function clampNonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatMoney(pence: number, currency = "GBP", locale = "en-GB"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(pence / 100);
}

/** Parses a user-typed amount like "1,234.50" into integer pence. */
export function parseMoneyToPence(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const asFloat = parseFloat(cleaned);
  if (!Number.isFinite(asFloat)) return 0;
  return Math.round(asFloat * 100);
}
