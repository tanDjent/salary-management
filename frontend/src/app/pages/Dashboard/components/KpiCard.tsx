type KpiCardProps = {
  label: string;
  /** Already formatted; null renders as an em dash. */
  value: string | null;
  hint?: string;
  /** Full-precision figure, shown on hover when the value is abbreviated. */
  title?: string;
  isLoading?: boolean;
};

export default function KpiCard({
  label,
  value,
  hint,
  title,
  isLoading,
}: KpiCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
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
}
