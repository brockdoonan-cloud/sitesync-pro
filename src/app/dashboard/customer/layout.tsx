import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { redirect } from 'next/navigation'

export default async function CustomerDashboardLayout({ children }: { children: React.ReactNode }) {
  const org = await getCurrentOrg()
  if (!org) redirect('/auth/login')
  if (org.isOperator && !org.isSuperAdmin) redirect('/dashboard/operator')
  return <>{children}</>
}
