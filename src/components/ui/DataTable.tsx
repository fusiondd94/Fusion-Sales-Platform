import type { ReactNode } from "react";
import { cn } from "./utils";

export type DataTableColumn = {
  header: ReactNode;
  className?: string;
  priority?: "primary" | "secondary" | "optional";
};

export function DataTable({
  columns,
  children,
  empty,
  className,
  "aria-label": ariaLabel
}: {
  columns: DataTableColumn[];
  children: ReactNode;
  empty?: ReactNode;
  className?: string;
  "aria-label": string;
}) {
  return (
    <div className="fusion-data-table-wrap">
      <table className={cn("fusion-data-table", className)} aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th className={column.className} data-priority={column.priority || "secondary"} key={index} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          {empty ? (
            <tr className="fusion-data-table__empty">
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
