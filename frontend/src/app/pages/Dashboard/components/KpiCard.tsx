import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

type KpiCardProps = {
  label: string;
  /** Already formatted; null renders as an em dash. */
  value: string | null;
  hint?: string;
  /** Full-precision figure, shown on hover when the value is abbreviated. */
  title?: string;
  /** Where the underlying records live. A count with no way to see who it counts
   *  is a dead end, so any card that can be listed links to that list. */
  to?: string;
  isLoading?: boolean;
};

export default function KpiCard({
  label,
  value,
  hint,
  title,
  to,
  isLoading,
}: KpiCardProps) {
  const card = (
    <div
      className={`h-full rounded-lg border border-gray-200 bg-white p-4 ${
        to ? "transition hover:border-violet-300 hover:bg-violet-50/40" : ""
      }`}
    >
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
        {to && <ArrowUpRight size={12} className="text-gray-400" />}
      </p>

      {isLoading ? (
        <div className="mt-2 h-8 w-28 animate-pulse rounded bg-gray-100" />
      ) : (
        <p
          title={title}
          className="mt-1 text-2xl font-semibold tabular-nums text-gray-900"
        >
          {/* Null means the filters matched nobody. An em dash says "no value"
              where a 0 would wrongly claim these people are paid nothing. */}
          {value ?? "—"}
        </p>
      )}

      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );

  if (!to) return card;

  return (
    <Link to={to} className="rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300">
      {card}
    </Link>
  );
}
