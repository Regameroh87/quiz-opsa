import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { supabase } from '../../lib/supabase'

interface Q { id: string; text: string; options: string[]; correct_index: number; time_limit_s: number }

const blank = (): Q => ({ id: crypto.randomUUID(), text: '', options: ['', '', '', ''], correct_index: 0, time_limit_s: 20 })

export default function QuizEditor() {
  const { id = 'new' } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<Q[]>([blank()])
  const [loaded, setLoaded] = useState(id === 'new')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (id === 'new') return
    Promise.all([
      supabase.from('quizzes').select('title').eq('id', id).single(),
      supabase.from('questions').select('id, text, options, correct_index, time_limit_s').eq('quiz_id', id).order('position'),
    ]).then(([quiz, qs]) => {
      if (quiz.data) setTitle(quiz.data.title)
      if (qs.data?.length) setQuestions(qs.data as Q[])
      setLoaded(true)
    })
  }, [id])

  const update = (i: number, patch: Partial<Q>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  const move = (i: number, d: number) =>
    setQuestions((qs) => {
      const j = i + d
      if (j < 0 || j >= qs.length) return qs
      const next = [...qs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // La opción marcada como correcta no puede estar vacía (99 fuerza el error de validación).
    const cleaned = questions.map((q) => {
      const options = q.options.map((o) => o.trim())
      // Al quitar opciones vacías, la correcta se reubica por cuántas opciones llenas la preceden.
      const correct_index = options.slice(0, q.correct_index).filter(Boolean).length
      return { ...q, options: options.filter(Boolean), correct_index: options[q.correct_index] ? correct_index : 99 }
    })
    const bad = cleaned.findIndex((q) => !q.text.trim() || q.options.length < 2 || q.correct_index >= q.options.length)
    if (bad >= 0) return setError(`Revisá la pregunta ${bad + 1}: necesita texto, al menos 2 opciones y una correcta válida.`)

    setSaving(true)
    try {
      const { data: user } = await supabase.auth.getUser()
      const quizId = id === 'new' ? crypto.randomUUID() : id
      const { error: qe } = await supabase.from('quizzes').upsert({ id: quizId, title: title.trim(), created_by: user.user?.id })
      if (qe) throw qe
      // Upsert por id (conserva historial de respuestas de preguntas existentes) y borra solo las quitadas.
      const rows = cleaned.map((q, position) => ({ ...q, text: q.text.trim(), quiz_id: quizId, position }))
      const { error: pe } = await supabase.from('questions').upsert(rows)
      if (pe) throw pe
      const { error: de } = await supabase.from('questions').delete().eq('quiz_id', quizId)
        .not('id', 'in', `(${rows.map((r) => r.id).join(',')})`)
      if (de) throw de
      navigate('/admin')
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
      setSaving(false)
    }
  }

  if (!loaded) return <main className="page center"><p className="muted">Cargando…</p></main>

  return (
    <form className="page" onSubmit={save}>
      <div className="row"><Link to="/admin" className="muted">← Volver</Link></div>
      <input className="input" placeholder="Título del quiz" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />

      {questions.map((q, i) => (
        <fieldset key={q.id} className="card" style={{ border: 0 }}>
          <legend className="badge">Pregunta {i + 1}</legend>
          <input className="input" placeholder="Texto de la pregunta" value={q.text} maxLength={300}
            onChange={(e) => update(i, { text: e.target.value })} />
          {q.options.map((o, k) => (
            <label key={k} className="row">
              <input type="radio" name={`correct-${q.id}`} checked={q.correct_index === k}
                onChange={() => update(i, { correct_index: k })} aria-label={`Opción ${k + 1} es la correcta`} />
              <input className="input grow" placeholder={`Opción ${k + 1}${k < 2 ? '' : ' (opcional)'}`} value={o}
                onChange={(e) => update(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} />
            </label>
          ))}
          <div className="row">
            <label className="grow">Tiempo (s){' '}
              <input className="input" style={{ width: '6em' }} type="number" min={5} max={120} value={q.time_limit_s}
                onChange={(e) => update(i, { time_limit_s: Number(e.target.value) })} />
            </label>
            <button type="button" className="btn secondary" onClick={() => move(i, -1)} aria-label="Subir">↑</button>
            <button type="button" className="btn secondary" onClick={() => move(i, 1)} aria-label="Bajar">↓</button>
            <button type="button" className="btn secondary" disabled={questions.length === 1}
              onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        </fieldset>
      ))}

      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="button" className="btn secondary" onClick={() => setQuestions((qs) => [...qs, blank()])}>+ Pregunta</button>
        <button className="btn" disabled={saving}>Guardar</button>
      </div>
    </form>
  )
}
