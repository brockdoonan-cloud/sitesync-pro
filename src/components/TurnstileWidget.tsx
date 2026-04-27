'use client'
import { useEffect, useRef } from 'react'
declare global { interface Window { turnstile: { render: (el: HTMLElement, opts: object) => string; remove: (id: string) => void; reset: (id: string) => void } } }
interface Props { onVerify: (token: string) => void; onExpire?: () => void }
export default function TurnstileWidget({ onVerify, onExpire }: Props) {
  const ref = useRef<HTMLButtonElement>(null); const widgetId = useRef<string>('')
  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'
    const render = () => { if (ref.current && window.turnstile) { widgetId.current = window.turnstile.render(ref.current as any, { sitekey: siteKey, theme: 'dark', callback: onVerify, 'expired-callback': () => { onExpire?.(); onVerify('') }, 'error-callback': () => onVerify('') }) } }
    if (window.turnstile) { render() } else { if (!document.getElementById('cf-turnstile-script')) { const s = document.createElement('script'); s.id = 'cf-turnstile-script'; s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'; s.async = true; s.defer = true; s.onload = render; document.head.appendChild(s) } else { const c = setInterval(() => { if (window.turnstile) { clearInterval(c); render() } }, 100) } }
    return () => { if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current) }
  }, [onVerify, onExpire])
  return (<div><div ref={ref as any} /><p className="text-xs text-slate-500 mt-1">Protected by Cloudflare Turnstile</p></div>)
}
