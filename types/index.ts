// Hand-written to mirror supabase/migrations/*.sql exactly. In a real
// deployment you'd regenerate these with `supabase gen types typescript`
// once the project is live — see README "Local development" — but that
// command needs a running Supabase project, so for this repo they're
// maintained by hand alongside the migrations.

export type InvoiceStatus = "draft" | "sent" | "viewed" | "paid" | "overdue" | "cancelled";
export type DiscountType = "none" | "percent" | "fixed";
export type RecurrenceInterval = "weekly" | "monthly" | "quarterly" | "yearly";
export type SubscriptionTier = "free" | "starter" | "pro";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";

export interface Profile {
  id: string;
  email: string;
  business_name: string | null;
  full_name: string | null;
  logo_url: string | null;
  brand_color: string;
  address: string | null;
  tax_number: string | null;
  default_currency: string;
  default_tax_rate: number;
  invoice_prefix: string;
  next_invoice_number: number;
  marketing_consent: boolean;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  payment_terms_days: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  currency: string;
  issue_date: string;
  due_date: string;
  discount_type: DiscountType;
  discount_value: number;
  tax_rate_percent: number;
  subtotal_pence: number;
  discount_pence: number;
  tax_pence: number;
  total_pence: number;
  notes: string | null;
  public_token: string;
  is_recurring: boolean;
  recurrence_interval: RecurrenceInterval | null;
  recurrence_end_date: string | null;
  next_invoice_date: string | null;
  recurrence_parent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  user_id: string;
  description: string;
  quantity: number;
  unit_price_pence: number;
  sort_order: number;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  user_id: string;
  amount_pence: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  status: "succeeded" | "refunded";
  paid_at: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithRelations extends Invoice {
  client: Client;
  items: InvoiceItem[];
}

// --- Stretch features -------------------------------------------------

export type ExpenseCategory = "travel" | "software" | "materials" | "subcontractor" | "other";

export interface Expense {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_id: string | null;
  description: string;
  category: ExpenseCategory;
  amount_pence: number;
  currency: string;
  expense_date: string;
  receipt_url: string | null;
  is_billable: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_id: string | null;
  description: string;
  started_at: string;
  ended_at: string | null;
  hourly_rate_pence: number;
  is_billable: boolean;
  created_at: string;
}

export type MessageSender = "client" | "freelancer";

export interface InvoiceMessage {
  id: string;
  invoice_id: string;
  user_id: string;
  sender: MessageSender;
  body: string;
  read_by_freelancer_at: string | null;
  created_at: string;
}

export interface InvoiceTemplate {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  discount_type: DiscountType;
  discount_value: number;
  tax_rate_percent: number | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceTemplateItem {
  id: string;
  template_id: string;
  user_id: string;
  description: string;
  quantity: number;
  unit_price_pence: number;
  sort_order: number;
}
