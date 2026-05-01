'use client'

import { usePathname } from 'next/navigation'
import LanguageToggle from '@/components/LanguageToggle'

export default function GlobalLanguageToggle() {
  const pathname = usePathname()
  const offset = pathname?.startsWith('/dashboard') ? 'bottom-4' : 'bottom-5'

  return (
    <div className={`fixed right-4 ${offset} z-[80]`}>
      <LanguageToggle />
    </div>
  )
}
