import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Employee } from "../../../../api/employees";
import StatusBadge from "./StatusBadge";

/** Only the three fields the badge reads. The server derives is_active and
 *  is_leaving from exit_date, so these arrive already decided and the badge must
 *  not second-guess them — that is precisely how the two would drift apart. */
function employee(fields: Partial<Employee>): Employee {
  return {
    is_active: true,
    is_leaving: false,
    exit_date: null,
    ...fields,
  } as Employee;
}

describe("StatusBadge", () => {
  it("shows Active for someone with no departure on record", () => {
    render(<StatusBadge employee={employee({})} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Inactive once the exit date has passed", () => {
    render(
      <StatusBadge
        employee={employee({ is_active: false, is_leaving: false, exit_date: "2024-03-01" })}
      />,
    );

    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("names the leaving date rather than just flagging it", () => {
    // HR is planning around the date, so the badge carries it: "Leaving" alone
    // would send them into the detail panel to find out when.
    render(
      <StatusBadge
        employee={employee({ is_active: true, is_leaving: true, exit_date: "2026-11-30" })}
      />,
    );

    expect(screen.getByText("Leaving 30 Nov 2026")).toBeInTheDocument();
  });

  it("does not label someone serving notice as merely Active", () => {
    // They are still active and still paid, but a badge saying only "Active"
    // would hide a departure the manager needs to see coming.
    render(
      <StatusBadge
        employee={employee({ is_active: true, is_leaving: true, exit_date: "2026-11-30" })}
      />,
    );

    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("explains a past departure on hover", () => {
    render(
      <StatusBadge
        employee={employee({ is_active: false, is_leaving: false, exit_date: "2024-03-01" })}
      />,
    );

    expect(screen.getByText("Inactive")).toHaveAttribute("title", "Left on 01 Mar 2024");
  });

  it("survives an inactive record with no exit date instead of crashing", () => {
    // Should not occur, since status is derived from the date. But a badge is
    // not the place to discover that, and formatDate(null) would throw.
    render(<StatusBadge employee={employee({ is_active: false, exit_date: null })} />);

    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).not.toHaveAttribute("title");
  });
});
