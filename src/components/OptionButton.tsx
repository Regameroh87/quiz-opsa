export const SHAPES = ['▲', '◆', '●', '■']

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
    'relative flex items-center gap-3 rounded-card border-0 p-4 text-left font-bold text-white',
    large ? 'min-h-[7em] text-[1.5em]' : 'min-h-[72px] text-[1.1rem] min-[481px]:min-h-24',
    BG[index],
    dim && 'opacity-35',
    correct && 'outline-5 outline-white',
  ].filter(Boolean).join(' ')
  const content = (
    <>
      <span className="flex-none text-[1.6rem]" aria-hidden>{SHAPES[index]}</span>
      <span>{label}</span>
      {count !== undefined && <span className="ml-auto">{count}</span>}
      {count !== undefined && total ? (
        <span className="absolute bottom-0 left-0 h-2 bg-white/70 motion-safe:transition-[width] motion-safe:duration-400"
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
