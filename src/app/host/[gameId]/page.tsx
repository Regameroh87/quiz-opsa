'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useParams, useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { errorMessage, rpc, useGame, useHostLive, useLatest, useQuestion, useRemaining, type Game, type Player } from '@/lib/game'
import { OptionButton, OptionGrid } from '@/components/OptionButton'
import Logo from '@/components/Logo'
import Avatar, { AVATARS } from '@/components/Avatar'

// Pantalla del proyector: todo escala en em a partir del font-size base.
// Mundo calcomanía: campo azul con las piezas pegadas encima como stickers.
const SCREEN = 'field flex flex-col gap-[1.4em] p-[3vw] text-[clamp(16px,1.6vw,28px)]'
const TITLE = 'font-display text-[3.4em] leading-[0.95] text-brand [text-wrap:balance]'
const URGENT_S = 5
// Chip-sticker con troquel blanco para los datos de estado, arriba a la derecha.
const CHIP = 'rounded-full border-[0.15em] border-white bg-navy px-[0.9em] py-[0.35em] font-bold whitespace-nowrap'
// Podio: 2.º, 1.º, 3.º de izquierda a derecha; el primero más alto y en amarillo.
const PODIUM = [
  { height: 'min-h-[13em]', fill: 'bg-brand text-brand-contrast', delay: 700 },
  { height: 'min-h-[9.5em]', fill: 'bg-white text-navy', delay: 400 },
  { height: 'min-h-[7em]', fill: 'bg-white text-navy', delay: 100 },
]

// key: al pasar a la partida siguiente todo arranca de cero (conteos, auto-reveal, ranking).
export default function HostPage() {
  const { gameId } = useParams<{ gameId: string }>()
  return <Host key={gameId} gameId={gameId} />
}

