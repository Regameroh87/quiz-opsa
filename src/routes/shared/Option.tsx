export const SHAPES = ['▲', '◆', '●', '■']

export function OptionButton({ index, label, onClick, disabled, dim, correct, count, total }: {
  index: number
  label: string
  onClick?: () => void
  disabled?: boolean
  dim?: boolean
  correct?: boolean
  count?: number
  total?: number
}) {
  const cls = `option opt-${index}${dim ? ' dim' : ''}${correct ? ' correct' : ''}`
  const content = (
    <>
      <span className="shape" aria-hidden>{SHAPES[index]}</span>
      <span>{label}</span>
      {count !== undefined && <span style={{ marginLeft: 'auto' }}>{count}</span>}
      {count !== undefined && total ? <span className="bar" style={{ width: `${(count / total) * 100}%` }} /> : null}
    </>
  )
  return onClick ? (
    <button className={cls} onClick={onClick} disabled={disabled}>{content}</button>
  ) : (
    <div className={cls}>{content}</div>
  )
}
