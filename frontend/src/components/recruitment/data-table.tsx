import { useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export function DataTableColumnHeader({
  title,
  sorted,
  onToggle,
}: {
  title: string
  sorted: false | "asc" | "desc"
  onToggle: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2.5 h-8 gap-1.5 px-2.5 data-[sorted=true]:text-foreground"
      data-sorted={Boolean(sorted)}
      onClick={onToggle}
    >
      {title}
      {sorted === "asc" ? <ArrowUpIcon className="size-3.5" /> : sorted === "desc" ? <ArrowDownIcon className="size-3.5" /> : <ChevronsUpDownIcon className="size-3.5 opacity-50" />}
    </Button>
  )
}

export function DataTable<TData>({
  columns,
  data,
  onRowClick,
  rowClassName,
}: {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  onRowClick?: (row: Row<TData>) => void
  rowClassName?: string
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} style={{ width: header.column.columnDef.size ? header.getSize() : undefined }}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            className={cn(onRowClick && "cursor-pointer", rowClassName)}
            onClick={() => onRowClick?.(row)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
