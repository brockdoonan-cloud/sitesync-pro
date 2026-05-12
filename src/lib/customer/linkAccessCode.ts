import 'server-only'

type SupabaseLike = {
  from: (table: string) => any
}

export function normalizeAccessCode(value: unknown) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
}

export async function linkCustomerAccessCode(supabase: SupabaseLike, userId: string, rawCode: unknown) {
  const code = normalizeAccessCode(rawCode)
  if (!code) throw new Error('Enter a customer access code.')

  const { data: accessCode, error } = await supabase
    .from('customer_access_codes')
    .select('*')
    .eq('code', code)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw error
  if (!accessCode) throw new Error('That customer access code was not found or is inactive.')
  if (accessCode.expires_at && new Date(accessCode.expires_at).getTime() < Date.now()) {
    throw new Error('That customer access code has expired.')
  }
  if (accessCode.max_uses && Number(accessCode.used_count || 0) >= Number(accessCode.max_uses)) {
    throw new Error('That customer access code has already been used.')
  }

  const { data: account, error: accountError } = await supabase
    .from('customer_accounts')
    .upsert({
      user_id: userId,
      organization_id: accessCode.organization_id,
      client_id: accessCode.client_id,
      access_code_id: accessCode.id,
      role: 'client_admin',
      status: 'active',
    }, { onConflict: 'user_id,client_id' })
    .select('*')
    .single()

  if (accountError) throw accountError

  await supabase
    .from('customer_access_codes')
    .update({ used_count: Number(accessCode.used_count || 0) + 1, last_used_at: new Date().toISOString() })
    .eq('id', accessCode.id)

  return account
}
