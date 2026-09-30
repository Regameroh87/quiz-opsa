import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'finished'

export interface Game {
  id: string
  quiz_id: string
  code: string
  host_id: string
  phase: Phase
  current_position: number
  question_started_at: string | null
}

export interface CurrentQuestion {
  id: string
  index: number
  total: number
  text: string
  image_url: string | null
  options: string[]
  time_limit_s: number
  question_started_at: string
  server_now: string
  correct_index: number | null
}

export interface Standing {
  nickname: string
  score: number
  rank: number
  answered: boolean
  last_correct: boolean | null
  last_points: number | null
}

export interface LeaderRow {
  nickname: string
  score: number
  rank: number
}

const ERRORS: Record<string, string> = {
  game_not_found: 'No encontramos ese código.',
  game_finished: 'Este quiz ya terminó.',
  game_full: 'La sala está llena.',
  nickname_taken: 'Ese apodo ya está en uso, elegí otro.',
  invalid_nickname: 'El apodo debe tener entre 1 y 20 caracteres.',
  too_late: 'Se acabó el tiempo.',
  already_answered: 'Ya respondiste esta pregunta.',
  not_accepting_answers: 'La pregunta ya cerró.',
  forbidden: 'No tenés permiso para esto.',
  quiz_empty: 'El quiz no tiene preguntas.',
  invalid_transition: 'Ese paso ya no es válido.',
}

export function errorMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  return ERRORS[msg] ?? 'Algo salió mal. Intentá de nuevo.'
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

/** Fila de la partida en vivo (por id o por código). */
export function useGame(key: { id: string } | { code: string }) {
  const [game, setGame] = useState<Game | null>(null)
  const [error, setError] = useState<string | null>(null)
  const col = 'id' in key ? 'id' : 'code'
  const val = 'id' in key ? key.id : key.code.toUpperCase()

  useEffect(() => {
    let gameId: string | null = null
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase.from('games').select('*').eq(col, val).maybeSingle()
      if (cancelled) return null
      if (error || !data) {
        setError('game_not_found')
        return null
      }
      setGame(data as Game)
      return data as Game
    }
    const channel = supabase.channel(`game-${val}`)
    load().then((g) => {
      if (!g) return
      gameId = g.id
      channel
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
          (p) => setGame(p.new as Game))
        // al reconectar se pueden haber perdido eventos
        .subscribe((status) => status === 'SUBSCRIBED' && load())
    })
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [col, val])

  return { game, error, setGame }
}

/** Pregunta actual; se recarga cuando cambia la fase o la posición. */
export function useQuestion(game: Game | null) {
  const [q, setQ] = useState<{ data: CurrentQuestion; receivedAt: number } | null>(null)
  const phase = game?.phase
  const pos = game?.current_position
  const code = game?.code

  const active = !!code && !!phase && phase !== 'lobby' && phase !== 'finished'

  useEffect(() => {
    if (!active) return
    let cancelled = false
    rpc<CurrentQuestion>('get_current_question', { p_code: code })
      .then((data) => !cancelled && setQ({ data, receivedAt: Date.now() }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [active, code, phase, pos])

  // Hasta que llega la pregunta nueva no se expone la anterior (su tiempo ya venció y dispararía el reveal).
  return active && q && q.data.index === pos ? q : null
}

/** Segundos restantes, corrigiendo el desfase entre el reloj del celular y el del servidor. */
export function useRemaining(q: ReturnType<typeof useQuestion>) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])
  if (!q) return null
  const offset = Date.parse(q.data.server_now) - q.receivedAt
  const elapsed = (now + offset - Date.parse(q.data.question_started_at)) / 1000
  return Math.max(0, q.data.time_limit_s - elapsed)
}

export function useLatest<T>(value: T) {
  const ref = useRef(value)
  // Antes que los efectos normales, para que lean el valor del mismo render.
  useLayoutEffect(() => { ref.current = value })
  return ref
}
