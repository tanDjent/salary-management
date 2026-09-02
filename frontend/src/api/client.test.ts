import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, buildUrl } from "./client";

/** Asserts on the parsed URL rather than the string, so the tests do not depend
 *  on jsdom's origin or on the order the parameters happen to be appended in. */
function parse(url: string) {
  return new URL(url);
}

describe("buildUrl", () => {
  it("prefixes the API path, so callers pass a resource not a route", () => {
    expect(parse(buildUrl("/employees")).pathname).toBe("/api/employees");
  });

  it("repeats a key per value, which is how the API OR-matches a filter", () => {
    const params = parse(buildUrl("/employees", { country_id: [1, 3] })).searchParams;

    expect(params.getAll("country_id")).toEqual(["1", "3"]);
  });

  it("omits filters that are not set, rather than sending empty ones", () => {
    // An empty q= would be a search for the empty string, not the absence of one.
    const params = parse(
      buildUrl("/employees", { q: "", country_id: undefined, sort_by: null }),
    ).searchParams;

    expect([...params.keys()]).toEqual([]);
  });

  it("keeps false, which is a filter and not an absent value", () => {
    // The trap: is_active=false means "show me the departed". Dropping it
    // alongside the empty values would silently widen the query to everyone.
    const params = parse(buildUrl("/employees", { is_active: false })).searchParams;

    expect(params.get("is_active")).toBe("false");
  });

  it("keeps zero for the same reason", () => {
    const params = parse(buildUrl("/employees", { min_salary: 0 })).searchParams;

    expect(params.get("min_salary")).toBe("0");
  });

  it("drops empty entries inside a list without dropping the list", () => {
    const params = parse(
      buildUrl("/employees", { country_id: [1, undefined, 3] }),
    ).searchParams;

    expect(params.getAll("country_id")).toEqual(["1", "3"]);
  });

  it("escapes a search term instead of letting it alter the query", () => {
    const params = parse(buildUrl("/employees", { q: "a&b=c" })).searchParams;

    expect(params.get("q")).toBe("a&b=c");
  });
});

describe("errors carry something a person can act on", () => {
  afterEach(() => vi.unstubAllGlobals());

  function respondWith(body: unknown, status: number, asText = false) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: status < 400,
        status,
        json: async () => {
          if (asText) throw new SyntaxError("not json");
          return body;
        },
      }),
    );
  }

  it("surfaces the API's own message for a domain error", async () => {
    // A duplicate email is shown against the field, so the text has to survive.
    respondWith({ detail: "An employee with this email already exists" }, 409);

    await expect(api.get("/x")).rejects.toThrow(
      "An employee with this email already exists",
    );
  });

  it("carries the status, so the caller can tell a conflict from a crash", async () => {
    respondWith({ detail: "Conflict" }, 409);

    await expect(api.get("/x")).rejects.toMatchObject({
      status: 409,
      name: "ApiError",
    });
  });

  it("flattens FastAPI's validation shape instead of showing [object Object]", async () => {
    // Its own 422s return a list of objects, not a string. Rendering that
    // directly would put "[object Object]" in front of an HR manager.
    respondWith(
      { detail: [{ msg: "Salary must not be negative" }, { msg: "Email is invalid" }] },
      422,
    );

    await expect(api.get("/x")).rejects.toThrow(
      "Salary must not be negative; Email is invalid",
    );
  });

  it("falls back to the status when the body is not JSON at all", async () => {
    // A gateway or proxy failure returns HTML, which is exactly when the app is
    // most likely to be showing an error in the first place.
    respondWith(null, 502, true);

    await expect(api.get("/x")).rejects.toThrow("Request failed with status 502");
  });

  it("throws ApiError rather than a bare Error", async () => {
    respondWith({ detail: "nope" }, 404);

    await expect(api.get("/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("returns the parsed body when the request succeeds", async () => {
    respondWith({ total: 200 }, 200);

    await expect(api.get("/x")).resolves.toEqual({ total: 200 });
  });
});
