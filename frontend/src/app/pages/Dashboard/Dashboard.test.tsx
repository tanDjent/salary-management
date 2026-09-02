import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "./Dashboard";

vi.mock("../../../api/analytics", () => ({ fetchAnalytics: vi.fn() }));
vi.mock("../../../api/lookups", () => ({ fetchLookups: vi.fn() }));

const { fetchAnalytics } = await import("../../../api/analytics");
const { fetchLookups } = await import("../../../api/lookups");

const analytics = {
  totals: {
    headcount: 9665,
    total_spend_usd: "818926998.00",
    average_salary_usd: "84731.19",
    median_salary_usd: "72594.00",
    leaving_soon: 56,
  },
  by_country: [
    {
      id: 1,
      name: "United States",
      headcount: 2919,
      total_spend_usd: "340653200.00",
      average_salary_usd: "116702.02",
    },
  ],
  by_department: [
    {
      id: 1,
      name: "Engineering",
      headcount: 3100,
      total_spend_usd: "300000000.00",
      average_salary_usd: "96774.19",
    },
  ],
};

function renderDashboard(url = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(fetchAnalytics).mockResolvedValue(analytics as never);
  vi.mocked(fetchLookups).mockResolvedValue({
    countries: [{ id: 1, name: "India", iso_code: "IN", default_currency_code: "INR" }],
    departments: [{ id: 2, name: "Sales" }],
    job_levels: [{ id: 3, title: "Senior", rank: 3 }],
  } as never);
});

describe("the figures", () => {
  it("shortens payroll spend so the card reads at a glance", async () => {
    renderDashboard();

    expect(await screen.findByText("$818.9M")).toBeInTheDocument();
  });

  it("shows headcount grouped, not as a bare digit string", async () => {
    renderDashboard();

    expect(await screen.findByText("9,665")).toBeInTheDocument();
  });

  it("shows median beside average, since pay is right-skewed", async () => {
    // The two answer different questions and the dashboard is wrong without
    // both: spend per head versus what a typical person earns.
    renderDashboard();

    expect(await screen.findByText("Average salary")).toBeInTheDocument();
    expect(await screen.findByText("Median salary")).toBeInTheDocument();
  });
});

describe("drilling down into a number", () => {
  it("links headcount to the people it counted, not to everyone", async () => {
    renderDashboard();

    const link = (await screen.findByText("9,665")).closest("a");
    expect(link).toHaveAttribute("href", "/employees?status=active");
  });

  it("links leaving soon to the matching directory filter", async () => {
    renderDashboard();

    const link = (await screen.findByText("56")).closest("a");
    expect(link).toHaveAttribute("href", "/employees?status=leaving");
  });

  it("carries the dashboard's filters through to the directory", async () => {
    // The whole point of the link: a card reading 56 under an India filter must
    // open those 56, not quietly widen to the org. Without this the number and
    // the list it claims to explain would disagree.
    renderDashboard("/?country_id=1&department_id=2");

    const href = (await screen.findByText("56")).closest("a")?.getAttribute("href");
    const params = new URLSearchParams(href!.split("?")[1]);

    expect(params.get("status")).toBe("leaving");
    expect(params.getAll("country_id")).toEqual(["1"]);
    expect(params.getAll("department_id")).toEqual(["2"]);
  });

  it("carries every value of a multi-select, not just the first", async () => {
    renderDashboard("/?country_id=1&country_id=4");

    const href = (await screen.findByText("9,665")).closest("a")?.getAttribute("href");

    expect(new URLSearchParams(href!.split("?")[1]).getAll("country_id")).toEqual([
      "1",
      "4",
    ]);
  });

  it("does not link the money cards, which no list can reproduce", async () => {
    // A total spend figure has no corresponding set of rows to show, so making
    // it look clickable would promise something the directory cannot deliver.
    renderDashboard();

    expect((await screen.findByText("$818.9M")).closest("a")).toBeNull();
  });
});

describe("when the request fails", () => {
  it("says so rather than rendering zeroes that look like real figures", async () => {
    vi.mocked(fetchAnalytics).mockRejectedValue(new Error("Service unavailable"));
    renderDashboard();

    expect(await screen.findByText(/Could not load pay analytics/i)).toBeInTheDocument();
  });
});
