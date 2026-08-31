/**
 * Thin fetch wrapper.
 *
 * In dev, Vite proxies /api to the backend, so the browser sees one origin and
 * CORS never applies. In production VITE_API_ROOT points at the deployed API.
 */
const API_ROOT = import.meta.env.VITE_API_ROOT ?? "";

export type QueryValue = string | number | boolean | undefined | null;

export function buildUrl(
  path: string,
  params: Record<string, QueryValue | QueryValue[]> = {},
): string {
  const url = new URL(`${API_ROOT}/api${path}`, window.location.origin);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;

    // Repeated keys, e.g. ?country_id=1&country_id=2, which the API OR-matches.
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") {
          url.searchParams.append(key, String(item));
        }
      });
    } else {
      url.searchParams.append(key, String(value));
    }
  }

  return url.toString();
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

/**
 * Surfaces the API's own message where there is one.
 *
 * The backend returns {detail: string} for domain errors, but FastAPI's own
 * validation failures return {detail: [{loc, msg, ...}]}. Showing "[object
 * Object]" to an HR manager helps nobody.
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) {
      return body.detail.map((item: { msg: string }) => item.msg).join("; ");
    }
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  return `Request failed with status ${response.status}`;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body: unknown) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
};
