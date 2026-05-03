const DEFAULT_PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  queryForRange: (from: number, to: number) => any,
  pageSize = DEFAULT_PAGE_SIZE
) {
  const rows: T[] = []
  let from = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await queryForRange(from, to)
    if (error) throw error

    const page = (data || []) as T[]
    rows.push(...page)

    if (page.length < pageSize) break
    from += pageSize
  }

  return rows
}
