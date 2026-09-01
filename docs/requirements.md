# Salary Management System — Requirements

**Persona:** HR Manager at ACME, an organization of ~10,000 employees across multiple countries.

## 1. Goal

Replace the spreadsheet-based salary process with a web application that lets a single HR Manager manage employee salary records and answer the question *"how does the org pay people?"* without exporting anything to Excel.

Two things must be true for the MVP to be considered successful:

1. The HR Manager can find any employee in the 10 000-record dataset in a few seconds and update their salary.
2. The HR Manager can see organization-wide pay figures, normalized across currencies, on one screen.

## 2. Architecture

| Layer | Choice | Reasoning |
| --- | --- | --- |
| Backend | Python + FastAPI | Matches the JD. Async-capable, typed request/response models via Pydantic, OpenAPI for free. |
| Persistence | SQLite + SQLAlchemy 2.0 ORM | Single-file DB is sufficient for 10k rows and keeps setup to zero. SQLAlchemy keeps the door open to Postgres without rewriting queries. |
| Migrations | Alembic | Schema changes are versioned and replayable, which matters once the seeded database exists. |
| Frontend | React (Vite) + TypeScript + Tailwind, with TanStack Query/Table, Recharts, and Radix primitives | Chosen over a full component kit because the directory's paging, sorting and filtering are all server-driven, and a headless table keeps that contract explicit rather than adapting a component with its own opinions about state. Radix supplies accessible dropdown and dialog behaviour without imposing a visual style. |
| Deployment | Vercel (frontend) + Render (backend with a persistent volume for the SQLite file) | Free tiers, straightforward CI from git. |

Aggregation is done in SQL, not in Python or the browser. The API returns already-computed totals so the client never holds the full dataset.

## 3. Data Model

Normalized, with lookup tables so that dashboard groupings and directory filters read from a single source of truth rather than free-text strings.

- **country** — `id`, `name`, `iso_code`, `default_currency_code`
- **department** — `id`, `name`
- **job_level** — `id`, `title`, `rank` (ordering for the compensation ladder)
- **currency** — `code` (ISO 4217, PK), `name`, `symbol`, `minor_unit` (decimal places, e.g. 2 for USD, 0 for JPY)
- **exchange_rate** — `currency_code` (FK), `rate_to_usd`. One static row per currency, seeded.
- **employee** — `id`, `first_name`, `last_name`, `email` (unique), `country_id`, `department_id`, `job_level_id`, `base_salary` (integer minor units), `currency_code`, `hire_date`, `exit_date` (nullable), `created_at`, `updated_at`

Notes on the deliberate choices:

- Salary is stored as an **integer in minor units** in the employee's **native currency**. SQLite has no exact decimal storage class, so a decimal column round-trips through a float; summing 10 000 of those and multiplying each by a rate makes the payroll total depend on row order. Integer arithmetic is exact, and scaling happens once, at the serialization boundary, so the raw integer never escapes the API.
- Minor units are **not assumed to be hundredths**. `currency.minor_unit` drives the scaling, since JPY and KRW have zero decimal places and a hardcoded ÷100 would misreport those salaries by 100x.
- Currency metadata and exchange rates are **separate tables** despite being 1:1 today. Name, symbol, and decimal places are immutable properties of a currency; rates are volatile. Splitting on rate of change means effective-dating rates later touches one table instead of the one that everything joins to.
- USD normalization happens **at read time** (`base_salary * rate_to_usd`), never at write time, so the stored value is never lossy.
- `exit_date` implements **soft delete** and is the single source of truth for employment status. Salary records are financial history; hard deletes are not acceptable.
- Status is **derived, not stored**: an employee is active when `exit_date` is null or still in the future. A stored `is_active` flag alongside a date would let the two disagree, and departures would need a scheduled job to take effect. Deriving means a future-dated exit becomes effective on its own date. The API still exposes `is_active` as a computed field, so clients need not reimplement the rule.
- A future `exit_date` means **leaving but still employed**: the person is counted in headcount and pay reporting until the date arrives, because they are still being paid.

## 4. Features In Scope

