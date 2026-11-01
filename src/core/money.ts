// All money is integer minor units (cents). Floats only appear at the edges:
// parsing what the model read, and formatting for display or for PayPal's decimal strings.

// Currencies PayPal accepts for checkout, with their minor-unit exponent.
// Source: PayPal REST currency codes reference. JPY/HUF/TWD have no decimals in PayPal.
export const PAYPAL_CURRENCIES = {
  AUD: 2, BRL: 2, CAD: 2, CNY: 2, CZK: 2, DKK: 2, EUR: 2, HKD: 2, HUF: 0, ILS: 2, JPY: 0, MYR: 2,
  MXN: 2, TWD: 0, NZD: 2, NOK: 2, PHP: 2, PLN: 2, GBP: 2, SGD: 2, SEK: 2, CHF: 2, THB: 2, USD: 2,
} as const;

export type CurrencyCode = keyof typeof PAYPAL_CURRENCIES;

export function isPayPalCurrency(code: string): code is CurrencyCode {
  return Object.hasOwn(PAYPAL_CURRENCIES, code);
}

export function exponent(currency: CurrencyCode): number {
  return PAYPAL_CURRENCIES[currency];
}

/** Decimal amount (e.g. 4.5) → minor units (450). Rounds half away from zero. */
export function toMinor(amount: number, currency: CurrencyCode): number {
  if (!Number.isFinite(amount)) throw new Error("Amount must be a finite number");
  const factor = 10 ** exponent(currency);
  // toFixed first avoids 1.005 * 100 = 100.49999… style errors.
  const scaled = Number((Math.abs(amount) * factor).toFixed(6));
  return Math.sign(amount) * Math.round(scaled);
}

/** Minor units → PayPal decimal string ("4.50", or "450" for JPY). */
export function toPayPalValue(minor: number, currency: CurrencyCode): string {
  if (!Number.isInteger(minor)) throw new Error("Minor units must be an integer");
  const e = exponent(currency);
  if (e === 0) return String(minor);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 10 ** e);
  const frac = String(abs % 10 ** e).padStart(e, "0");
  return `${sign}${whole}.${frac}`;
}

/** PayPal decimal string → minor units. */
export function fromPayPalValue(value: string, currency: CurrencyCode): number {
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error(`Not a money value: ${value}`);
  const e = exponent(currency);
  const [whole, frac = ""] = value.replace("-", "").split(".");
  const minor = Number(whole) * 10 ** e + Number((frac + "0".repeat(e)).slice(0, e) || "0");
  return value.startsWith("-") ? -minor : minor;
}

export function formatMoney(minor: number, currency: string, locale?: string): string {
  const e = isPayPalCurrency(currency) ? exponent(currency) : 2;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 10 ** e);
  } catch {
    return `${(minor / 10 ** e).toFixed(e)} ${currency}`;
  }
}

export type Line = { unitMinor: number; quantity: number };

export function lineTotal(line: Line): number {
  if (!Number.isInteger(line.quantity) || line.quantity < 0) throw new Error("Quantity must be a whole number");
  return line.unitMinor * line.quantity;
}

export function sumLines(lines: Line[]): number {
  return lines.reduce((acc, l) => acc + lineTotal(l), 0);
}

/** Converts with a seller-set rate. Never presented as live FX. */
export function convertMinor(minor: number, from: CurrencyCode, to: CurrencyCode, rate: number): number {
  if (!(rate > 0)) throw new Error("Rate must be positive");
  const major = minor / 10 ** exponent(from);
  return toMinor(major * rate, to);
}
