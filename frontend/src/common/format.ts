/**
 * Display formatting.
 *
 * The API sends amounts as decimal strings to keep them exact over the wire.
 * Converting to a number here is safe because the result is only ever rendered,
 * never stored or sent back.
 */

const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string): Intl.NumberFormat {
  let formatter = CURRENCY_FORMATTERS.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      // Intl already knows JPY has no minor unit, so digits are left to it.
      maximumFractionDigits: currency === "JPY" ? 0 : 0,
    });
    CURRENCY_FORMATTERS.set(currency, formatter);
  }
  return formatter;
}

export function formatMoney(amount: string, currency: string): string {
  return currencyFormatter(currency).format(Number(amount));
}

export function formatUsd(amount: string): string {
  return currencyFormatter("USD").format(Number(amount));
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatDate(isoDate: string): string {
  return DATE_FORMATTER.format(new Date(isoDate));
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}
