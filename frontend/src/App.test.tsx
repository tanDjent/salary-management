import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "./App";
import ToastProvider from "./common/toast/ToastProvider";

// The pages fetch on mount; routing is what is under test, not their contents.
vi.mock("./api/employees", () => ({ fetchEmployees: vi.fn(() => new Promise(() => {})) }));
vi.mock("./api/analytics", () => ({ fetchAnalytics: vi.fn(() => new Promise(() => {})) }));
vi.mock("./api/lookups", () => ({ fetchLookups: vi.fn(() => new Promise(() => {})) }));

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("routing", () => {
  it("shows the dashboard at the root", () => {
    renderAt("/");

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("shows the directory at /employees", () => {
    renderAt("/employees");

    expect(screen.getByRole("heading", { name: "Employees" })).toBeInTheDocument();
  });

  it("shows a not-found page for an unknown path, not a blank layout", () => {
    // Vercel rewrites unknown paths to index.html so deep links survive a
    // refresh, which means a typo arrives here rather than at a host 404.
    renderAt("/employeez");

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("Nothing lives at /employeez")).toBeInTheDocument();
  });

  it("keeps the navigation available so a wrong turn is recoverable", () => {
    renderAt("/nope");

    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Browse employees" })).toHaveAttribute(
      "href",
      "/employees",
    );
  });
});
