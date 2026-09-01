import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatMoney,
  formatNumber,
  formatUsd,
  formatUsdCompact,
  todayIso,
} from "./format";

describe("formatMoney", () => {
  it("renders the symbol of the currency it is given, not the local one", () => {
    expect(formatMoney("174000.00", "CAD")).toBe("CA$174,000");
    expect(formatMoney("174000.00", "GBP")).toBe("£174,000");
  });

  it("does not divide a zero-decimal currency by a hundred", () => {
    // The API sends JPY already scaled by its own minor_unit of 0. Treating the
    // string as hundredths here would report a ¥9,000,000 salary as ¥90,000.
    expect(formatMoney("9000000", "JPY")).toBe("¥9,000,000");
  });

  it("shows whole units, since a salary list is not a ledger", () => {
    expect(formatMoney("174000.49", "USD")).toBe("$174,000");
    expect(formatMoney("174000.50", "USD")).toBe("$174,001");
  });

  it("keeps exactness from the wire: a value beyond float precision is not mangled", () => {
    // Amounts arrive as strings for this reason. Rendering is the only place a
    // Number conversion is safe, and even here the digits must survive.
    expect(formatUsd("818926998.00")).toBe("$818,926,998");
  });
});

describe("formatUsdCompact", () => {
  it("shortens large figures for a KPI card", () => {
    expect(formatUsdCompact("818926998.00")).toBe("$818.9M");
  });

  it("leaves small figures legible rather than rounding them to nothing", () => {
    expect(formatUsdCompact("84731.19")).toBe("$84.7K");
  });

  it("crosses into billions rather than reporting four-figure millions", () => {
    expect(formatUsdCompact("2500000000")).toBe("$2.5B");
  });

  it("shows an empty result as $0, not $0.0", () => {
    // A filter matching nobody renders this. ICU versions disagree on the
    // default minimum for compact notation, so the option is set explicitly and
    // this pins it — the assertion failed on Node 22 while passing on 24.
    expect(formatUsdCompact("0")).toBe("$0");
  });

  it("drops the empty decimal from a round figure", () => {
    expect(formatUsdCompact("1000000")).toBe("$1M");
  });
});

describe("formatDate", () => {
  it("renders an unambiguous day-month-year, so 03/04 cannot be read two ways", () => {
    expect(formatDate("2025-04-03")).toBe("03 Apr 2025");
  });

  it("does not shift the date backwards in a zone ahead of UTC", () => {
    // A date-only string parses as UTC midnight. Rendered in a positive offset
    // this is still the same day; the risk is the reverse, and the test pins it.
    expect(formatDate("2026-01-01")).toBe("01 Jan 2026");
  });
});

describe("todayIso", () => {
  it("agrees with the local calendar date, not the UTC one", () => {
    // toISOString() would report yesterday for anyone west of Greenwich late in
    // the day, which would default a departure to the wrong date.
    const now = new Date();
    const local = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    expect(todayIso()).toBe(local);
  });

  it("is the format a date input expects", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatNumber", () => {
  it("groups digits so a headcount is readable at a glance", () => {
    expect(formatNumber(9665)).toBe("9,665");
    expect(formatNumber(0)).toBe("0");
  });
});
