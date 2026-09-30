'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ensureSession, supabase } from '@/lib/supabase'
import { errorMessage, rpc, useGame, useQuestion, useRemaining, type Standing } from '@/lib/game'
import { OptionButton, OptionGrid } from '@/components/OptionButton'
import Avatar, { AVATARS, type AvatarId } from '@/components/Avatar'
import Logo from '@/components/Logo'

const URGENT_S = 5

/** Estado de espera a pantalla completa, en amarillo sobre el campo. */
function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="field grid place-items-center px-4">
      <p className="font-display text-3xl text-brand" role="status">{children}</p>
    </div>
  )
}

// useSearchParams necesita un límite de Suspense para el prerender.
export default function PlayPage() {
  return <Suspense fallback={<Status>Conectando…</Status>}><Play /></Suspense>
}

function Play() {
  const params = useSearchParams()
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase())
  const fromQr = (params.get('code') ?? '').length === 6
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState<AvatarId | null>(null)
  const [joined, setJoined] = useState<string | null>(null) // código de la partida ya unida
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Sesión anónima + reconexión: si ya éramos jugadores de esta partida, seguimos.
  useEffect(() => {
    ensureSession()
      .then(async () => {
        const c = (params.get('code') ?? '').toUpperCase()
        // El código de la URL puede cambiar sin recargar (pasar al quiz siguiente).
        setCode(c)
        if (c) {
          try {
            await rpc('get_my_standing', { p_code: c })
            setJoined(c)
          } catch {
            setJoined(null) // aún no se unió: formulario de la sala
          }
        }
      })
      .catch(() => setError('No pudimos conectarnos. Revisá tu conexión.'))
      .finally(() => setReady(true))
  }, [params])

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!avatar) return setError('Elegí un personaje.')
    setBusy(true)
    setError('')
    try {
      await rpc('join_game', { p_code: code, p_nickname: nickname, p_avatar: avatar })
      setJoined(code.trim().toUpperCase())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <Status>Conectando…</Status>
  // key: al pasar a otra partida, el juego arranca de cero.
  if (joined) return <PlayGame key={joined} code={joined} />

  return (
    <div className="field grid place-items-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16">
      <form className="sticker-card flex flex-col gap-4 text-left" onSubmit={join}>
        <div className="flex justify-center"><Logo height={34} /></div>
        <h1 className="sticker-title text-center">¡Sumate!</h1>
        {/* Si se llegó por el QR el código ya viene en la URL: no se vuelve a pedir. */}
        {fromQr ? (
          <p className="-mt-2 text-center font-bold text-ink-soft">Partida <span className="tracking-[.12em] text-white">{code}</span></p>
        ) : (
          <label className="sticker-label">
            Código de la partida
            <input className="sticker-input text-center font-bold tracking-[.2em] uppercase" value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6} autoCapitalize="characters" autoComplete="off" inputMode="text" required />
          </label>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="sticker-label mb-2">Elegí tu personaje</legend>
          <div className="grid grid-cols-2 gap-3">
            {AVATARS.map((a, i) => {
              const selected = avatar === a.id
              return (
                <label key={a.id} className="flex cursor-pointer flex-col items-center gap-1.5">
                  <input type="radio" name="avatar" value={a.id} checked={selected} className="peer sr-only"
                    onChange={() => { setAvatar(a.id); setError('') }} />
                  {/* Cada personaje es un sticker: al elegirlo se levanta y lleva su tilde. */}
                  <span className={`relative block w-full overflow-hidden rounded-[20px] border-4 border-white bg-white motion-safe:transition-[translate,opacity,box-shadow] motion-safe:duration-200 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand ${selected ? '-translate-y-1 shadow-[0_6px_0_rgb(0_20_60/0.55)]' : `shadow-[0_3px_0_rgb(0_20_60/0.35)] ${avatar ? 'opacity-55' : ''}`}`}
                    style={{ rotate: `${[-2, 1.5, 1.5, -2][i]}deg` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- ya optimizada */}
                    <img src={a.src} alt="" draggable={false} className="block aspect-[4/3] w-full object-cover" />
                    {selected && (
                      <span aria-hidden className="absolute right-1.5 bottom-1.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-field text-sm font-black text-white">✓</span>
                    )}
                  </span>
                  <span className={`text-sm font-bold ${selected ? 'text-white' : 'text-ink-soft'}`}>{a.name}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <label className="sticker-label">
          Tu nombre
          <input className="sticker-input" value={nickname} onChange={(e) => setNickname(e.target.value)}
            maxLength={20} autoComplete="off" enterKeyHint="go" required />
        </label>
        <button className="sticker-btn mt-1" disabled={busy || code.length < 6 || !nickname.trim()}>
          {busy ? 'Entrando…' : '¡A jugar!'}
        </button>
        {/* El error cuelga del borde de la tarjeta: el formulario no salta cuando aparece. */}
        <div role="alert">{error && <p className="sticker-tag">{error}</p>}</div>
      </form>
    </div>
  )
}

function PlayGame({ code }: { code: string }) {
  const { game, error } = useGame({ code })
  const q = useQuestion(game)
  const remaining = useRemaining(q)
  const [standing, setStanding] = useState<Standing | null>(null)
  // Elección y error por pregunta: al cambiar de posición se descartan solos.
  const [choice, setChoice] = useState<{ pos: number; index: number | null; error: string } | null>(null)

  const phase = game?.phase
  const pos = game?.current_position
  const current = choice && choice.pos === pos ? choice : null
  const chosen = current?.index ?? null
  const submitError = current?.error ?? ''

  const refreshStanding = useCallback(
    () => rpc<Standing>('get_my_standing', { p_code: code }).then(setStanding).catch(() => {}),
    [code],
  )
  useEffect(() => { void refreshStanding() }, [refreshStanding, phase, pos])

  // El anfitrión terminó el evento (no sigue otro quiz): despedida con el personaje del jugador.
  const router = useRouter()
  const closed = !!game?.closed_at
  const myAvatar = standing?.avatar
  useEffect(() => {
    if (closed) router.replace(`/gracias${myAvatar ? `?avatar=${myAvatar}` : ''}`)
  }, [closed, myAvatar, router])

  const answer = async (i: number) => {
    if (pos === undefined) return
    setChoice({ pos, index: i, error: '' })
    try {
      await rpc('submit_answer', { p_code: code, p_choice: i })
    } catch (err) {
      const final = err instanceof Error && ['already_answered', 'too_late', 'not_accepting_answers'].includes(err.message)
      setChoice({ pos, index: final ? i : null, error: errorMessage(err) })
    }
  }

  if (error) return <div className="field grid place-items-center px-4"><p className="sticker-note" role="alert">{errorMessage(error)}</p></div>
  if (!game) return <Status>Cargando…</Status>

  const answered = chosen !== null || standing?.answered
  const seconds = Math.ceil(remaining ?? 0)

  return (
    <div className="field">
      <main className="page gap-5">
        {/* Quién soy y cuánto llevo: siempre a la vista. */}
        <header className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border-[3px] border-white bg-navy py-1 pr-4 pl-1 shadow-[0_4px_0_rgb(0_20_60/0.4)]">
            <Avatar id={standing?.avatar} className="size-9 border-2" />
            <span className="truncate font-bold">{standing?.nickname ?? ''}</span>
          </div>
          <span className="rounded-full border-[3px] border-white bg-white px-4 py-1.5 font-black text-navy tabular-nums shadow-[0_4px_0_#8fa6d8]">
            {standing?.score ?? 0} pts
          </span>
        </header>

        {phase === 'lobby' && (
          <section className="sticker-card stick-in mx-auto mt-16 flex flex-col items-center gap-3" role="status">
            <Avatar id={standing?.avatar} className="-mt-20 size-28 border-[6px] shadow-[0_8px_0_rgb(0_20_60/0.4)]" />
            <h1 className="sticker-title text-[44px]">¡Estás dentro!</h1>
            <p className="font-bold text-ink-soft">Mirá la pantalla: el quiz arranca en un ratito.</p>
          </section>
        )}

        {phase === 'question' && q && (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-ink-soft">Pregunta {q.data.index + 1} de {q.data.total}</p>
              <span aria-live="off"
                className={`flex size-14 flex-none items-center justify-center rounded-full border-4 border-white font-display text-2xl tabular-nums shadow-[0_4px_0_rgb(0_20_60/0.4)] ${remaining !== null && remaining <= URGENT_S ? 'bg-alert text-white' : 'bg-white text-navy'}`}>
                {seconds}
              </span>
            </div>
            <h1 key={q.data.id} className="sticker-panel stick-in px-5 py-4 text-xl leading-snug font-extrabold" style={{ '--tilt': '-0.5deg' } as React.CSSProperties}>
              {q.data.text}
            </h1>
            {q.data.image_url && (
              // eslint-disable-next-line @next/next/no-img-element -- ya viene optimizada desde R2
              <img src={q.data.image_url} alt="" className="mx-auto max-h-[28vh] w-auto rounded-2xl border-4 border-white object-contain" />
            )}
            {answered ? (
              <section className="sticker-card stick-in mx-auto flex flex-col items-center gap-2" role="status">
                <p className="sticker-title text-[40px]">¡Enviada!</p>
                <p className="font-bold text-ink-soft">Esperá el resultado en la pantalla.</p>
              </section>
            ) : (
              <OptionGrid>
                {q.data.options.map((o, i) => (
                  <OptionButton key={i} index={i} label={o} onClick={() => answer(i)} disabled={(remaining ?? 0) <= 0} />
                ))}
              </OptionGrid>
            )}
            {submitError && <p className="sticker-note" role="alert">{submitError}</p>}
          </>
        )}

        {(phase === 'reveal' || phase === 'leaderboard') && standing && (
          <section role="status"
            className={`sticker-card stick-in mx-auto flex flex-col items-center gap-2 ${!standing.answered ? '' : standing.last_correct ? 'bg-opt-3!' : 'bg-alert!'}`}>
            <p className="font-display text-[40px] leading-none text-white">
              {!standing.answered ? 'Sin respuesta' : standing.last_correct ? '¡Correcto!' : 'Incorrecto'}
            </p>
            {standing.answered
              ? <p className="font-display text-6xl leading-none text-white">+{standing.last_points ?? 0}</p>
              : <p className="font-bold text-ink-soft">No respondiste a tiempo.</p>}
            <p className="mt-2 font-bold">Vas en el puesto <span className="font-display text-2xl">#{standing.rank}</span></p>
          </section>
        )}
        {/* Lo mismo que muestra la pantalla al revelar, por si el proyector no se ve bien. */}
        {phase === 'reveal' && q && (q.data.reveal_image_url || q.data.reveal_text) && (
          <section className="sticker-panel flex flex-col gap-3 p-5" style={{ '--tilt': '0.5deg' } as React.CSSProperties}>
            {q.data.reveal_image_url && (
              // eslint-disable-next-line @next/next/no-img-element -- ya viene optimizada desde R2
              <img src={q.data.reveal_image_url} alt="" className="mx-auto max-h-[35vh] w-auto rounded-2xl object-contain" />
            )}
            {q.data.reveal_text && <p className="font-semibold whitespace-pre-line">{q.data.reveal_text}</p>}
          </section>
        )}

        {phase === 'finished' && standing && (
          <section className="sticker-card stick-in mx-auto mt-16 flex flex-col items-center gap-2">
            <Avatar id={standing.avatar} className="-mt-20 size-28 border-[6px] shadow-[0_8px_0_rgb(0_20_60/0.4)]" />
            <h1 className="sticker-title text-[44px]">¡Fin del quiz!</h1>
            <p className="font-bold text-ink-soft">Terminaste en el puesto</p>
            <p className="font-display text-7xl leading-none text-white">#{standing.rank}</p>
            <p className="font-bold">{standing.score} puntos</p>
          </section>
        )}
        {phase === 'finished' && game.next_game_id && standing && <NextGame gameId={game.next_game_id} standing={standing} />}
      </main>
    </div>
  )
}

/**
 * El anfitrión lanzó otro quiz en el mismo proyector: un toque y el jugador entra con el mismo
 * nombre y personaje. Si no se puede (nombre tomado, sala llena), cae en el formulario de la sala nueva.
 */
function NextGame({ gameId, standing }: { gameId: string; standing: Standing }) {
  const router = useRouter()
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void supabase.from('games').select('code').eq('id', gameId).maybeSingle()
      .then(({ data }) => setCode(data?.code ?? null))
  }, [gameId])

  const join = async () => {
    if (!code) return
    setBusy(true)
    await rpc('join_game', { p_code: code, p_nickname: standing.nickname, p_avatar: standing.avatar }).catch(() => {})
    // Si entró, la reconexión lo lleva directo al juego; si no, queda el formulario de la sala nueva.
    router.push(`/play?code=${code}`)
  }

  return (
    <section className="sticker-panel stick-in mx-auto flex w-full flex-col items-center gap-3 p-5 text-center" role="status">
      <p className="font-display text-2xl leading-tight">¡Arranca otro quiz!</p>
      <button className="sticker-btn" disabled={!code || busy} onClick={join}>
        {busy ? 'Entrando…' : 'Jugar el siguiente'}
      </button>
      <p className="text-sm text-ink-soft">Entrás como {standing.nickname}, con tu mismo personaje.</p>
    </section>
  )
}
