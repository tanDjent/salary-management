from decimal import Decimal

from sqlalchemy import select

from app.models import Country, Department, Employee, JobLevel

LIST_URL = "/api/employees"


def ids_on_page(payload: dict) -> list[int]:
    return [item["id"] for item in payload["items"]]


class TestPagination:
    def test_returns_first_page_by_default(self, client):
        body = client.get(LIST_URL).json()

        assert body["page"] == 1
        assert body["page_size"] == 25
        assert len(body["items"]) == 25
        assert body["total"] == 200
        assert body["total_pages"] == 8

    def test_respects_page_size(self, client):
        body = client.get(LIST_URL, params={"page_size": 10}).json()

        assert len(body["items"]) == 10
        assert body["total_pages"] == 20

    def test_pages_do_not_overlap(self, client):
        first = client.get(LIST_URL, params={"page": 1, "page_size": 10}).json()
        second = client.get(LIST_URL, params={"page": 2, "page_size": 10}).json()

        assert set(ids_on_page(first)).isdisjoint(ids_on_page(second))

    def test_last_page_may_be_partial(self, client):
        body = client.get(LIST_URL, params={"page": 7, "page_size": 30}).json()

        assert len(body["items"]) == 20

    def test_page_beyond_the_end_is_empty_not_an_error(self, client):
        body = client.get(LIST_URL, params={"page": 999}).json()

        assert body["items"] == []
        assert body["total"] == 200

    def test_total_is_unaffected_by_paging(self, client):
        assert all(
            client.get(LIST_URL, params={"page": page}).json()["total"] == 200
            for page in (1, 2, 3)
        )

    def test_rejects_page_size_above_the_cap(self, client):
        assert client.get(LIST_URL, params={"page_size": 500}).status_code == 422

    def test_rejects_page_below_one(self, client):
        assert client.get(LIST_URL, params={"page": 0}).status_code == 422


class TestSorting:
    def test_defaults_to_newest_hire_first(self, client):
        dates = [item["hire_date"] for item in client.get(LIST_URL).json()["items"]]

        assert dates == sorted(dates, reverse=True)

    def test_sorts_by_last_name_ascending(self, client):
        body = client.get(
            LIST_URL, params={"sort_by": "last_name", "sort_dir": "asc"}
        ).json()
        names = [item["last_name"] for item in body["items"]]

        assert names == sorted(names)

    def test_sorts_by_normalised_usd_not_raw_amount(self, client):
        """The point of USD sorting: a large INR figure must not outrank a USD one."""
        body = client.get(
            LIST_URL, params={"sort_by": "salary_usd", "sort_dir": "desc", "page_size": 50}
        ).json()

        usd = [Decimal(item["salary"]["amount_usd"]) for item in body["items"]]
        assert usd == sorted(usd, reverse=True)

        local = [Decimal(item["salary"]["amount"]) for item in body["items"]]
        assert local != sorted(local, reverse=True), "test data lacks mixed currencies"

    def test_ordering_is_stable_across_pages(self, client):
        """Ties broken by id, so no row is repeated or skipped while paging."""
        seen: list[int] = []
        for page in range(1, 9):
            body = client.get(
                LIST_URL, params={"page": page, "page_size": 25, "sort_by": "hire_date"}
            ).json()
            seen.extend(ids_on_page(body))

        assert len(seen) == len(set(seen)) == 200

    def test_rejects_unknown_sort_field(self, client):
        assert client.get(LIST_URL, params={"sort_by": "ssn"}).status_code == 422


class TestFiltering:
    def test_filters_by_single_country(self, client, seeded_db):
        country_id = seeded_db.scalar(select(Country.id).where(Country.iso_code == "IN"))
        body = client.get(LIST_URL, params={"country_id": country_id}).json()

        assert body["total"] > 0
        assert {item["country"]["id"] for item in body["items"]} == {country_id}

    def test_multiple_values_for_one_filter_are_or_matched(self, client, seeded_db):
        ids = list(seeded_db.scalars(select(Country.id).limit(2)))
        body = client.get(LIST_URL, params={"country_id": ids, "page_size": 100}).json()

        assert set(ids).issuperset({item["country"]["id"] for item in body["items"]})
        assert body["total"] > 0

    def test_different_filters_are_and_matched(self, client, seeded_db):
        country_id = seeded_db.scalar(select(Country.id))
        department_id = seeded_db.scalar(
            select(Department.id).where(Department.name == "Engineering")
        )
        body = client.get(
            LIST_URL,
            params={"country_id": country_id, "department_id": department_id},
        ).json()

        for item in body["items"]:
            assert item["country"]["id"] == country_id
            assert item["department"]["id"] == department_id

    def test_filters_by_job_level(self, client, seeded_db):
        level_id = seeded_db.scalar(select(JobLevel.id).where(JobLevel.title == "Senior"))
        body = client.get(LIST_URL, params={"job_level_id": level_id}).json()

        assert {item["job_level"]["id"] for item in body["items"]} == {level_id}

    def test_filters_to_active_only(self, client):
        body = client.get(LIST_URL, params={"is_active": True, "page_size": 100}).json()

        assert all(item["is_active"] for item in body["items"])

    def test_filters_to_inactive_only(self, client):
        body = client.get(LIST_URL, params={"is_active": False}).json()

        assert body["total"] > 0
        assert not any(item["is_active"] for item in body["items"])

    def test_unfiltered_listing_includes_both_statuses(self, client):
        """The API stays neutral on status; the UI picks its own default."""
        active = client.get(LIST_URL, params={"is_active": True}).json()["total"]
        inactive = client.get(LIST_URL, params={"is_active": False}).json()["total"]

        assert active + inactive == 200

    def test_filters_narrow_the_total_not_just_the_page(self, client):
        body = client.get(LIST_URL, params={"is_active": False}).json()

        assert body["total"] < 200


