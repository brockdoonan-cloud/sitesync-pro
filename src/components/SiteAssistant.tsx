'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Bot, Send, X } from 'lucide-react'

type Message = {
  role: 'assistant' | 'user'
  text: string
  links?: { label: string; href: string }[]
}

export default function SiteAssistant() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Hi, I can help with quotes, swaps, tracking, billing, onboarding, maps, routes, and customer portal access.',
      links: [
        { label: 'Get a quote', href: '/quotes' },
        { label: 'Sign in', href: '/auth/login' },
      ],
    },
  ])

  const ask = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)
    setMessages(current => [...current, { role: 'user', text }])

    const response = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(false)

    setMessages(current => [
      ...current,
      {
        role: 'assistant',
        text: payload.answer || 'I can help with quotes, swaps, tracking, billing, onboarding, maps, routes, and customer portal access.',
        links: payload.links || [],
      },
    ])
  }

  return (
    <div className="fixed bottom-4 left-4 z-[90]">
      {open && (
        <div className="mb-3 flex h-[520px] w-[min(calc(100vw-2rem),380px)] flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
                <Bot size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">SiteSync Assist</div>
                <div className="text-xs text-slate-500">Fast help for operators and customers</div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white">
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'text-right' : 'text-left'}>
                <div className={`inline-block max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'bg-sky-500 text-white'
                    : 'border border-slate-700/60 bg-slate-900 text-slate-200'
                }`}>
                  {message.text}
                </div>
                {message.links && message.links.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.links.map(link => (
                      <Link key={link.href} href={link.href} className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/20">
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && <div className="text-xs text-slate-500">Thinking...</div>}
          </div>

          <div className="border-t border-slate-800 p-3">
            <div className="flex gap-2">
              <input
                className="input min-w-0 flex-1 text-sm"
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') ask()
                }}
                placeholder="Ask about swaps, leads, billing..."
              />
              <button type="button" onClick={ask} disabled={loading || !input.trim()} className="btn-primary flex h-10 w-10 items-center justify-center disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500 text-white shadow-lg shadow-sky-950/50 transition-transform hover:scale-105"
        aria-label="Open SiteSync Assist"
      >
        <Bot size={22} />
      </button>
    </div>
  )
}
