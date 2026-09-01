import { api, buildUrl } from "./client";

/** Money arrives as decimal strings for the same reason salaries do: parsing to
 *  a JS float would reintroduce the rounding the backend works to avoid. */
export type Totals = {
  headcount: number;
  total_spend_usd: string;
  /** Null when no one matches the filters. An average of nothing is not zero. */
  average_salary_usd: string | null;
  median_salary_usd: string | null;
  /** Active employees with a departure already scheduled. */
  leaving_soon: number;
};

export type Breakdown = {
  id: number;
  name: string;
  headcount: number;
  total_spend_usd: string;
  average_salary_usd: string;
};

export type Analytics = {
  totals: Totals;
  by_country: Breakdown[];
  by_department: Breakdown[];
};

/** A subset of the directory's filters: no search, and no status, since the
 *  dashboard always reports on people currently being paid. */
export type AnalyticsFilters = {
  country_id?: number[];
  department_id?: number[];
  job_level_id?: number[];
};

export function fetchAnalytics(filters: AnalyticsFilters): Promise<Analytics> {
  return api.get<Analytics>(buildUrl("/analytics", { ...filters }));
}
