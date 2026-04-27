import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Button } from "./components/ui/button";
import type { AnalyticsQueryResponse } from "./types";

interface DataTableProps {
  result: AnalyticsQueryResponse;
  onRowClick?: (row: Record<string, string | number | null>) => void;
}

export function DataTable({ onRowClick, result }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<Record<string, string | number | null>>[]>(
    () =>
      result.columns.map((column) => ({
        accessorKey: column.key,
        header: column.label,
        cell: (info) => formatCellValue(info.getValue()),
      })),
    [result.columns],
  );

  const table = useReactTable({
    data: result.rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  });

  if (result.rows.length === 0) {
    return <div className="empty-state">Нет данных для отображения</div>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full border-collapse bg-white text-sm">
          <thead className="bg-slate-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600"
                    key={header.id}
                  >
                    <button
                      className="inline-flex items-center gap-1 text-left"
                      onClick={header.column.getToggleSortingHandler()}
                      type="button"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getIsSorted() === "asc" && "↑"}
                      {header.column.getIsSorted() === "desc" && "↓"}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                className={
                  onRowClick
                    ? "cursor-pointer hover:bg-blue-50"
                    : "hover:bg-slate-50"
                }
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td className="border-b border-slate-100 px-4 py-3" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          Страница {table.getState().pagination.pageIndex + 1} из{" "}
          {table.getPageCount()}
        </span>
        <div className="flex gap-2">
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            type="button"
            variant="outline"
          >
            Назад
          </Button>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            type="button"
            variant="outline"
          >
            Вперед
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : value.toFixed(2);
  }
  return String(value);
}
