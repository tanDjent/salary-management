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
      // Salaries are shown as whole units in every currency: the cents are noise
      // in a directory, and a column of them is harder to scan down.
      maximumFractionDigits: 0,
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

const COMPACT_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  // Explicit rather than defaulted: ICU versions disagree on the minimum for
  // compact notation, so leaving it out renders zero as "$0" on one Node
  // release and "$0.0" on another. It also drops the empty decimal from a round
  // figure, so a million reads "$1M".
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Shortens large figures for KPI cards, where "$818.9M" reads at a glance and
 *  "$818,926,998" does not. The exact figure is shown on hover. */
export function formatUsdCompact(amount: string): string {
  return COMPACT_USD.format(Number(amount));
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatDate(isoDate: string): string {
  return DATE_FORMATTER.format(new Date(isoDate));
}

/** Today as YYYY-MM-DD, for date inputs and for comparing against exit dates.
 *
 *  Built from the local calendar date rather than toISOString(), which converts
 *  to UTC and would report yesterday for anyone west of Greenwich late in the day.
 */
export function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}
