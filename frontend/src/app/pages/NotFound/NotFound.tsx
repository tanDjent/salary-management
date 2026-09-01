import { Link, useLocation } from "react-router-dom";

import PageHeader from "../../../common/PageHeader";

/** Rendered inside the layout rather than as a bare page, so the sidebar stays
 *  put and a mistyped URL is a wrong turn rather than a dead end. */
export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <>
      <PageHeader title="Page not found" subtitle={`Nothing lives at ${pathname}`} />

      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-600">
          The link may be out of date, or the address may have a typo.
        </p>

        <div className="mt-4 flex justify-center gap-3">
          <Link
            to="/"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            Go to dashboard
          </Link>
          <Link
            to="/employees"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
          >
            Browse employees
          </Link>
        </div>
      </div>
    </>
  );
}
