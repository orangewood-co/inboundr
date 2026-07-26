import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import {
  Download,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ToolbarButton,
  ToolbarLink,
  ViewerSpinner,
  ViewerErrorState,
  downloadFile,
} from "./viewer-toolbar"

interface XlsxViewerProps {
  url: string
  name: string
}

const ROWS_PER_PAGE = 100

export default function XlsxViewer({ url, name }: XlsxViewerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [activeSheet, setActiveSheet] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const [prevUrl, setPrevUrl] = useState(url)
  const [prevReloadKey, setPrevReloadKey] = useState(reloadKey)
  if (url !== prevUrl || reloadKey !== prevReloadKey) {
    setPrevUrl(url)
    setPrevReloadKey(reloadKey)
    setStatus("loading")
    setErrorMessage(null)
    setSearchQuery("")
    setCurrentPage(1)
  }

  const [prevActiveSheet, setPrevActiveSheet] = useState(activeSheet)
  if (activeSheet !== prevActiveSheet) {
    setPrevActiveSheet(activeSheet)
    setCurrentPage(1)
  }

  useEffect(() => {
    let cancelled = false

    fetch(url)
      .then((res) => {
        if (!res.ok)
          throw new Error(`Failed to fetch spreadsheet (${res.status})`)
        return res.arrayBuffer()
      })
      .then((buffer) => {
        if (cancelled) return
        const wb = XLSX.read(buffer, { type: "array", cellDates: true })
        setWorkbook(wb)
        setActiveSheet(0)
        setCurrentPage(1)
        setStatus("ready")
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMessage(err instanceof Error ? err.message : "Unknown error")
        setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [url, reloadKey])

  const allRows = useMemo(() => {
    if (!workbook) return [] as string[][]
    const sheetName = workbook.SheetNames[activeSheet]
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) return [] as string[][]
    return XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    })
  }, [workbook, activeSheet])

  const cleanedRows = useMemo(() => {
    let lastNonEmptyIndex = -1
    for (let i = allRows.length - 1; i >= 0; i--) {
      const row = allRows[i]
      const hasContent =
        row &&
        row.some((cell) => cell !== undefined && String(cell).trim() !== "")
      if (hasContent) {
        lastNonEmptyIndex = i
        break
      }
    }
    return lastNonEmptyIndex === -1
      ? allRows
      : allRows.slice(0, lastNonEmptyIndex + 1)
  }, [allRows])

  const headerRow = useMemo(() => {
    return cleanedRows[0] ?? []
  }, [cleanedRows])

  const dataRows = useMemo(() => {
    return cleanedRows.slice(1)
  }, [cleanedRows])

  const filteredDataRows = useMemo(() => {
    if (!searchQuery.trim()) return dataRows
    const query = searchQuery.toLowerCase()
    return dataRows.filter((row) =>
      row.some(
        (cell) =>
          cell !== undefined && String(cell).toLowerCase().includes(query)
      )
    )
  }, [dataRows, searchQuery])

  const paginatedDataRows = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE
    const endIndex = startIndex + ROWS_PER_PAGE
    return filteredDataRows.slice(startIndex, endIndex)
  }, [filteredDataRows, currentPage])

  const totalPages = Math.ceil(filteredDataRows.length / ROWS_PER_PAGE) || 1

  const columnCount = useMemo(() => {
    let max = headerRow.length
    for (const row of paginatedDataRows) {
      if (row.length > max) max = row.length
    }
    return max
  }, [headerRow, paginatedDataRows])

  return (
    <div className="flex h-[70svh] flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-between gap-2 border-b bg-background px-3 py-1.5">
        <div className="flex flex-1 items-center gap-2">
          {status === "ready" && (
            <div className="relative flex max-w-xs flex-1 items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search cells..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="h-7 w-full rounded-md border bg-background pr-2.5 pl-8 text-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              />
            </div>
          )}

          {status === "ready" && totalPages > 1 && (
            <div className="ml-2 flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-6 w-6 items-center justify-center rounded border bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                title="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-14 text-center text-xs font-medium text-muted-foreground select-none">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="inline-flex h-6 w-6 items-center justify-center rounded border bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                title="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => downloadFile(url, name)}
            label="Download"
          >
            <Download className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarLink href={url} label="Open in new tab">
            <ExternalLink className="h-4 w-4" />
          </ToolbarLink>
        </div>
      </div>

      {/* Spreadsheet Content Area */}
      <div className="relative flex-1 overflow-auto bg-background">
        {status === "loading" && <ViewerSpinner className="bg-muted/40" />}
        {status === "error" && (
          <ViewerErrorState
            message={errorMessage}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        )}
        {status === "ready" && (
          <div className="h-full overflow-auto">
            <div className="min-w-full">
              {cleanedRows.length > 0 ? (
                <table className="table-auto border-collapse divide-y divide-border text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/80 font-semibold text-muted-foreground select-none">
                      <th className="sticky left-0 z-20 w-12 border-r bg-muted px-2.5 py-1.5 text-center text-[10px]">
                        #
                      </th>
                      {Array.from({ length: columnCount }, (_, c) => (
                        <th
                          key={c}
                          style={{ minWidth: 220, width: 220 }}
                          className="sticky top-0 z-10 border-r border-b bg-muted px-3 py-2 text-xs font-semibold whitespace-nowrap"
                        >
                          {String(headerRow[c] ?? XLSX.utils.encode_col(c))}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedDataRows.map((row, r) => {
                      const originalRowNumber =
                        (currentPage - 1) * ROWS_PER_PAGE + r + 2 
                      return (
                        <tr
                          key={r}
                          className="transition-colors hover:bg-muted/20"
                        >
                          <td className="sticky left-0 z-10 border-r bg-muted/40 px-2 py-1 text-center text-[10px] font-medium text-muted-foreground/60 select-none">
                            {originalRowNumber}
                          </td>
                          {Array.from({ length: columnCount }, (_, c) => (
                            <td
                              key={c}
                              style={{ minWidth: 220, width: 220 }}
                              className="border-r px-3 py-2 whitespace-nowrap"
                              title={row[c] ?? ""}
                            >
                              {row[c] ?? ""}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
                  <FileSpreadsheet className="h-8 w-8 text-muted-foreground/40" />
                  <div>
                    <p className="text-sm font-semibold">Empty sheet</p>
                    <p className="text-xs text-muted-foreground/80">
                      There are no rows in this spreadsheet.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sheet Tabs and footer status */}
      {status === "ready" && workbook && (
        <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-1.5 select-none">
          {workbook.SheetNames.length > 1 ? (
            <div className="flex max-w-xl items-center gap-1 overflow-x-auto py-0.5 pr-4">
              {workbook.SheetNames.map((sheetName, i) => (
                <button
                  key={sheetName}
                  type="button"
                  onClick={() => setActiveSheet(i)}
                  className={cn(
                    "shrink-0 rounded-md border border-transparent px-2.5 py-1 text-xs font-semibold shadow-none transition-all",
                    i === activeSheet
                      ? "border-border bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  )}
                >
                  {sheetName}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Sheet:{" "}
              <span className="font-medium text-foreground">
                {workbook.SheetNames[0]}
              </span>
            </div>
          )}

          <div className="shrink-0 text-[11px] font-medium text-muted-foreground">
            {searchQuery ? (
              <span>
                Found{" "}
                <span className="text-foreground">
                  {filteredDataRows.length}
                </span>{" "}
                of <span className="text-foreground">{dataRows.length}</span>{" "}
                rows
              </span>
            ) : (
              <span>
                Total:{" "}
                <span className="text-foreground">{dataRows.length}</span> row
                {dataRows.length !== 1 && "s"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
