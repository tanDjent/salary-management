# Salary Management System

A salary management system for an HR Manager at a ~10,000-person organization spread across
multiple countries, replacing a spreadsheet-based process. It does two things: it makes any
employee findable and editable in a few seconds, and it answers *"how does the org pay
people?"* on one screen, normalized across currencies.

**Live:** [app](https://salary-management-sooty.vercel.app) ·
[API docs](https://salary-management-api-u7yt.onrender.com/docs)

> The API is on Render's free tier, which spins down after 15 minutes of inactivity. The first
> request after an idle period takes about a minute to wake it up, and may time out once before
> succeeding. It is not broken; give it a reload.

**Documents:** [Requirements and trade-offs](docs/requirements.md) — the scope, the data model,
and what was deliberately left out, with reasoning. [Learning notes](LEARNING-NOTES.md) — a
running record of the decisions as they were made.

## Running it locally

You need Python 3.13 and Node 22 (see [`.nvmrc`](frontend/.nvmrc)). Both are pinned to match CI
and the deployed environments — `Intl` output varies between Node releases, so an unpinned
version means formatting assertions can pass locally and fail in CI. The suite is verified on 22
and 24. The two halves run as separate processes.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

alembic upgrade head          # build the schema
python -m app.seed.run        # 10,000 deterministic employees, ~15s

uvicorn app.main:app --reload
```

The API is then on `http://127.0.0.1:8000`, with interactive docs at `/docs`.

Seeding is idempotent — it exits early if employees already exist, so re-running it will not
duplicate data or discard edits. `--reset` clears the tables first, `--count N` generates a
smaller dataset, and `--seed N` changes the RNG seed. The default seed is fixed, so the same
10,000 people with the same salaries appear on every machine, which is what lets the tests
assert against real distributions.

No configuration is needed to run locally; the defaults in `app/core/config.py` point at a
SQLite file in `backend/`. See [`.env.example`](backend/.env.example) for the variables that
matter in a deployment.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173`. Vite proxies `/api` to the backend, so the browser talks to a
single origin and CORS never applies in development. `VITE_API_ROOT` is only needed for deployed
builds, where the two halves sit on different origins — see
[`.env.example`](frontend/.env.example).

## Tests

```bash
cd backend  && pytest                              # 171 tests, ~4s
cd frontend && npm test                            # 59 tests, ~2s
cd frontend && npm run lint && npm run build       # lint and typecheck
```

The backend suite runs against in-memory SQLite, so it needs no setup and no running server. The
frontend suite is Vitest with Testing Library, and stubs only the network.

Tests are written against behaviour through the API rather than against service internals, which
means the endpoint, the query, and the serialization are all covered by one assertion and
refactoring the layers underneath does not break them. The interesting ones check properties
rather than fixed values: that breakdowns sum to the totals, that a filtered listing agrees with
the dashboard card counting the same people, that the analytics endpoint issues a constant four
queries regardless of headcount. Where the arithmetic is easy to get subtly wrong — median,
minor-unit scaling — the expected value is computed independently in Python rather than copied
from the implementation.

On the frontend the same principle picks the targets: the formatters, where a currency with no
minor unit or a timezone west of Greenwich changes the answer; the filter hook, where one
dropdown maps onto two independent API flags; and the employee form, where changing someone's
country changes the currency their salary is denominated in. Components are driven through the
DOM the way a user drives them, with only the network stubbed, so the assertions survive
refactoring the internals.

Several tests were confirmed by mutation rather than assumed to work — breaking the median
calculation, the `is_active` derivation, the salary-clearing on relocation, the status mapping,
and the timezone handling in `todayIso`, then checking the suite went red for each. Two earned
their place that way: the median test caught a real bug where SQLAlchemy's `/` produced float
division in a window function that needed integer division, and writing the form tests turned up
a dead ternary in `formatMoney` whose branches were identical.

## How it is put together

```
backend/
  app/
    api/routes/     HTTP layer: request parsing, status codes
    services/       business logic, returns domain objects and raises domain errors
    models/         SQLAlchemy ORM
    schemas/        Pydantic request and response contracts
    seed/           deterministic data generation
  alembic/          versioned migrations
frontend/src/
  api/              typed fetch functions, one module per resource
  app/pages/        Dashboard and Employees, each owning its components and hooks
  common/           reusable UI primitives
```

Routes translate HTTP to service calls and domain errors back to status codes; they hold no
business logic. Services never import FastAPI, so the rules are testable without a request and
the same logic can back a CLI or a scheduled job later.

Four decisions shaped most of the rest, and the reasoning for each is in
[the requirements doc](docs/requirements.md):

**Salary is an integer in minor units, in the employee's local currency.** SQLite has no exact
decimal type, so a decimal column round-trips through a float and summing 10,000 of them makes
the payroll total depend on row order. `currency.minor_unit` drives the scaling rather than an
assumed ÷100, because JPY has zero decimal places and a hardcoded hundred would misreport those
salaries by 100x. Conversion to USD happens at read time, so the stored figure is never lossy.

**Employment status is derived from `exit_date`, not stored.** A boolean beside a date can
disagree with it, and departures would need a scheduled job to take effect. Deriving means a
future-dated exit becomes effective on its own date, and gives a third state the UI needs:
someone serving notice is still employed and still counted in payroll. The SQL predicate and the
Python check live in one module so a filtered list and the badge on a row cannot contradict each
other.

**Aggregation happens in SQL.** The analytics endpoint returns already-reduced figures in a fixed
four queries, so the browser never holds 10,000 records and response time is independent of
headcount. Median uses a window function, since SQLite has no percentile aggregate.

**The dashboard and the directory share filter logic.** The same predicates build both, so a KPI
card and the list it links to cannot disagree — clicking a count always resolves to exactly the
people it counted.

## Deployment

The frontend is on Vercel and the API on Render, both deploying from `main`.
[`render.yaml`](render.yaml) is a Blueprint: it builds from `backend/`, then migrates and seeds
before starting uvicorn. The free plan's disk is ephemeral, so each deploy returns the dataset to
its deterministic seeded state — the file has comments showing how to attach a disk if writes
need to survive.

CI runs on every push: the backend suite, a check that migrations apply and roll back cleanly on
an empty database, and a check that the models have not drifted from the migration history. A
third job installs only the runtime requirements and runs the deploy's own migrate-and-seed
sequence, because the test job installs a superset and so cannot notice a production import
declared as a dev dependency. That job exists because exactly this reached production once.

## Known gaps

Honest about what a reviewer will notice. Salary edits overwrite in place — there is no change
history, which a real system needs and which is the first thing to add. Exchange rates are static
and unversioned. There is no authentication, per the brief. The frontend tests cover the logic
that can be wrong — formatting, filter state, form rules — but not the pages end to end, so a
broken wire-up between a page and its hook would pass; there are no browser-level tests.
