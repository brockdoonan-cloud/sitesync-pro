import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return (<div className="min-h-screen flex flex-col"><NavBar user={user} profile={profile} /><main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">{children}</main></div>)
}
