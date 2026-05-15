const FALLBACK_OPERATOR_EMAILS = ['brock.doonan@gmail.com']

export function isOperatorUser(profile?: { role?: string | null } | null, email?: string | null) {
  const role = profile?.role
  if (role === 'operator' || role === 'admin') return true
  return Boolean(email && FALLBACK_OPERATOR_EMAILS.includes(email.toLowerCase()))
}
