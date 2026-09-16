import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import type { MatchMessage } from '../lib/types'

export function Chat({
  matchId,
  messages,
  onMessagesChange,
}: {
  matchId: string
  messages: MatchMessage[]
  onMessagesChange: (updater: (prev: MatchMessage[]) => MatchMessage[]) => void
}) {
  const { profile } = useAuth()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const channel = supabase
      .channel(`match-messages-${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const row = payload.new as MatchMessage
          onMessagesChange((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, onMessagesChange])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    const body = text.trim()
    setText('')
    await supabase.from('match_messages').insert({ match_id: matchId, body })
    setSending(false)
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-emerald-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-amber-100/50">No messages yet.</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
              m.sender_id === profile?.id
                ? 'ml-auto bg-gradient-to-b from-amber-400 to-amber-600 text-emerald-950'
                : 'bg-emerald-900/50 text-amber-50'
            }`}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          className="min-w-0 flex-1 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2 text-sm font-semibold text-emerald-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}
