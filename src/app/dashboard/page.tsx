import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isOperatorUser } from '@/lib/operator'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'

export default async function DashboardPage() {
  const org = await getCurrentOrg()
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