class TestSearch:
    def test_matches_partial_last_name(self, client, seeded_db):
        last_name = seeded_db.scalar(select(Employee.last_name))
        body = client.get(LIST_URL, params={"q": last_name[:4]}).json()

        assert body["total"] > 0

    def test_is_case_insensitive(self, client, seeded_db):
        last_name = seeded_db.scalar(select(Employee.last_name))
        lower = client.get(LIST_URL, params={"q": last_name.lower()}).json()
        upper = client.get(LIST_URL, params={"q": last_name.upper()}).json()

        assert lower["total"] == upper["total"] > 0

    def test_matches_email(self, client, seeded_db):
        email = seeded_db.scalar(select(Employee.email))
        body = client.get(LIST_URL, params={"q": email}).json()

        assert ids_on_page(body) != []
        assert body["items"][0]["email"] == email

    def test_no_match_returns_empty_page(self, client):
        body = client.get(LIST_URL, params={"q": "zzzznotarealperson"}).json()

        assert body["items"] == []
        assert body["total"] == 0

    def test_combines_with_filters(self, client, seeded_db):
        country_id = seeded_db.scalar(select(Country.id))
        body = client.get(LIST_URL, params={"q": "a", "country_id": country_id}).json()

        assert all(item["country"]["id"] == country_id for item in body["items"])


class TestSalaryRepresentation:
    def test_exposes_local_amount_currency_and_usd(self, client):
        salary = client.get(LIST_URL).json()["items"][0]["salary"]

        assert set(salary) == {"amount", "currency", "amount_usd"}

    def test_amounts_serialise_as_strings_not_floats(self, client):
        """Floats in JSON would undo the exactness the integer storage buys."""
        salary = client.get(LIST_URL).json()["items"][0]["salary"]

        assert isinstance(salary["amount"], str)
        assert isinstance(salary["amount_usd"], str)

    def test_usd_equals_local_for_usd_employees(self, client, seeded_db):
        country_id = seeded_db.scalar(select(Country.id).where(Country.iso_code == "US"))
        body = client.get(LIST_URL, params={"country_id": country_id}).json()

        for item in body["items"]:
            assert item["salary"]["currency"] == "USD"
            assert Decimal(item["salary"]["amount"]) == Decimal(item["salary"]["amount_usd"])

    def test_zero_decimal_currency_is_not_divided_by_a_hundred(self, client, seeded_db):
        """A JPY salary must read as millions of yen, not tens of thousands."""
        country_id = seeded_db.scalar(select(Country.id).where(Country.iso_code == "JP"))
        body = client.get(LIST_URL, params={"country_id": country_id}).json()

        assert body["items"], "fixture has no JPY employees to assert on"
        for item in body["items"]:
            assert item["salary"]["currency"] == "JPY"
            assert Decimal(item["salary"]["amount"]) > 1_000_000


class TestGetEmployee:
    def test_returns_a_single_employee(self, client, seeded_db):
        employee_id = seeded_db.scalar(select(Employee.id))
        response = client.get(f"{LIST_URL}/{employee_id}")

        assert response.status_code == 200
        assert response.json()["id"] == employee_id

    def test_includes_the_same_nested_shape_as_the_list(self, client, seeded_db):
        employee_id = seeded_db.scalar(select(Employee.id))
        detail = client.get(f"{LIST_URL}/{employee_id}").json()

        assert set(detail["salary"]) == {"amount", "currency", "amount_usd"}
        assert "name" in detail["country"]

    def test_unknown_id_returns_404(self, client):
        assert client.get(f"{LIST_URL}/999999").status_code == 404


class TestQueryEfficiency:
    def test_page_size_does_not_change_the_query_count(self, client, query_counter):
        """Guards against N+1: serialising nested lookups must not query per row."""
        client.get(LIST_URL, params={"page_size": 5})
        small = len(query_counter)

        query_counter.clear()
        client.get(LIST_URL, params={"page_size": 100})
        large = len(query_counter)

        assert small == large

    def test_sorting_by_usd_adds_no_extra_queries(self, client, query_counter):
        client.get(LIST_URL, params={"page_size": 25})
        default = len(query_counter)

        query_counter.clear()
        client.get(LIST_URL, params={"page_size": 25, "sort_by": "salary_usd"})

        assert len(query_counter) == default
