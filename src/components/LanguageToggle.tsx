'use client'

import { useLanguage } from '@/lib/i18n'

export default function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="inline-flex rounded-lg border border-slate-700/60 bg-slate-900/80 p-1" aria-label={t('language')}>
      {(['en', 'es'] as const).map(option => (
        <button
          key={option}
          type="button"
          onClick={() => setLanguage(option)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            language === option ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          {option === 'en' ? 'EN' : 'ES'}
        </button>
      ))}
    </div>
  )
}
