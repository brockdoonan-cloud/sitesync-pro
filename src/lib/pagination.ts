export type PaginationInput = {
  page?: string | number | null
  pageSize?: string | number | null
  maxPageSize?: number
}

export type Pagination = {
  page: number
  pageSize: number
  from: number
  to: number
  limit: number
}

export function paginate({ page, pageSize, maxPageSize = 100 }: PaginationInput = {}): Pagination {
  const parsedPage = Number(page || 1)
  const parsedPageSize = Number(pageSize || 25)
  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1
  const safePageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0
    ? Math.min(Math.floor(parsedPageSize), maxPageSize)
    : 25
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  return {
    page: safePage,
    pageSize: safePageSize,
    from,
    to,
    limit: safePageSize,
  }
}

export function showingRange(total: number, pagination: Pagination) {
  if (total <= 0) return { start: 0, end: 0 }
  return {
    start: pagination.from + 1,
    end: Math.min(pagination.to + 1, total),
  }
}

export function totalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize))
}
