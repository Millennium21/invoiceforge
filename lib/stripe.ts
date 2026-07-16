import Stripe from "stripe";

/**
 * Single Stripe client, server-only.
 *
 * The fallback string below matters more than it looks: the Stripe SDK
 * throws SYNCHRONOUSLY at construction if given `undefined`, and this
 * module is imported by Route Handlers that Next.js evaluates during
 * `next build`'s page-data-collection step — with no fallback, an unset
 * STRIPE_SECRET_KEY doesn't just break the payment feature, it fails the
 * entire build. Falling back to a placeholder means the build always
 * succeeds; an actually-missing key then surfaces as a normal Stripe API
 * error ("Invalid API Key provided") at the moment a payment feature is
 * used, which is a far more debuggable failure than a build crash.
 *
 * Account model note: this app uses ONE Stripe account for everything —
 * both your own SaaS subscription billing AND client invoice payments.
 * That means invoice payments settle into the platform owner's Stripe
 * balance, not into each individual freelancer's own bank account.
 *
 * That's the right tradeoff for a single-operator deployment (you're both
 * the platform and the only freelancer using it), but it is NOT correct
 * multi-tenant behaviour for a real many-freelancer SaaS — for that you'd
 * onboard each freelancer as a Stripe Connect account (Express is the
 * usual choice) and pass `on_behalf_of` / `transfer_data.destination` on
 * the invoice Checkout Session, optionally taking an `application_fee_amount`
 * as your platform cut. See README "Scaling notes" for the migration path.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_set_in_env", {
  apiVersion: "2026-06-24.dahlia",
  typescript: true,
});

export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_ID_STARTER!,
  pro: process.env.STRIPE_PRICE_ID_PRO!,
} as const;