**Employee Directory**
- Server-side pagination, sorting, and search over 10,000 records. Search matches name and email.
- Filters on country, department, job level, and active/inactive status. Multiple values within one filter are OR-matched; different filters are AND-matched.
- Sorting by salary orders on the USD-normalized value, since comparing raw local amounts would rank ₹5,000,000 above $200,000.
- Indexes on the filter and sort columns so queries stay fast at full dataset size.

**Employee CRUD**
- View a single employee's detail.
- Add a new employee.
- Edit an employee (PATCH: only the fields sent are changed).
- Record a departure by setting an exit date, defaulting to today; a future date schedules it. Reinstating clears the date and also cancels a scheduled departure. Exit dates before the hire date are rejected.
- Pay currency is derived from the employee's country rather than submitted, so the two cannot contradict each other. Changing country therefore changes the currency, and the request must supply a new salary — the stored figure is denominated in the old currency and reinterpreting it would silently misstate someone's pay.
- Server-side validation: unique email (409), non-negative salary, existing lookup references, and no more decimal places than the currency supports (422).

**Pay Analytics Dashboard**
- KPI cards, all normalized to USD and computed over active employees:
  - Total annual payroll spend
  - Headcount
  - Average salary
  - Median salary — shown alongside the average because pay is right-skewed. In the seeded data the mean sits 1.17x the median, so the two answer different questions: what the org spends per head, versus what a typical person earns.
  - Leaving soon — active employees with a departure already scheduled
- Breakdowns, each showing total payroll spend, headcount, and average salary, ranked by spend:
  - By country
  - By department
- Filterable by country, department, and job level, using the same predicates as the directory. Deliberately no search box, since a dashboard answers "how do we pay this group" rather than "find this person", and no status filter, since the figures are always about people currently being paid.
- Every figure is aggregated in SQL and returned already reduced, in a fixed four queries regardless of headcount. Median is computed with a window function, since SQLite has no percentile aggregate.

**Seeding**
- A script that generates 10 000 deterministic synthetic employees spread across the seeded countries, departments, and job levels, with salaries in their local currencies.

**Testing**
- Unit tests for currency normalization, median calculation, and validation rules.
- API-level tests for directory querying (pagination, filtering, sorting) and CRUD, against an in-memory SQLite database so they stay fast and deterministic.

## 5. Explicitly Out of Scope

| Excluded | Reasoning |
| --- | --- |
| Payroll processing — tax, statutory deductions, benefits, bonuses, payslips | Named out of scope in the brief. Each is country-specific and would dominate the build without demonstrating anything about data management or reporting. |
| Authentication, roles, employee self-service | The brief states the user is an already-authenticated internal HR Manager. Building RBAC would add surface area with no assessed value. |
| Excel/CSV bulk import | The brief states a seed script is sufficient. |
| Salary change history / audit trail | Edits overwrite in place. A real system would need this, but the MVP is scoped to current-state management, and adding it changes both the data model and every read path. Called out as the first thing to add post-MVP. |
| Time-varying exchange rates | A single static seeded rate per currency. Effective-dated rates only matter for historical reporting, which is out of scope alongside salary history. |
| Payroll cost over time | Hire and exit dates make it possible to reconstruct who was employed on any past date, but there is no salary history, so every past point would be computed from people's *current* pay. The chart would look authoritative and quietly misattribute today's salaries to last year's headcount. Excluded on accuracy grounds, not effort. |
| Salary distribution histogram / pay bands, and breakdown by job level | Country and department breakdowns already answer "how the org pays people". Further slices are additive rather than informative at MVP, and each adds a query, an endpoint, and a chart to maintain. |
| Postgres, caching, background jobs | 10,000 rows is small. Indexed SQLite queries are well within budget; adding infrastructure would be premature. |

## 6. Trade-offs Summary

- **SQLite over Postgres** — sufficient at this scale, zero operational cost; the ORM boundary keeps migration cheap if it stops being true.
- **Normalized lookups over free-text columns** — more joins and more seed setup, but filters and groupings become reliable and the data cannot drift.
- **Read-time currency conversion over stored USD values** — one multiplication per row on read, in exchange for never corrupting the source figure or having to backfill when a rate changes.
- **Server-side pagination and aggregation over client-side** — more endpoints to build and test, but the UI never loads 10 000 records and performance is independent of dataset size.
