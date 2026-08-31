import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

type Option = {
  id: number;
  label: string;
};

type MultiSelectProps = {
  label: string;
  options: Option[];
  selected: number[];
  onChange: (selected: number[]) => void;
  className?: string;
};

/**
 * Checkbox dropdown for the OR-matched filters.
 *
 * Radix's Select is deliberately single-value, so multi-select is built on
 * DropdownMenu.CheckboxItem, which keeps the keyboard and focus behaviour.
 */
export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
  className = "",
}: MultiSelectProps) {
  const toggle = (id: number) => {
    onChange(
      selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
    );
  };

  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((option) => option.id === selected[0])?.label ?? label)
        : `${label} · ${selected.length}`;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={`inline-flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm shadow-sm outline-none hover:bg-gray-50 focus:border-violet-500 lg:w-[170px] ${
          selected.length > 0
            ? "border-violet-300 text-violet-700"
            : "border-gray-300 text-gray-700"
        } ${className}`}
      >
        <span className="truncate">{summary}</span>
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
          {selected.length > 0 && (
            <>
              <DropdownMenu.Item
                onSelect={(event) => {
                  event.preventDefault();
                  onChange([]);
                }}
                className="cursor-pointer rounded px-2 py-1.5 text-sm text-violet-700 outline-none hover:bg-violet-50"
              >
                Clear selection
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />
            </>
          )}

          {options.map((option) => (
            <DropdownMenu.CheckboxItem
              key={option.id}
              checked={selected.includes(option.id)}
              // Prevented so the menu stays open while several are ticked.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => toggle(option.id)}
              className="relative flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 outline-none hover:bg-gray-100"
            >
              <span className="flex size-4 items-center justify-center rounded border border-gray-300 bg-white">
                <DropdownMenu.ItemIndicator>
                  <Check size={12} className="text-violet-600" />
                </DropdownMenu.ItemIndicator>
              </span>
              {option.label}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
