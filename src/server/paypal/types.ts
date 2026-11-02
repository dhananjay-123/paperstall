// Response shapes we read, trimmed from PayPal's published OpenAPI specs
// (orders v2, invoicing v2, catalog-products v1, subscriptions v1, payments v2).

export type Money = { currency_code: string; value: string };

export type Capture = {
  id: string;
  status: "COMPLETED" | "DECLINED" | "PARTIALLY_REFUNDED" | "PENDING" | "REFUNDED" | "FAILED";
  amount: Money;
  create_time?: string;
};

export type OrderStatus = "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";

export type Order = {
  id: string;
  status: OrderStatus;
  create_time?: string;
  update_time?: string;
  payer?: { email_address?: string; name?: { given_name?: string; surname?: string } };
  purchase_units: {
    reference_id?: string;
    custom_id?: string;
    invoice_id?: string;
    amount: Money & { breakdown?: { item_total?: Money } };
    payee?: { email_address?: string; merchant_id?: string };
    items?: { name: string; quantity: string; unit_amount: Money; description?: string }[];
    payments?: { captures?: Capture[]; refunds?: { id: string; status: string; amount?: Money }[] };
  }[];
  links?: { href: string; rel: string; method?: string }[];
};

export type Refund = { id: string; status: "CANCELLED" | "FAILED" | "PENDING" | "COMPLETED"; amount?: Money };

export type InvoiceStatus =
  | "DRAFT" | "SENT" | "SCHEDULED" | "PAID" | "MARKED_AS_PAID" | "CANCELLED" | "REFUNDED" | "PARTIALLY_PAID"
  | "PARTIALLY_REFUNDED" | "MARKED_AS_REFUNDED" | "UNPAID" | "PAYMENT_PENDING" | "AUTO_CANCELLED"
  | "PAID_EXTERNAL" | "REFUNDED_EXTERNAL" | "SHARED";

export type Invoice = {
  id: string;
  status: InvoiceStatus;
  detail: {
    invoice_number?: string;
    currency_code: string;
    note?: string;
    memo?: string;
    invoice_date?: string;
    payment_term?: { term_type?: string; due_date?: string };
    metadata?: { recipient_view_url?: string; invoicer_view_url?: string; last_sent_time?: string };
  };
  primary_recipients?: { billing_info?: { email_address?: string; name?: { given_name?: string; surname?: string }; business_name?: string } }[];
  items?: { name: string; quantity: string; unit_amount: Money }[];
  amount?: { currency_code: string; value: string };
  due_amount?: Money;
  payments?: { paid_amount?: Money; transactions?: { payment_id?: string; payment_date?: string; amount?: Money }[] };
  links?: { href: string; rel: string; method?: string }[];
};

export type InvoiceList = { items?: Invoice[]; total_items?: number; total_pages?: number };

export type LinkDescription = { href: string; rel: string; method?: string };

export type Product = { id: string; name: string };
export type Plan = { id: string; product_id: string; name: string; status: "CREATED" | "INACTIVE" | "ACTIVE" };
export type Subscription = {
  id: string;
  plan_id: string;
  status: "APPROVAL_PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
  start_time?: string;
  subscriber?: { email_address?: string; name?: { given_name?: string; surname?: string } };
  billing_info?: { last_payment?: { amount?: Money; time?: string }; next_billing_time?: string };
};
