import type { User } from '@supabase/supabase-js'

type SupabaseLike = {
  from: (table: string) => any
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || ''
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function relationMissing(error: any) {
  const message = String(error?.message || '')
  return error?.code === '42P01' || /does not exist|schema cache/i.test(message)
}

export async function getCustomerClientIds(supabase: SupabaseLike, user: Pick<User, 'id' | 'email'> | null | undefined) {
  if (!user) return []

  const linkedClientIds: string[] = []
  const linked = await supabase
    .from('customer_accounts')
    .select('client_id,status')
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (!linked.error && linked.data) {
    linkedClientIds.push(...linked.data.map((row: any) => row.client_id).filter(Boolean))
  } else if (linked.error && !relationMissing(linked.error)) {
    throw linked.error
  }

  const userEmail = normalizeEmail(user.email)
  if (!userEmail) return unique(linkedClientIds)

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id,email,billing_email,billing_email_cc')
    .limit(1000)

  if (error) throw error

  const emailMatchedIds = (clients || [])
    .filter((client: any) => {
      const emails = [
        normalizeEmail(client.email),
        normalizeEmail(client.billing_email),
        ...(Array.isArray(client.billing_email_cc) ? client.billing_email_cc.map(normalizeEmail) : []),
      ].filter(Boolean)
      return emails.includes(userEmail)
    })
    .map((client: any) => client.id)

  return unique([...linkedClientIds, ...emailMatchedIds])
}

export function clientIdOrFilter(clientIds: string[]) {
  if (!clientIds.length) return ''
  return `client_id.in.(${clientIds.join(',')}),current_client_id.in.(${clientIds.join(',')})`
}
