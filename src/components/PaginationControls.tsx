import Link from 'next/link'
import { showingRange, totalPages, type Pagination } from '@/lib/pagination'

export default function PaginationControls({
  basePath,
  pagination,
  total,
  query = {},
}: {
  basePath: string
  pagination: Pagination
  total: number
  query?: Record<string, string | number | undefined | null>
}) {
  const range = showingRange(total, pagination)
  const pages = totalPages(total, pagination.pageSize)
  const queryString = (page: number) => {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
    })
    params.set('page', String(page))
    return `${basePath}?${params.toString()}`
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-700/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-slate-500">
        Showing {range.start}-{range.end} of {total}
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={queryString(Math.max(1, pagination.page - 1))}
          aria-disabled={pagination.page <= 1}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${pagination.page <= 1 ? 'pointer-events-none border-slate-700/40 text-slate-600' : 'border-slate-700/60 text-slate-300 hover:border-slate-500 hover:text-white'}`}
        >
          Previous
        </Link>
        <span className="text-xs text-slate-500">Page {pagination.page} of {pages}</span>
        <Link
          href={queryString(Math.min(pages, pagination.page + 1))}
          aria-disabled={pagination.page >= pages}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${pagination.page >= pages ? 'pointer-events-none border-slate-700/40 text-slate-600' : 'border-slate-700/60 text-slate-300 hover:border-slate-500 hover:text-white'}`}
        >
          Next
        </Link>
      </div>
    </div>
  )
}
