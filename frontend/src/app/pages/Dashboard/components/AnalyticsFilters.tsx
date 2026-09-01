import MultiSelect from "../../../../common/MultiSelect";
import Button from "../../../../common/Button";
import type { Lookups } from "../../../../api/lookups";

type AnalyticsFiltersProps = {
  lookups: Lookups | undefined;
  countryIds: number[];
  departmentIds: number[];
  jobLevelIds: number[];
  activeFilterCount: number;
  onChange: (changes: Record<string, number[] | undefined>) => void;
  onClear: () => void;
};

/** Country, department and level only. There is no search box, because a
 *  dashboard answers "how do we pay this group" rather than "find this person",
 *  and no status filter, because the figures are always about people currently
 *  being paid. */
export default function AnalyticsFilters({
  lookups,
  countryIds,
  departmentIds,
  jobLevelIds,
  activeFilterCount,
  onChange,
  onClear,
}: AnalyticsFiltersProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
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

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear all ({activeFilterCount})
        </Button>
      )}
    </div>
  );
}
