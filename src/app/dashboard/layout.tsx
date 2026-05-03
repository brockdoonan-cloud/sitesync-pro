import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const org = await getCurrentOrg()
  const navProfile = {
    ...(profile || {}),
    role: org?.isOperator ? 'operator' : profile?.role,
    company_name: org?.organizationName || profile?.company_name,
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar user={user} profile={navProfile} />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {children}
      </main>
    </div>
  )
}
