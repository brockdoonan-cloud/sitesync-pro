import { getCurrentOrg } from '@/lib/auth/getCurrentOrg'
import { redirect } from 'next/navigation'

export default async function OperatorDashboardLayout({ children }: { children: React.ReactNode }) {
  const org = await getCurrentOrg()
  if (!org) redirect('/auth/login')
  if (!org.isOperator) redirect('/dashboard/customer')
  return <>{children}</>
}
