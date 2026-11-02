import "server-only";
import type { ReceiptBook } from "@/core/receipts";
import { paypal } from "./client";
import type { Invoice, InvoiceList, LinkDescription, Order, Plan, Product, Refund, Subscription } from "./types";

type Ctx = { receipts?: ReceiptBook; requestId?: string };

export type OrderLine = { name: string; quantity: number; unitValue: string; description?: string; sku?: string };

export type CreateOrderInput = {
  currency: string;
  itemTotal: string;
  /** Omitted when there's no tax; then the order total is the item total. */
  taxTotal?: string;
  total?: string;
  lines: OrderLine[];
  payeeEmail: string;
  customId: string;
  invoiceId: string;
  description?: string;
  returnUrl?: string;
  cancelUrl?: string;
};

// Orders v2 — create (intent CAPTURE) with itemised lines and a breakdown, paying the stall's payee.
export function createOrder(input: CreateOrderInput, ctx: Ctx = {}) {
  return paypal<Order>("POST", "/v2/checkout/orders", {
    ...ctx,
    note: "create order",
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.customId.slice(0, 256),
          custom_id: input.customId.slice(0, 255),
          invoice_id: input.invoiceId.slice(0, 127),
          description: input.description?.slice(0, 127),
          payee: { email_address: input.payeeEmail },
          amount: {
            currency_code: input.currency,
            value: input.total ?? input.itemTotal,
            breakdown: {
              item_total: { currency_code: input.currency, value: input.itemTotal },
              ...(input.taxTotal ? { tax_total: { currency_code: input.currency, value: input.taxTotal } } : {}),
            },
          },
          items: input.lines.map((l) => ({
            name: l.name.slice(0, 127),
            quantity: String(l.quantity),
            unit_amount: { currency_code: input.currency, value: l.unitValue },
            description: l.description?.slice(0, 127),
            sku: l.sku?.slice(0, 127),
            category: "PHYSICAL_GOODS",
          })),
        },
      ],
      ...(input.returnUrl
        ? {
            payment_source: {
              paypal: {
                experience_context: {
                  return_url: input.returnUrl,
                  cancel_url: input.cancelUrl ?? input.returnUrl,
                  user_action: "PAY_NOW",
                  shipping_preference: "NO_SHIPPING",
                },
              },
            },
          }
        : {}),
    },
  });
}

export function captureOrder(id: string, ctx: Ctx = {}) {
  return paypal<Order>("POST", `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { ...ctx, body: {}, note: "capture order" });
}

export function getOrder(id: string, ctx: Ctx = {}) {
  return paypal<Order>("GET", `/v2/checkout/orders/${encodeURIComponent(id)}`, { ...ctx, note: "get order" });
}

export function addTracking(
  orderId: string,
  input: { captureId: string; trackingNumber: string; carrier: string; carrierNameOther?: string; notifyPayer?: boolean },
  ctx: Ctx = {},
) {
  return paypal<Order>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/track`, {
    ...ctx,
    note: "add tracking",
    body: {
      capture_id: input.captureId,
      tracking_number: input.trackingNumber.slice(0, 64),
      carrier: input.carrier,
      ...(input.carrier === "OTHER" ? { carrier_name_other: (input.carrierNameOther ?? "Other").slice(0, 64) } : {}),
      notify_payer: input.notifyPayer ?? true,
    },
  });
}

