import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

type Option<T extends string> = {
  value: T;
  label: string;
};

type SingleSelectProps<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  /** The option treated as "no filter applied", so the trigger stays neutral. */
  defaultValue: T;
  onChange: (value: T) => void;
  className?: string;
};

/**
 * Single-choice sibling of MultiSelect, built on the same primitive so the two
 * triggers are visually identical in a filter row.
 */
export default function SingleSelect<T extends string>({
  label,
  options,
  value,
  defaultValue,
  onChange,
  className = "",
}: SingleSelectProps<T>) {
  const isFiltering = value !== defaultValue;
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={`inline-flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm shadow-sm outline-none hover:bg-gray-50 focus:border-violet-500 lg:w-[170px] ${
          isFiltering
            ? "border-violet-300 text-violet-700"
            : "border-gray-300 text-gray-700"
        } ${className}`}
      >
        <span className="truncate">{isFiltering ? selectedLabel : label}</span>
        <ChevronDown size={16} className="shrink-0 text-gray-400" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          // Matches the trigger width so the menu never appears narrower than the
          // control that opened it, which looks broken on a full-width mobile trigger.
          className="z-50 max-h-72 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-md"
        >
          <DropdownMenu.RadioGroup
            value={value}
            onValueChange={(next) => onChange(next as T)}
          >
            {options.map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 outline-none hover:bg-gray-100"
              >
                <span className="flex size-4 items-center justify-center">
                  <DropdownMenu.ItemIndicator>
                    <Check size={12} className="text-violet-600" />
                  </DropdownMenu.ItemIndicator>
                </span>
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
