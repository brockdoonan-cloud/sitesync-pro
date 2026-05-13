import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isOperatorUser } from '@/lib/operator'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { cookies } from 'next/headers'

export default async function DashboardPage() {
  const org = await getCurrentOrg()
  if (!org) redirect('/auth/login')

  const cookieStore = await cookies()
  const portalPreference = cookieStore.get('sitesync-portal-mode')?.value
  if (portalPreference === 'customer') redirect('/dashboard/customer')

  if (org?.isSuperAdmin) redirect('/dashboard/admin')
  if (org?.isOperator) redirect('/dashboard/operator')
  if (org?.isClient) redirect('/dashboard/customer')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (isOperatorUser(profile, user.email)) redirect('/dashboard/operator')
  redirect('/dashboard/customer')
}
