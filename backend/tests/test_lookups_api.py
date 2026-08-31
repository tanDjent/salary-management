from app.seed.data import COUNTRIES, DEPARTMENTS, JOB_LEVELS

URL = "/api/lookups"


class TestLookups:
    def test_returns_every_list_in_one_response(self, client):
        body = client.get(URL).json()

        assert len(body["countries"]) == len(COUNTRIES)
        assert len(body["departments"]) == len(DEPARTMENTS)
        assert len(body["job_levels"]) == len(JOB_LEVELS)

    def test_countries_are_alphabetical(self, client):
        names = [c["name"] for c in client.get(URL).json()["countries"]]

        assert names == sorted(names)

    def test_job_levels_are_ordered_by_seniority(self, client):
        """Rank order, not alphabetical: a level dropdown reading Associate,
        Director, Executive, Lead would be nonsense."""
        levels = client.get(URL).json()["job_levels"]

        assert [level["rank"] for level in levels] == sorted(
            level["rank"] for level in levels
        )

    def test_countries_include_their_currency(self, client):
        """The create form derives currency from country, so it needs to show which
        currency a country implies."""
        country = client.get(URL).json()["countries"][0]

        assert set(country) >= {"id", "name", "iso_code", "default_currency_code"}