function Host({ gameId }: { gameId: string }) {
  const { game, error, setGame } = useGame({ id: gameId })
  const q = useQuestion(game)
  const remaining = useRemaining(q)
  const { players, answered, stats, board } = useHostLive(game, q?.data.id)
  const autoRevealed = useRef<number | null>(null)

  const phase = game?.phase
  const pos = game?.current_position
  const playerCount = useLatest(players.length)

  // Si desde el control se lanzó otro quiz, este proyector pasa solo a la sala nueva.
  // Navegación del lado del cliente: se mantiene la pantalla completa.
  const router = useRouter()
  const nextGameId = game?.next_game_id
  useEffect(() => {
    if (nextGameId) router.replace(`/host/${nextGameId}`)
  }, [nextGameId, router])

  // Los botones viven en el control del panel; el proyector solo revela solo, al acabarse el tiempo o si respondieron todos.
  // Si el control ya reveló, el servidor responde invalid_transition: no hay nada que mostrarle a la sala.
  const autoReveal = () =>
    rpc<Game>('host_advance', { p_game_id: gameId, p_action: 'reveal' }).then(setGame).catch(() => {})

  // Revela solo al acabarse el tiempo o cuando todos respondieron (una vez por pregunta).
  useEffect(() => {
    if (phase !== 'question' || !q || pos === undefined || autoRevealed.current === pos) return
    const everyone = playerCount.current > 0 && answered >= playerCount.current
    if ((remaining !== null && remaining <= 0) || everyone) {
      autoRevealed.current = pos
      // Llamada al servidor disparada por el temporizador: sincroniza con un sistema externo.
      void autoReveal()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pos, remaining, answered])

  if (error) return <div className={SCREEN}><p className="sticker-note" role="alert">{errorMessage(error)}</p></div>
  if (!game) return <div className={`${SCREEN} items-center justify-center`}><p className="font-display text-[2.4em] text-brand" role="status">Cargando…</p></div>

  const image = q && (q.data.reveal_image_url ?? q.data.image_url)
  const urgent = phase === 'question' && remaining !== null && remaining <= URGENT_S

  return (
    <div className={SCREEN}>
      <FullscreenButton />
      <header className="flex flex-wrap items-center gap-[1em]">
        <Logo height={44} />
        {(phase === 'question' || phase === 'reveal') && q && (
          <div className="ml-auto flex items-center gap-[0.7em]">
            <span className={CHIP}>Pregunta {q.data.index + 1} de {q.data.total}</span>
            {phase === 'question' && (
              <>
                <span className={CHIP}><span className="tabular-nums">{answered} / {players.length}</span> respondieron</span>
                <span role="timer" aria-label={`${Math.ceil(remaining ?? 0)} segundos`}
                  className={`flex size-[3.2em] items-center justify-center rounded-full border-[0.18em] border-white font-display text-[1.6em] tabular-nums shadow-[0_0.2em_0_rgb(0_20_60/0.45)] ${urgent ? 'bg-alert text-white motion-safe:animate-pulse' : 'bg-white text-navy'}`}>
                  {Math.ceil(remaining ?? 0)}
                </span>
              </>
            )}
          </div>
        )}
      </header>

      {phase === 'lobby' && <Lobby code={game.code} players={players} />}

      {(phase === 'question' || phase === 'reveal') && q && (
        <>
          {/* key: cada pregunta nueva se "pega" de nuevo. */}
          <h1 key={q.data.id} className="sticker-panel stick-in px-[1.2em] py-[0.8em] text-[2.4em] leading-[1.15] font-extrabold [text-wrap:balance]"
            style={{ '--tilt': '-0.5deg' } as React.CSSProperties}>
            {q.data.text}
          </h1>
          <div className="flex min-h-0 flex-1 items-center gap-[2vw]">
            {/* Al revelar, la imagen de la respuesta (si hay) reemplaza a la de la pregunta. */}
            {image && (
              // eslint-disable-next-line @next/next/no-img-element -- ya viene optimizada desde R2
              <img src={image} alt="" className="max-h-[38vh] w-auto max-w-[40%] rounded-[1em] border-[0.3em] border-white object-contain shadow-[0_0.35em_0_rgb(0_20_60/0.45)] rotate-[0.8deg]" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-[1.2em]">
              <OptionGrid large>
                {q.data.options.map((o, i) => (
                  <OptionButton key={i} index={i} label={o}
                    dim={phase === 'reveal' && q.data.correct_index !== i}
                    correct={phase === 'reveal' && q.data.correct_index === i}
                    count={phase === 'reveal' ? stats[i] ?? 0 : undefined}
                    total={phase === 'reveal' ? Math.max(1, stats.reduce((a, b) => a + b, 0)) : undefined} large />
                ))}
              </OptionGrid>
              {phase === 'reveal' && q.data.reveal_text && (
                <p className="sticker-panel stick-in px-[1.2em] py-[0.8em] text-[1.4em] font-semibold whitespace-pre-line"
                  style={{ '--tilt': '0.4deg' } as React.CSSProperties}>
                  {q.data.reveal_text}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {phase === 'leaderboard' && (
        <>
          <h1 className={TITLE}>Ranking</h1>
          <ol className="flex flex-col gap-[0.6em] text-[1.6em]">
            {board.map((r, i) => (
              <li key={r.nickname} className="sticker-panel stick-in flex items-center gap-[0.8em] px-[1em] py-[0.5em]"
                style={{ '--tilt': i % 2 ? '0.4deg' : '-0.4deg', '--delay': `${i * 90}ms` } as React.CSSProperties}>
                <span className={`flex size-[1.8em] flex-none items-center justify-center rounded-full font-display ${r.rank === 1 ? 'bg-brand text-brand-contrast' : 'bg-white text-navy'}`}>{r.rank}</span>
                <Avatar id={r.avatar} className="size-[2.2em] border-[0.12em]" />
                <span className="flex-1 truncate font-bold">{r.nickname}</span>
                <span className="font-extrabold tabular-nums">{r.score} <span className="text-[0.7em] font-semibold text-ink-soft">pts</span></span>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* Evento cerrado desde el control: despedida con los cuatro personajes. */}
      {phase === 'finished' && game.closed_at && (
        <div className="flex flex-1 flex-col items-center justify-center gap-[1.5em] text-center">
          <h1 className={`${TITLE} text-[5em]`}>¡Gracias por jugar!</h1>
          <p className="text-[1.6em] font-bold text-ink-soft">¡Nos vemos en el próximo evento!</p>
          <div className="mt-[1em] flex items-end justify-center gap-[2vw]" aria-hidden>
            {AVATARS.map((a, i) => (
              <div key={a.id} className="sticker-tile stick-in relative! w-[11em]" style={{ '--tilt': ['-6deg', '4deg', '-3deg', '6deg'][i], '--delay': `${150 + i * 120}ms` } as React.CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element -- decorativa */}
                <img src={a.src} alt="" draggable={false} />
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'finished' && !game.closed_at && (
        <>
          <h1 className={`${TITLE} text-center`}>¡Podio final!</h1>
          <div className="mt-auto flex items-end justify-center gap-[1.5vw]">
            {[1, 0, 2].map((i) => board[i] && (
              <div key={board[i].nickname}
                className={`stick-in flex w-[14em] flex-col items-center justify-start gap-[0.3em] rounded-t-[1.4em] border-[0.3em] border-b-0 border-white px-[1em] pt-[1em] text-center ${PODIUM[i].height} ${PODIUM[i].fill}`}
                style={{ '--delay': `${PODIUM[i].delay}ms` } as React.CSSProperties}>
                <div className="relative">
                  <Avatar id={board[i].avatar} className={`border-[0.2em] ${i === 0 ? 'size-[6em]' : 'size-[4.5em]'}`} />
                  <span className="absolute -right-[0.3em] -bottom-[0.2em] text-[2em] leading-none" aria-hidden>{['🥇', '🥈', '🥉'][i]}</span>
                </div>
                <span className="sr-only">Puesto {i + 1}:</span>
                <strong className="w-full truncate font-display text-[1.5em] leading-tight">{board[i].nickname}</strong>
                <div className="font-bold tabular-nums">{board[i].score} pts</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Los controles viven en el panel admin: el proyector solo muestra cómo sumarse.
function Lobby({ code, players }: { code: string; players: Player[] }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const url = `${location.origin}/play?code=${code}`

  useEffect(() => {
    if (canvas.current) void QRCode.toCanvas(canvas.current, url, { width: 480, margin: 0 })
  }, [url])

  return (
    <>
      <h1 className={`${TITLE} text-center`}>¡Sumate al quiz!</h1>
      {/* El QR va al centro: es lo que la sala busca con el celular. Se achica con la altura para que todo entre en el proyector. */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-[1em]">
        <canvas ref={canvas} className="stick-in h-[min(19em,40vh)]! w-[min(19em,40vh)]! flex-none rounded-[1.4em] bg-white p-[0.8em] shadow-[0_0.4em_0_rgb(0_20_60/0.45)] rotate-[-1.2deg]"
          aria-label={`Código QR para unirse: ${url}`} />
        <div className="sticker-panel stick-in px-[1.4em] py-[0.7em] text-center" style={{ '--tilt': '0.8deg', '--delay': '120ms' } as React.CSSProperties}>
          <p className="font-semibold text-ink-soft">Escaneá el QR o entrá a <strong className="text-white">{location.host}/play</strong> con el código</p>
          <p className="font-display text-[3.4em] leading-none tracking-[.12em]">{code}</p>
        </div>
        <p className="text-[1.3em] font-bold" aria-live="polite">
          {players.length === 0 ? 'Esperando al primer jugador…' : `${players.length} ${players.length === 1 ? 'jugador' : 'jugadores'} en la sala`}
        </p>
        <ul className="flex min-h-0 max-w-[60em] flex-wrap justify-center gap-[.6em] overflow-hidden">
          {players.map((p, i) => (
            <li key={p.nickname} className="stick-in flex items-center gap-[0.4em] rounded-full border-[0.15em] border-white bg-white py-[0.15em] pr-[0.9em] pl-[0.15em] font-bold text-navy shadow-[0_0.2em_0_rgb(0_20_60/0.4)]"
              style={{ rotate: `${(i % 5) - 2}deg` }}>
              <Avatar id={p.avatar} className="size-[1.9em]" />
              {p.nickname}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

// Pantalla completa: el navegador solo la permite con un clic o una tecla en esta misma pestaña,
// por eso vive acá y no en el control del celular. La tecla F la alterna; Esc sale.
const subscribeFullscreen = (cb: () => void) => {
  document.addEventListener('fullscreenchange', cb)
  return () => document.removeEventListener('fullscreenchange', cb)
}

function FullscreenButton() {
  const isFullscreen = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false)
  const supported = useSyncExternalStore(subscribeFullscreen, () => document.fullscreenEnabled, () => false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'f' || e.metaKey || e.ctrlKey || e.altKey) return
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen().catch(() => {})
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // En pantalla completa desaparece: la sala no tiene que ver controles.
  if (!supported || isFullscreen) return null
  return (
    <button className="sticker-btn-ghost sticker-btn-sm fixed right-4 bottom-4 z-10 gap-2 text-[15px]! opacity-80 hover:opacity-100 focus-visible:opacity-100"
      onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}>
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      </svg>
      Pantalla completa <kbd className="rounded-md bg-navy/10 px-1.5 text-[12px]">F</kbd>
    </button>
  )
}
