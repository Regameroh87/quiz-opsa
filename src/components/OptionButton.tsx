export const SHAPES = ['▲', '◆', '●', '■']
// Largo máximo de una opción (editor e IA): así las cuatro entran en el proyector y en el celular.
export const OPTION_MAX = 80
// A partir de este largo, en el proyector la opción usa letra más chica.
const LONG = 40

// Clases literales para que Tailwind las detecte.
const BG = ['bg-opt-0', 'bg-opt-1', 'bg-opt-2', 'bg-opt-3']

export function OptionButton({ index, label, onClick, disabled, dim, correct, count, total, large }: {
  index: number
  label: string
  onClick?: () => void
  disabled?: boolean
  dim?: boolean
  correct?: boolean
  count?: number
  total?: number
  /** Tamaño de proyector (pantalla del host). */
  large?: boolean
}) {
  const cls = [
    'relative flex items-center gap-3 p-4 text-left font-bold text-white',
    // En el proyector cada opción es un sticker: troquel blanco y canto.
    large
      ? 'min-h-[4.5em] overflow-hidden rounded-[0.8em] border-[0.2em] border-white px-[0.9em] text-[1.5em] shadow-[0_0.3em_0_rgb(0_20_60/0.45)] motion-safe:transition-[opacity,scale] motion-safe:duration-300'
      : 'min-h-[72px] overflow-hidden rounded-[20px] border-4 border-white text-[1.1rem] shadow-[0_6px_0_rgb(0_20_60/0.45)] min-[481px]:min-h-24 enabled:active:translate-y-1 enabled:active:shadow-[0_2px_0_rgb(0_20_60/0.45)] motion-safe:transition-[translate,box-shadow,opacity] motion-safe:duration-100',
    BG[index],
    dim && 'opacity-35',
    correct && (large ? 'scale-[1.03]' : 'outline-4 outline-offset-2 outline-white'),
  ].filter(Boolean).join(' ')
  const content = (
    <>
      <span className={`flex-none ${large ? 'text-[1.1em]' : 'text-[1.6rem]'}`} aria-hidden>{SHAPES[index]}</span>
      {/* overflow-wrap: una palabra muy larga corta en vez de desbordar el botón. */}
      <span className={`min-w-0 leading-tight [overflow-wrap:anywhere] ${large && label.length > LONG ? 'text-[0.8em]' : ''}`}>{label}</span>
      {correct && large && <span className="ml-auto flex size-[1.4em] flex-none items-center justify-center rounded-full bg-white text-navy" aria-label="Correcta">✓</span>}
      {count !== undefined && <span className={`${correct && large ? '' : 'ml-auto'} tabular-nums`}>{count}</span>}
      {count !== undefined && total ? (
        <span className={`absolute bottom-0 left-0 bg-white/70 motion-safe:transition-[width] motion-safe:duration-400 ${large ? 'h-[0.3em]' : 'h-2'}`}
          style={{ width: `${(count / total) * 100}%` }} />
      ) : null}
    </>
  )
  return onClick ? (
    <button className={cls} onClick={onClick} disabled={disabled}>{content}</button>
  ) : (
    <div className={cls}>{content}</div>
  )
}

export function OptionGrid({ children, large }: { children: React.ReactNode; large?: boolean }) {
  return <div className={`grid grid-cols-1 min-[481px]:grid-cols-2 ${large ? 'gap-[1.2vw]' : 'gap-3'}`}>{children}</div>
}
