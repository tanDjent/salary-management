from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models import Country, Department, Employee, JobLevel

URL = "/api/employees"


@pytest.fixture
def lookup_ids(seeded_db) -> dict:
    return {
        "us": seeded_db.scalar(select(Country.id).where(Country.iso_code == "US")),
        "in": seeded_db.scalar(select(Country.id).where(Country.iso_code == "IN")),
        "jp": seeded_db.scalar(select(Country.id).where(Country.iso_code == "JP")),
        "department": seeded_db.scalar(select(Department.id)),
        "job_level": seeded_db.scalar(select(JobLevel.id)),
    }


@pytest.fixture
def new_employee(lookup_ids) -> dict:
    return {
        "first_name": "Ada",
        "last_name": "Lovelace",
        "email": "ada.lovelace@acme.example",
        "country_id": lookup_ids["us"],
        "department_id": lookup_ids["department"],
        "job_level_id": lookup_ids["job_level"],
        "salary": "120000.00",
        "hire_date": "2024-03-01",
    }


class TestCreate:
    def test_returns_201_and_the_created_employee(self, client, new_employee):
        response = client.post(URL, json=new_employee)

        assert response.status_code == 201
        assert response.json()["email"] == new_employee["email"]

    def test_persists_and_is_retrievable(self, client, new_employee):
        created_id = client.post(URL, json=new_employee).json()["id"]

        assert client.get(f"{URL}/{created_id}").status_code == 200

    def test_new_employees_are_active(self, client, new_employee):
        assert client.post(URL, json=new_employee).json()["is_active"] is True

    def test_currency_is_derived_from_country(self, client, new_employee):
        """No currency is submitted, so the two can never contradict."""
        assert "currency" not in new_employee
        assert client.post(URL, json=new_employee).json()["salary"]["currency"] == "USD"

    def test_salary_is_stored_in_minor_units(self, client, new_employee, seeded_db):
        created_id = client.post(URL, json=new_employee).json()["id"]

        stored = seeded_db.scalar(select(Employee.base_salary).where(Employee.id == created_id))
        assert stored == 12_000_000

    def test_duplicate_email_returns_409(self, client, new_employee):
        client.post(URL, json=new_employee)

        response = client.post(URL, json=new_employee)
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    def test_duplicate_email_is_case_insensitive(self, client, new_employee):
        client.post(URL, json=new_employee)
        clashing = {**new_employee, "email": new_employee["email"].upper()}

        assert client.post(URL, json=clashing).status_code == 409

    def test_unknown_country_returns_422(self, client, new_employee):
        assert client.post(URL, json={**new_employee, "country_id": 9999}).status_code == 422

    def test_unknown_department_returns_422(self, client, new_employee):
        assert (
            client.post(URL, json={**new_employee, "department_id": 9999}).status_code == 422
        )

    def test_unknown_job_level_returns_422(self, client, new_employee):
        assert client.post(URL, json={**new_employee, "job_level_id": 9999}).status_code == 422

    def test_negative_salary_is_rejected(self, client, new_employee):
        assert client.post(URL, json={**new_employee, "salary": "-1"}).status_code == 422

    def test_malformed_email_is_rejected(self, client, new_employee):
        assert client.post(URL, json={**new_employee, "email": "not-an-email"}).status_code == 422

    def test_blank_name_is_rejected(self, client, new_employee):
        assert client.post(URL, json={**new_employee, "first_name": "  "}).status_code == 422

    def test_missing_field_is_rejected(self, client, new_employee):
        del new_employee["hire_date"]

        assert client.post(URL, json=new_employee).status_code == 422

    def test_rejects_more_decimals_than_the_currency_supports(
        self, client, new_employee, lookup_ids
    ):
        """JPY has no subunit, so ¥5000.55 is not a real amount. Rounding it away
        would silently misstate someone's pay."""
        payload = {**new_employee, "country_id": lookup_ids["jp"], "salary": "5000000.55"}

        assert client.post(URL, json=payload).status_code == 422

    def test_failed_create_leaves_nothing_behind(self, client, new_employee):
        before = client.get(URL).json()["total"]
        client.post(URL, json={**new_employee, "country_id": 9999})

        assert client.get(URL).json()["total"] == before


