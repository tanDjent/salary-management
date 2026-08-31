import { api, buildUrl } from "./client";
import type { JobLevel, Lookup } from "./employees";

export type Country = Lookup & {
  iso_code: string;
  default_currency_code: string;
};

export type Lookups = {
  countries: Country[];
  departments: Lookup[];
  job_levels: JobLevel[];
};

export function fetchLookups(): Promise<Lookups> {
  return api.get<Lookups>(buildUrl("/lookups"));
}
