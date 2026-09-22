import { useEffect, useRef, useState, type ReactNode } from 'react'
import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef, type ColumnFiltersState, type SortingState } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { SortAsc, SortDesc, X } from 'lucide-react'

type RecordRow = Record<string, unknown>

const CHIP_RENDER_LIMIT = 300

function multiSelectFilter(row: { getValue: (id: string) => unknown }, columnId: string, filterValue: unknown) {
  const selected = filterValue as string[]
  if (!selected?.length) return true
  return selected.includes(String(row.getValue(columnId) ?? ''))
}

export default function DataGrid({ rows, columns, renderValue }: { rows: RecordRow[]; columns?: string[]; renderValue?: (column: string, value: unknown, row: RecordRow) => ReactNode }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [filterColumn, setFilterColumn] = useState<string | null>(null)
  const [valueSearch, setValueSearch] = useState('')

  const keys = columns ?? [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const definitions: ColumnDef<RecordRow>[] = keys.map((key) => ({
    id: key,
    accessorFn: (row) => row[key] ?? '',
    header: key,
    sortingFn: 'alphanumeric',
    filterFn: multiSelectFilter,
    cell: (info) => renderValue ? renderValue(key, info.getValue(), info.row.original) : <span className="font-body text-base tabular-nums">{String(info.getValue() ?? '')}</span>,
  }))

  useEffect(() => {
    setColumnFilters((prev) => {
      const next = prev.filter((f) => keys.includes(f.id))
      return next.length === prev.length ? prev : next
    })
    setFilterColumn((prev) => (prev && keys.includes(prev) ? prev : null))
  })

  const table = useReactTable({
    data: rows, columns: definitions,
    state: { sorting, globalFilter: search, columnFilters },
    onSortingChange: setSorting, onGlobalFilterChange: setSearch, onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _column, value) => Object.values(row.original).some((item) => String(item ?? '').toLowerCase().includes(String(value).toLowerCase())),
  })
  const total = table.getFilteredRowModel().rows.length
  const bodyRows = table.getRowModel().rows

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: bodyRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 61,
    overscan: 15,
  })
  const virtualItems = virtualizer.getVirtualItems()
  const colCount = table.getAllColumns().length
  const padTop = virtualItems.length ? virtualItems[0].start : 0
  const padBottom = virtualItems.length ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0

  const activeChips = columnFilters.flatMap((f) => (f.value as string[]).map((value) => ({ column: f.id, value })))

  const facetValues = (() => {
    if (!filterColumn) return []
    const others = columnFilters.filter((f) => f.id !== filterColumn)
    const query = search.toLowerCase()
    const counts = new Map<string, number>()
    for (const row of rows) {
      if (query && !Object.values(row).some((item) => String(item ?? '').toLowerCase().includes(query))) continue
      let ok = true
      for (const f of others) {
        if ((f.value as string[]).length && !(f.value as string[]).includes(String(row[f.id] ?? ''))) { ok = false; break }
      }
      if (!ok) continue
      const value = String(row[filterColumn] ?? '')
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
  })()

  const valueQuery = valueSearch.toLowerCase()
  const facetList = valueQuery ? facetValues.filter((f) => f.value.toLowerCase().includes(valueQuery)) : facetValues
  const visibleFacets = { list: facetList.slice(0, CHIP_RENDER_LIMIT), hidden: Math.max(0, facetList.length - CHIP_RENDER_LIMIT), total: facetList.length }

  const selectedForColumn = new Set((columnFilters.find((f) => f.id === filterColumn)?.value as string[] | undefined) ?? [])

  function scrollTop() {
    scrollRef.current?.scrollTo({ top: 0 })
  }

  function toggleValue(value: string) {
    if (!filterColumn) return
    const column = table.getColumn(filterColumn)
    if (!column) return
    const current = new Set((column.getFilterValue() as string[] | undefined) ?? [])
    if (current.has(value)) current.delete(value)
    else current.add(value)
    column.setFilterValue(current.size ? [...current] : undefined)
    scrollTop()
  }

  function removeChip(column: string, value: string) {
    const col = table.getColumn(column)
    if (!col) return
    const current = ((col.getFilterValue() as string[] | undefined) ?? []).filter((v) => v !== value)
    col.setFilterValue(current.length ? current : undefined)
    scrollTop()
  }

  function clearAllFilters() {
    table.resetColumnFilters()
    setValueSearch('')
    scrollTop()
  }

  return <div className="space-y-6 min-w-0">
    <div className="flex flex-wrap gap-3 items-center justify-between">
      <Input aria-label="Search table" placeholder="Search all fields…" value={search} onChange={(event) => { setSearch(event.target.value); scrollTop() }} className="border-0 border-b border-rule bg-transparent px-0 font-body text-base placeholder:text-faint focus-visible:border-ink focus-visible:ring-0 sm:max-w-sm" />
      <span className="caption-mono" role="status">{total.toLocaleString()} of {rows.length.toLocaleString()} records</span>
    </div>

    {keys.length > 0 && (
      <div className="border border-line bg-bg p-6 space-y-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="grid gap-2">
            <span className="caption-mono">Filter column</span>
            <Select value={filterColumn} onValueChange={(v) => { setFilterColumn(v); setValueSearch('') }}>
              <SelectTrigger aria-label="Filter column" className="w-52 rounded-none border-0 border-b border-rule bg-transparent px-0 font-mono text-xs tracking-[2px] uppercase">
                <span className={`flex flex-1 items-center gap-1.5 truncate text-left ${filterColumn ? '' : 'text-subtle'}`}>{filterColumn ?? 'Choose a column…'}</span>
              </SelectTrigger>
              <SelectContent className="rounded-none">{keys.map((key) => <SelectItem key={key} value={key} className="font-mono text-xs">{key}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {filterColumn && (
            <div className="grid gap-2">
              <span className="caption-mono">Values</span>
              <Input aria-label="Search values" placeholder={`Search ${filterColumn} values…`} value={valueSearch} onChange={(event) => setValueSearch(event.target.value)} className="border-0 border-b border-rule bg-transparent px-0 font-body text-base placeholder:text-faint focus-visible:border-ink focus-visible:ring-0 w-52" />
            </div>
          )}
          {activeChips.length > 0 && <button className="btn-pill h-9 px-5 text-xs" onClick={clearAllFilters}>Clear all filters ({activeChips.length})</button>}
        </div>

        {filterColumn && (
          visibleFacets.total ? (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-2 max-h-40 overflow-auto" role="group" aria-label={`Filter values for ${filterColumn}`}>
                {visibleFacets.list.map(({ value, count }) => {
                  const selected = selectedForColumn.has(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleValue(value)}
                      title={`${value || '(blank)'} — ${count.toLocaleString()} records`}
                      className={`chip ${selected ? 'chip-on' : ''}`}
                    >
                      {value || '(blank)'} · {count.toLocaleString()}
                    </button>
                  )
                })}
              </div>
              {visibleFacets.hidden > 0 && <p className="font-body text-sm text-subtle">Showing {CHIP_RENDER_LIMIT} of {visibleFacets.total.toLocaleString()} values — search values to narrow the list. All data stays filterable.</p>}
            </>
          ) : <p className="font-body text-sm text-subtle">No values for {filterColumn} under the current search and filters.</p>
        )}

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Active filters">
            <span className="caption-mono">Active:</span>
            {activeChips.map(({ column, value }) => (
              <button
                key={`${column}:${value}`}
                type="button"
                onClick={() => removeChip(column, value)}
                aria-label={`Remove filter ${column}: ${value || '(blank)'}`}
                title={`Remove filter ${column}: ${value || '(blank)'}`}
                className="chip chip-on"
              >
                <X className="size-3.5" aria-hidden="true" />
                {column}: {value || '(blank)'}
              </button>
            ))}
          </div>
        )}
      </div>
    )}

    <div ref={scrollRef} className="-mx-6 max-h-[65vh] overflow-auto border-y border-line" tabIndex={0} aria-label="Scrollable data table">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-panel">
          <TableRow className="border-line hover:bg-transparent">{table.getHeaderGroups()[0]?.headers.map((header) => <TableHead key={header.id} scope="col" className="whitespace-nowrap px-6 py-4" aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none'}><button className="th-sort" onClick={header.column.getToggleSortingHandler()} title="Sort; Shift-click to sort multiple columns">{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === 'asc' ? <SortAsc className="size-3.5" aria-hidden="true" /> : header.column.getIsSorted() === 'desc' ? <SortDesc className="size-3.5" aria-hidden="true" /> : null}</button></TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {padTop > 0 && <TableRow aria-hidden="true" className="border-0 hover:bg-transparent"><TableCell colSpan={colCount} className="p-0" style={{ height: padTop }} /></TableRow>}
          {virtualItems.map((virtualRow) => {
            const row = bodyRows[virtualRow.index]
            return <TableRow key={row.id} className="border-line hover:bg-panel">{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="px-6 py-4 align-top"><div className="min-w-24 max-w-xl whitespace-pre-wrap break-words">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div></TableCell>)}</TableRow>
          })}
          {padBottom > 0 && <TableRow aria-hidden="true" className="border-0 hover:bg-transparent"><TableCell colSpan={colCount} className="p-0" style={{ height: padBottom }} /></TableRow>}
        </TableBody>
      </Table>
      {!total && <p className="p-6 font-body text-base text-subtle">No matching records.</p>}
    </div>
    <p className="caption-mono">Scroll to explore — rows render on demand</p>
  </div>
}
