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
| Frontend | React (Vite) + Material UI | MUI's `DataGrid` and card/chart primitives cover the directory and dashboard without hand-building table UX. |
| Deployment | Vercel (frontend) + Render (backend with a persistent volume for the SQLite file) | Free tiers, straightforward CI from git. |

Aggregation is done in SQL, not in Python or the browser. The API returns already-computed totals so the client never holds the full dataset.

## 3. Data Model

Normalized, with lookup tables so that dashboard groupings and directory filters read from a single source of truth rather than free-text strings.

- **country** — `id`, `name`, `iso_code`, `default_currency_code`
- **department** — `id`, `name`
- **job_level** — `id`, `title`, `rank` (ordering for the compensation ladder)
- **currency** — `code` (ISO 4217, PK), `name`, `symbol`, `minor_unit` (decimal places, e.g. 2 for USD, 0 for JPY)
- **exchange_rate** — `currency_code` (FK), `rate_to_usd`. One static row per currency, seeded.
- **employee** — `id`, `first_name`, `last_name`, `email` (unique), `country_id`, `department_id`, `job_level_id`, `base_salary` (integer minor units), `currency_code`, `hire_date`, `is_active`, `created_at`, `updated_at`

Notes on the deliberate choices:

- Salary is stored as an **integer in minor units** in the employee's **native currency**. SQLite has no exact decimal storage class, so a decimal column round-trips through a float; summing 10 000 of those and multiplying each by a rate makes the payroll total depend on row order. Integer arithmetic is exact, and scaling happens once, at the serialization boundary, so the raw integer never escapes the API.
- Minor units are **not assumed to be hundredths**. `currency.minor_unit` drives the scaling, since JPY and KRW have zero decimal places and a hardcoded ÷100 would misreport those salaries by 100x.
- Currency metadata and exchange rates are **separate tables** despite being 1:1 today. Name, symbol, and decimal places are immutable properties of a currency; rates are volatile. Splitting on rate of change means effective-dating rates later touches one table instead of the one that everything joins to.
- USD normalization happens **at read time** (`base_salary * rate_to_usd`), never at write time, so the stored value is never lossy.
- `is_active` implements **soft delete**. Salary records are financial history; hard deletes are not acceptable. Deactivated employees are excluded from analytics by default.

## 4. Features In Scope

**Employee Directory**
- Server-side pagination, sorting, and search over 10,000 records. Search matches name and email.
- Filters on country, department, job level, and active/inactive status.
- Indexes on the filter and sort columns so queries stay fast at full dataset size.

**Employee CRUD**
- View a single employee's detail.
- Add a new employee.
- Edit an employee, including their salary and currency.
- Deactivate (soft-delete) and reactivate.
- Server-side validation: unique email, non-negative salary, valid currency and lookup references.

**Pay Analytics Dashboard**
- KPI cards, all normalized to USD and computed over active employees:
  - Total payroll spend
  - Headcount
  - Average salary
  - Median salary
- Breakdowns, each showing total payroll spend, headcount, and average salary:
  - By country
  - By department

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
| Salary distribution histogram / pay bands, and breakdown by job level | Country and department breakdowns already answer "how the org pays people". Further slices are additive rather than informative at MVP, and each adds a query, an endpoint, and a chart to maintain. |
| Postgres, caching, background jobs | 10,000 rows is small. Indexed SQLite queries are well within budget; adding infrastructure would be premature. |

## 6. Trade-offs Summary

- **SQLite over Postgres** — sufficient at this scale, zero operational cost; the ORM boundary keeps migration cheap if it stops being true.
- **Normalized lookups over free-text columns** — more joins and more seed setup, but filters and groupings become reliable and the data cannot drift.
- **Read-time currency conversion over stored USD values** — one multiplication per row on read, in exchange for never corrupting the source figure or having to backfill when a rate changes.
- **Server-side pagination and aggregation over client-side** — more endpoints to build and test, but the UI never loads 10 000 records and performance is independent of dataset size.
