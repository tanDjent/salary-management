import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export type PaginationData = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type PaginationProps = PaginationData & {
  itemLabel?: string;
  onPageChange: (page: number) => void;
  className?: string;
};

type PageItem = number | "ellipsis";

const numberFormatter = new Intl.NumberFormat("en-US");
const fmt = (n: number) => numberFormatter.format(n);

function getPageRange(
  page: number,
  limit: number,
  total: number,
): { start: number; end: number } {
  if (total === 0) return { start: 0, end: 0 };
  return {
    start: (page - 1) * limit + 1,
    end: Math.min(page * limit, total),
  };
}

/**
 * Builds the list of page buttons to render.
 *
 * Strategy:
 *  ≤ 5 pages  → show all
 *  near start → [1, 2, 3, …, last]
 *  near end   → [1, …, last-2, last-1, last]
 *  middle     → [1, …, current, …, last]
 */
function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (page < 3) {
    return [1, 2, 3, "ellipsis", totalPages];
  }
  if (page >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis", page, "ellipsis", totalPages];
}

const PAGE_BTN_BASE =
  "inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-violet-300";

type PageButtonProps = {
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
};

function PageButton({ pageNumber, isActive, onClick }: PageButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Page ${pageNumber}`}
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
      className={`${PAGE_BTN_BASE} ${
        isActive
          ? "bg-violet-600 font-bold text-white"
          : "bg-transparent text-gray-700 hover:bg-gray-100"
      }`}
    >
      {pageNumber}
    </button>
  );
}

function Ellipsis() {
  return (
    <span
      aria-hidden
      className="inline-flex min-h-8 min-w-8 items-center justify-center text-sm text-gray-400"
    >
      …
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Pagination({
  page,
  limit,
  total,
  totalPages,
  itemLabel = "items",
  onPageChange,
  className = "",
}: PaginationProps) {
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const { start, end } = getPageRange(page, limit, total);
  const pageItems = getPageItems(page, totalPages);
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages || totalPages === 0;

  function commitPageInput() {
    if (totalPages === 0) {
      setPageInput("");
      return;
    }

    const parsed = Number(pageInput);
    const isInvalid =
      !pageInput || Number.isNaN(parsed) || parsed < 1 || parsed > totalPages;

    if (isInvalid) {
      setPageInput(String(page));
      return;
    }

    const nextPage = Math.floor(parsed);
    if (nextPage !== page) {
      onPageChange(nextPage);
    } else {
      // Re-sync in case the user typed e.g. "2.9" which floors to the current page.
      setPageInput(String(page));
    }
  }

  function handlePageInputChange(value: string) {
    // Allow only empty string or digit-only strings.
    if (value === "" || /^\d+$/.test(value)) {
      setPageInput(value);
    }
  }

  return (
    <div
      className={`flex flex-col gap-4 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      {/* Item range summary */}
      <p className="text-sm text-gray-600">
        {total === 0 ? (
          <>Showing 0 {itemLabel}</>
        ) : (
          <>
            Showing {fmt(start)} to {fmt(end)} of {fmt(total)} {itemLabel}
          </>
        )}
      </p>

      {/* Page controls — hidden when there is only one page */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={isFirstPage}
              onClick={() => onPageChange(page - 1)}
              className={`${PAGE_BTN_BASE} pr-2 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
            >
              <ChevronLeft size={18} />
            </button>

            {pageItems.map((item, index) =>
              item === "ellipsis" ? (
                // key on index is safe: ellipsis positions are stable within a render.
                <Ellipsis key={`ellipsis-${index}`} />
              ) : (
                <PageButton
                  key={item}
                  pageNumber={item}
                  isActive={item === page}
                  onClick={() => onPageChange(item)}
                />
              ),
            )}

            <button
              type="button"
              aria-label="Next page"
              disabled={isLastPage}
              onClick={() => onPageChange(page + 1)}
              className={`${PAGE_BTN_BASE} pl-2 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="flex items-center">
            <span className="text-sm mr-2 text-gray-600 sm:hidden">Page:</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label={`Go to page (1–${totalPages})`}
              disabled={totalPages === 0}
              value={pageInput}
              onChange={(e) => handlePageInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitPageInput();
                }
              }}
              onBlur={commitPageInput}
              className="sm:ml-1 h-8 w-12 rounded-lg border border-gray-300 bg-white px-1 text-center text-sm text-gray-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>
        </div>
      )}
    </div>
  );
}