class TestUpdate:
    @pytest.fixture
    def employee_id(self, client, new_employee) -> int:
        return client.post(URL, json=new_employee).json()["id"]

    def test_updates_a_single_field(self, client, employee_id):
        body = client.patch(f"{URL}/{employee_id}", json={"last_name": "Byron"}).json()

        assert body["last_name"] == "Byron"
        assert body["first_name"] == "Ada"

    def test_absent_fields_are_left_unchanged(self, client, employee_id):
        before = client.get(f"{URL}/{employee_id}").json()
        after = client.patch(f"{URL}/{employee_id}", json={"last_name": "Byron"}).json()

        assert after["email"] == before["email"]
        assert after["salary"] == before["salary"]
        assert after["hire_date"] == before["hire_date"]

    def test_updates_salary(self, client, employee_id):
        body = client.patch(f"{URL}/{employee_id}", json={"salary": "150000.00"}).json()

        assert Decimal(body["salary"]["amount"]) == Decimal("150000.00")

    def test_country_change_without_salary_is_rejected(self, client, employee_id, lookup_ids):
        """The stored figure is denominated in the old currency; changing country
        alone would silently reinterpret it."""
        response = client.patch(f"{URL}/{employee_id}", json={"country_id": lookup_ids["in"]})

        assert response.status_code == 422

    def test_country_change_with_salary_switches_currency(
        self, client, employee_id, lookup_ids
    ):
        body = client.patch(
            f"{URL}/{employee_id}",
            json={"country_id": lookup_ids["in"], "salary": "3600000"},
        ).json()

        assert body["country"]["name"] == "India"
        assert body["salary"]["currency"] == "INR"

    def test_relocation_recomputes_the_usd_figure_at_the_new_rate(
        self, client, employee_id, lookup_ids
    ):
        """Regression: a stale cached relationship once left the old rate applied,
        reporting ₹3,600,000 as $3,600,000 instead of $43,200."""
        body = client.patch(
            f"{URL}/{employee_id}",
            json={"country_id": lookup_ids["in"], "salary": "3600000"},
        ).json()

        assert Decimal(body["salary"]["amount_usd"]) == Decimal("43200.00")

    def test_email_can_be_changed(self, client, employee_id):
        body = client.patch(f"{URL}/{employee_id}", json={"email": "ada@acme.example"}).json()

        assert body["email"] == "ada@acme.example"

    def test_email_clashing_with_another_employee_returns_409(
        self, client, employee_id, seeded_db
    ):
        taken = seeded_db.scalar(select(Employee.email).where(Employee.id != employee_id))

        assert client.patch(f"{URL}/{employee_id}", json={"email": taken}).status_code == 409

    def test_keeping_your_own_email_is_not_a_conflict(self, client, employee_id):
        current = client.get(f"{URL}/{employee_id}").json()["email"]

        assert client.patch(f"{URL}/{employee_id}", json={"email": current}).status_code == 200

    def test_unknown_employee_returns_404(self, client):
        assert client.patch(f"{URL}/999999", json={"last_name": "X"}).status_code == 404

    def test_unknown_department_returns_422(self, client, employee_id):
        assert (
            client.patch(f"{URL}/{employee_id}", json={"department_id": 9999}).status_code
            == 422
        )

    def test_empty_patch_is_a_no_op(self, client, employee_id):
        before = client.get(f"{URL}/{employee_id}").json()

        assert client.patch(f"{URL}/{employee_id}", json={}).json() == before


class TestDeactivateAndReactivate:
    @pytest.fixture
    def employee_id(self, client, new_employee) -> int:
        return client.post(URL, json=new_employee).json()["id"]

    def test_deactivate_sets_inactive(self, client, employee_id):
        assert client.post(f"{URL}/{employee_id}/deactivate").json()["is_active"] is False

    def test_deactivated_employee_is_still_retrievable(self, client, employee_id):
        client.post(f"{URL}/{employee_id}/deactivate")

        assert client.get(f"{URL}/{employee_id}").status_code == 200

    def test_deactivate_does_not_delete_the_row(self, client, employee_id, seeded_db):
        """Soft delete: salary data is financial history."""
        client.post(f"{URL}/{employee_id}/deactivate")

        assert seeded_db.get(Employee, employee_id) is not None

    def test_deactivated_employee_is_excluded_from_active_listing(self, client, employee_id):
        client.post(f"{URL}/{employee_id}/deactivate")
        body = client.get(URL, params={"is_active": True, "page_size": 100}).json()

        assert employee_id not in [item["id"] for item in body["items"]]

    def test_reactivate_restores(self, client, employee_id):
        client.post(f"{URL}/{employee_id}/deactivate")

        assert client.post(f"{URL}/{employee_id}/reactivate").json()["is_active"] is True

    def test_deactivating_twice_is_idempotent(self, client, employee_id):
        client.post(f"{URL}/{employee_id}/deactivate")

        assert client.post(f"{URL}/{employee_id}/deactivate").json()["is_active"] is False

    def test_unknown_employee_returns_404(self, client):
        assert client.post(f"{URL}/999999/deactivate").status_code == 404
