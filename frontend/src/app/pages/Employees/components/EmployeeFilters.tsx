import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import MultiSelect from "../../../../common/MultiSelect";
import Button from "../../../../common/Button";
import { debounce } from "../../../../common/Utility";
import type { Lookups } from "../../../../api/lookups";
import type { StatusFilter } from "../hooks/useEmployeeFilters";

type EmployeeFiltersProps = {
  lookups: Lookups | undefined;
  q: string;
  status: StatusFilter;
  countryIds: number[];
  departmentIds: number[];
  jobLevelIds: number[];
  activeFilterCount: number;
  onChange: (changes: Record<string, string | number | number[] | undefined>) => void;
  onClear: () => void;
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function EmployeeFilters({
  lookups,
  q,
  status,
  countryIds,
  departmentIds,
  jobLevelIds,
  activeFilterCount,
  onChange,
  onClear,
}: EmployeeFiltersProps) {
  const [searchInput, setSearchInput] = useState(q);

  // Keeps the box in step when the URL changes from elsewhere, e.g. Clear all.
  useEffect(() => setSearchInput(q), [q]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Debounced so typing "Anderson" is one request, not eight. The ref keeps the
  // debounced function stable across renders while still calling the latest handler.
  const debouncedSearch = useMemo(
    () => debounce((value: string) => onChangeRef.current({ q: value || undefined }), 400),
    [],
  );

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative w-full lg:w-[280px]">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            debouncedSearch(event.target.value);
          }}
          placeholder="Search name or email"
          aria-label="Search employees"
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-8 text-sm shadow-sm outline-none focus:border-violet-500"
        />
        {searchInput && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setSearchInput("");
              onChange({ q: undefined });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <MultiSelect
        label="Country"
        options={(lookups?.countries ?? []).map((c) => ({ id: c.id, label: c.name }))}
        selected={countryIds}
        onChange={(ids) => onChange({ country_id: ids })}
      />

      <MultiSelect
        label="Department"
        options={(lookups?.departments ?? []).map((d) => ({ id: d.id, label: d.name }))}
        selected={departmentIds}
        onChange={(ids) => onChange({ department_id: ids })}
      />

      <MultiSelect
        label="Level"
        options={(lookups?.job_levels ?? []).map((l) => ({ id: l.id, label: l.title }))}
        selected={jobLevelIds}
        onChange={(ids) => onChange({ job_level_id: ids })}
      />

      <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5 shadow-sm">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              onChange({ status: option.value === "all" ? undefined : option.value })
            }
            className={`rounded px-3 py-1.5 text-sm transition ${
              status === option.value
                ? "bg-violet-600 font-medium text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear all ({activeFilterCount})
        </Button>
      )}
    </div>
  );
}
