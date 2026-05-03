export const QUOTE_TOKEN_DAYS = 90

export function quoteTokenExpiresAt(createdAt?: string | null) {
  const created = createdAt ? new Date(createdAt) : new Date()
  created.setDate(created.getDate() + QUOTE_TOKEN_DAYS)
  return created
}

export function isQuoteTokenExpired(createdAt?: string | null) {
  return quoteTokenExpiresAt(createdAt).getTime() < Date.now()
}