// Payments v2 — refund a capture; omit amount for a full refund.
export function refundCapture(
  captureId: string,
  input: { amount?: { currency_code: string; value: string }; noteToPayer?: string },
  ctx: Ctx = {},
) {
  return paypal<Refund>("POST", `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    ...ctx,
    note: "refund capture",
    body: {
      ...(input.amount ? { amount: input.amount } : {}),
      ...(input.noteToPayer ? { note_to_payer: input.noteToPayer.slice(0, 255) } : {}),
    },
  });
}

export type InvoiceDraftInput = {
  currency: string;
  invoiceNumber?: string;
  note?: string;
  memo?: string;
  termType?: "DUE_ON_RECEIPT" | "DUE_ON_DATE_SPECIFIED" | "NET_10" | "NET_15" | "NET_30";
  dueDate?: string; // YYYY-MM-DD
  invoicerEmail?: string;
  invoicerBusinessName?: string;
  recipient: { email?: string; givenName?: string; surname?: string; businessName?: string };
  items: { name: string; quantity: number; unitValue: string; description?: string }[];
};

// Invoicing v2 — create draft (returns the full invoice with Prefer: return=representation).
export function createDraftInvoice(input: InvoiceDraftInput, ctx: Ctx = {}) {
  return paypal<Invoice>("POST", "/v2/invoicing/invoices", {
    ...ctx,
    note: "create draft invoice",
    body: {
      detail: {
        currency_code: input.currency,
        ...(input.invoiceNumber ? { invoice_number: input.invoiceNumber } : {}),
        ...(input.note ? { note: input.note.slice(0, 4000) } : {}),
        ...(input.memo ? { memo: input.memo.slice(0, 500) } : {}),
        payment_term: {
          term_type: input.dueDate ? "DUE_ON_DATE_SPECIFIED" : (input.termType ?? "DUE_ON_RECEIPT"),
          ...(input.dueDate ? { due_date: input.dueDate } : {}),
        },
      },
      ...(input.invoicerEmail || input.invoicerBusinessName
        ? {
            invoicer: {
              ...(input.invoicerEmail ? { email_address: input.invoicerEmail } : {}),
              ...(input.invoicerBusinessName ? { business_name: input.invoicerBusinessName.slice(0, 300) } : {}),
            },
          }
        : {}),
      primary_recipients: [
        {
          billing_info: {
            ...(input.recipient.email ? { email_address: input.recipient.email } : {}),
            ...(input.recipient.givenName || input.recipient.surname
              ? { name: { given_name: input.recipient.givenName, surname: input.recipient.surname } }
              : {}),
            ...(input.recipient.businessName ? { business_name: input.recipient.businessName.slice(0, 300) } : {}),
          },
        },
      ],
      items: input.items.map((i) => ({
        name: i.name.slice(0, 200),
        quantity: String(i.quantity),
        unit_amount: { currency_code: input.currency, value: i.unitValue },
        ...(i.description ? { description: i.description.slice(0, 1000) } : {}),
        unit_of_measure: "QUANTITY",
      })),
    },
  });
}

export function sendInvoice(id: string, input: { subject?: string; note?: string } = {}, ctx: Ctx = {}) {
  return paypal<LinkDescription>("POST", `/v2/invoicing/invoices/${encodeURIComponent(id)}/send`, {
    ...ctx,
    note: "send invoice",
    body: { send_to_recipient: true, send_to_invoicer: false, ...(input.subject ? { subject: input.subject } : {}), ...(input.note ? { note: input.note } : {}) },
  });
}

export function remindInvoice(id: string, input: { subject?: string; note?: string } = {}, ctx: Ctx = {}) {
  return paypal<void>("POST", `/v2/invoicing/invoices/${encodeURIComponent(id)}/remind`, {
    ...ctx,
    note: "remind invoice",
    body: { send_to_recipient: true, send_to_invoicer: false, ...input },
  });
}

export function cancelInvoice(id: string, input: { note?: string } = {}, ctx: Ctx = {}) {
  return paypal<void>("POST", `/v2/invoicing/invoices/${encodeURIComponent(id)}/cancel`, {
    ...ctx,
    note: "cancel invoice",
    body: { send_to_recipient: true, send_to_invoicer: false, ...input },
  });
}

export function deleteInvoice(id: string, ctx: Ctx = {}) {
  return paypal<void>("DELETE", `/v2/invoicing/invoices/${encodeURIComponent(id)}`, { ...ctx, note: "delete draft invoice" });
}

export function getInvoice(id: string, ctx: Ctx = {}) {
  return paypal<Invoice>("GET", `/v2/invoicing/invoices/${encodeURIComponent(id)}`, { ...ctx, note: "get invoice" });
}

export function listInvoices(page = 1, ctx: Ctx = {}) {
  return paypal<InvoiceList>("GET", "/v2/invoicing/invoices", { ...ctx, note: "list invoices", query: { page, page_size: 20, total_required: "true" } });
}

/**
 * The spec doesn't declare the QR response media type; PayPal returns the PNG as base64
 * (sometimes wrapped in a multipart body). Extract the base64 run either way.
 */
export async function invoiceQrPng(id: string, ctx: Ctx = {}): Promise<string> {
  const raw = await paypal<string>("POST", `/v2/invoicing/invoices/${encodeURIComponent(id)}/generate-qr-code`, {
    ...ctx,
    note: "generate invoice QR",
    as: "text",
    body: { width: 400, height: 400, action: "pay" },
  });
  return extractBase64Png(raw);
}

export function extractBase64Png(raw: string): string {
  const runs = raw.match(/[A-Za-z0-9+/=\r\n]{200,}/g) ?? [];
  const best = runs.sort((a, b) => b.length - a.length)[0];
  if (!best) throw new Error("PayPal QR response had no image data");
  return best.replace(/\s+/g, "");
}

// Catalog Products v1 + Subscriptions v1.
export function createProduct(input: { name: string; description?: string; type?: "PHYSICAL" | "DIGITAL" | "SERVICE" }, ctx: Ctx = {}) {
  return paypal<Product>("POST", "/v1/catalogs/products", {
    ...ctx,
    note: "create catalog product",
    body: { name: input.name.slice(0, 127), type: input.type ?? "SERVICE", ...(input.description ? { description: input.description.slice(0, 256) } : {}) },
  });
}

export function createPlan(
  input: {
    productId: string;
    name: string;
    description?: string;
    currency: string;
    value: string;
    interval: "WEEK" | "MONTH" | "YEAR";
    trialCycles?: number;
  },
  ctx: Ctx = {},
) {
  const regular = {
    frequency: { interval_unit: input.interval, interval_count: 1 },
    tenure_type: "REGULAR",
    sequence: input.trialCycles ? 2 : 1,
    total_cycles: 0,
    pricing_scheme: { fixed_price: { currency_code: input.currency, value: input.value } },
  };
  const trial = input.trialCycles
    ? [{ frequency: { interval_unit: input.interval, interval_count: 1 }, tenure_type: "TRIAL", sequence: 1, total_cycles: input.trialCycles }]
    : [];
  return paypal<Plan>("POST", "/v1/billing/plans", {
    ...ctx,
    note: "create billing plan",
    body: {
      product_id: input.productId,
      name: input.name.slice(0, 127),
      ...(input.description ? { description: input.description.slice(0, 127) } : {}),
      status: "ACTIVE",
      billing_cycles: [...trial, regular],
      payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 2 },
    },
  });
}

export function getPlan(id: string, ctx: Ctx = {}) {
  return paypal<Plan>("GET", `/v1/billing/plans/${encodeURIComponent(id)}`, { ...ctx, note: "get plan" });
}

export function createSubscription(input: { planId: string; returnUrl: string; cancelUrl: string; brandName?: string }, ctx: Ctx = {}) {
  return paypal<Subscription & { links?: LinkDescription[] }>("POST", "/v1/billing/subscriptions", {
    ...ctx,
    note: "create subscription",
    body: {
      plan_id: input.planId,
      application_context: {
        ...(input.brandName ? { brand_name: input.brandName.slice(0, 127) } : {}),
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    },
  });
}

export function getSubscription(id: string, ctx: Ctx = {}) {
  return paypal<Subscription>("GET", `/v1/billing/subscriptions/${encodeURIComponent(id)}`, { ...ctx, note: "get subscription" });
}
