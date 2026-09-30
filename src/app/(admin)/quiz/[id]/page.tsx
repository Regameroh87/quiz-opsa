'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/Logo'
import { SHAPES } from '@/components/OptionButton'
import { deleteQuestionImages, uploadQuestionImage } from '@/lib/image'

interface Q {
  id: string; text: string; image_url: string | null; options: string[]; correct_index: number; time_limit_s: number
  // Se muestran recién al revelar la respuesta.
  reveal_image_url: string | null; reveal_text: string | null
}
type ImageField = 'image_url' | 'reveal_image_url'
const imageKey = (qid: string, field: ImageField) => `${qid}:${field}`

const blank = (): Q => ({ id: crypto.randomUUID(), text: '', image_url: null, options: ['', '', '', ''], correct_index: 0, time_limit_s: 20, reveal_image_url: null, reveal_text: null })

export default function QuizEditor() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<Q[]>([blank()])
  const [loaded, setLoaded] = useState(id === 'new')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Pregunta recién agregada: recibe el foco para escribir sin buscarla.
  const [addedId, setAddedId] = useState<string | null>(null)
  // Imágenes subiéndose (clave imageKey): mientras haya alguna, no se puede guardar.
  const [uploading, setUploading] = useState<string[]>([])
  // Imágenes del quiz tal como está guardado: las que se quiten se borran del bucket recién al guardar.
  const savedImages = useRef<string[]>([])
  const [imageError, setImageError] = useState<{ key: string; message: string } | null>(null)

  useEffect(() => {
    if (id === 'new') return
    Promise.all([
      supabase.from('quizzes').select('title').eq('id', id).single(),
      supabase.from('questions').select('id, text, image_url, options, correct_index, time_limit_s, reveal_image_url, reveal_text').eq('quiz_id', id).order('position'),
    ]).then(([quiz, qs]) => {
      if (quiz.data) setTitle(quiz.data.title)
      if (qs.data?.length) {
        setQuestions(qs.data as Q[])
        savedImages.current = qs.data.flatMap((q) => [q.image_url, q.reveal_image_url]).filter(Boolean)
      }
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

  // Se identifica por id (no por índice): la pregunta puede moverse mientras sube.
  const attachImage = async (qid: string, field: ImageField, file: File) => {
    const key = imageKey(qid, field)
    setImageError(null)
    setUploading((u) => [...u, key])
    try {
      const url = await uploadQuestionImage(file)
      // "Cambiar": la anterior se borra (el servidor la conserva si el quiz guardado la usa).
      const previous = questions.find((q) => q.id === qid)?.[field] ?? null
      setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, [field]: url } : q)))
      deleteQuestionImages([previous])
    } catch {
      setImageError({ key, message: 'No se pudo subir la imagen. Probá con otra o intentá de nuevo.' })
    } finally {
      setUploading((u) => u.filter((x) => x !== key))
    }
  }
  const imageProps = (q: Q, i: number, field: ImageField) => {
    const key = imageKey(q.id, field)
    return {
      url: q[field],
      busy: uploading.includes(key),
      error: imageError?.key === key ? imageError.message : '',
      onPick: (file: File) => void attachImage(q.id, field, file),
      onRemove: () => { deleteQuestionImages([q[field]]); update(i, { [field]: null }) },
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // La opción marcada como correcta no puede estar vacía (99 fuerza el error de validación).
    const cleaned = questions.map((q) => {
      const options = q.options.map((o) => o.trim())
      // Al quitar opciones vacías, la correcta se reubica por cuántas opciones llenas la preceden.
      const correct_index = options.slice(0, q.correct_index).filter(Boolean).length
      return { ...q, reveal_text: q.reveal_text?.trim() || null, options: options.filter(Boolean), correct_index: options[q.correct_index] ? correct_index : 99 }
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
      // Ya guardado: se borran las imágenes que el quiz dejó de usar.
      const kept = new Set(rows.flatMap((r) => [r.image_url, r.reveal_image_url]))
      deleteQuestionImages(savedImages.current.filter((u) => !kept.has(u)))
      router.push('/')
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
      setSaving(false)
    }
  }

  if (!loaded) {
    return (
      <div className="field grid place-items-center">
        <p className="font-display text-4xl text-brand" role="status">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="field">
      <form className="page max-w-3xl gap-8 pb-10" onSubmit={save}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="quiet-link">← Volver a tus quizzes</Link>
          <Logo height={32} />
        </header>

        <section className="sticker-panel flex flex-col gap-4 p-6" style={{ '--tilt': '-0.6deg' } as React.CSSProperties}>
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.2rem)] leading-none text-brand">{id === 'new' ? 'Nuevo quiz' : 'Editar quiz'}</h1>
          <label className="sticker-label">
            Nombre del quiz
            <input className="sticker-input font-display text-2xl" placeholder="Ej.: Conocé la línea T7" value={title}
              onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          </label>
        </section>

        <ol className="flex flex-col gap-10">
          {questions.map((q, i) => (
            <li key={q.id}>
              <fieldset className="sticker-panel relative flex min-w-0 flex-col gap-4 p-6 pt-9" style={{ '--tilt': TILTS[i % TILTS.length] } as React.CSSProperties}>
                {/* Número de pregunta: etiqueta amarilla pegada sobre el borde superior. */}
                <legend className="absolute -top-5 left-5 rotate-[-3deg] rounded-xl border-[3px] border-white bg-brand px-3 py-1 font-display text-lg text-brand-contrast">
                  Pregunta {i + 1}
                </legend>
                <label className="sticker-label">
                  Pregunta
                  <textarea className="sticker-input resize-none" rows={2} placeholder="¿Qué querés preguntar?" value={q.text} maxLength={300}
                    autoFocus={q.id === addedId} onChange={(e) => update(i, { text: e.target.value })} />
                </label>

                <QuestionImage label="Imagen (opcional)" {...imageProps(q, i, 'image_url')} />

                <div className="flex flex-col gap-2">
                  <p className="sticker-label">Opciones · marcá la correcta</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {q.options.map((o, k) => {
                      const correct = q.correct_index === k
                      return (
                        <div key={k} className={`flex items-center gap-2 rounded-2xl p-2 ${OPT_BG[k]} ${correct ? 'outline-4 outline-offset-2 outline-brand' : ''}`}>
                          <span className="w-6 flex-none text-center text-xl text-white" aria-hidden>{SHAPES[k]}</span>
                          <input className="sticker-input min-w-0 flex-1 p-2" placeholder={`Opción ${k + 1}${k < 2 ? '' : ' (opcional)'}`} value={o}
                            aria-label={`Opción ${k + 1}`}
                            onChange={(e) => update(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} />
                          {/* Radio nativo invisible sobre un círculo: se marca la correcta con un toque. */}
                          <label className="relative grid size-11 flex-none place-items-center">
                            <input type="radio" name={`correct-${q.id}`} checked={correct} onChange={() => update(i, { correct_index: k })}
                              aria-label={`Opción ${k + 1} es la correcta`}
                              className="peer absolute inset-0 cursor-pointer appearance-none rounded-full border-[3px] border-white bg-white/15 checked:bg-white" />
                            <span className={`pointer-events-none text-xl font-black opacity-0 peer-checked:opacity-100 ${OPT_TEXT[k]}`} aria-hidden>✓</span>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Lo que aparece recién al revelar: la foto del personaje, un dato, por qué es la correcta. */}
                <div className="flex flex-col gap-3 rounded-2xl border-[3px] border-dashed border-ink-soft/40 p-4">
                  <p className="font-display text-lg text-brand">Al revelar la respuesta</p>
                  <label className="sticker-label">
                    Explicación (opcional)
                    <textarea className="sticker-input resize-none" rows={2} maxLength={500} placeholder="Ej.: Es el T7 porque…"
                      value={q.reveal_text ?? ''} onChange={(e) => update(i, { reveal_text: e.target.value })} />
                  </label>
                  <QuestionImage label="Imagen de la respuesta (opcional)" {...imageProps(q, i, 'reveal_image_url')} />
                </div>

                <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                  <label className="sticker-label">
                    Tiempo
                    <span className="flex items-center gap-2">
                      <input className="sticker-input w-24 p-2 text-center" type="number" min={5} max={120} value={q.time_limit_s}
                        onChange={(e) => update(i, { time_limit_s: Number(e.target.value) })} />
                      <span className="normal-case tracking-normal">seg</span>
                    </span>
                  </label>
                  <div className="ml-auto flex items-center gap-2">
                    <button type="button" className={ICON_BTN} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir pregunta ${i + 1}`}>↑</button>
                    <button type="button" className={ICON_BTN} onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label={`Bajar pregunta ${i + 1}`}>↓</button>
                    <button type="button" className="quiet-link" disabled={questions.length === 1}
                      onClick={() => { deleteQuestionImages([q.image_url, q.reveal_image_url]); setQuestions((qs) => qs.filter((_, j) => j !== i)) }}>Quitar</button>
                  </div>
                </div>
              </fieldset>
            </li>
          ))}
        </ol>

        <button type="button" className="sticker-btn-ghost sticker-btn-sm self-center"
          onClick={() => { const q = blank(); setAddedId(q.id); setQuestions((qs) => [...qs, q]) }}>
          + Agregar pregunta
        </button>

        {/* Barra fija abajo: "Guardar" siempre a mano aunque el quiz sea largo. */}
        <div className="sticker-panel sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-3 p-3 pl-5">
          <div className="min-w-0 flex-1 font-semibold text-ink-soft" role="alert">
            {error
              ? <p className="sticker-note">{error}</p>
              : `${questions.length} ${questions.length === 1 ? 'pregunta' : 'preguntas'}`}
          </div>
          <button className="sticker-btn sticker-btn-sm" disabled={saving || uploading.length > 0}>
            {saving ? 'Guardando…' : uploading.length ? 'Subiendo imagen…' : 'Guardar quiz'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Colores y formas de las opciones: los mismos que ven los jugadores.
const OPT_BG = ['bg-opt-0', 'bg-opt-1', 'bg-opt-2', 'bg-opt-3']
const OPT_TEXT = ['text-opt-0', 'text-opt-1', 'text-opt-2', 'text-opt-3']
const TILTS = ['0.5deg', '-0.5deg', '0.3deg', '-0.7deg']
const ICON_BTN = 'sticker-btn-ghost sticker-btn-sm size-11 p-0'

// Imagen opcional de la pregunta: se elige, se optimiza y se sube al momento.
function QuestionImage({ label, url, busy, error, onPick, onRemove }: {
  label: string; url: string | null; busy: boolean; error: string; onPick: (file: File) => void; onRemove: () => void
}) {
  const input = (
    <input type="file" accept="image/*" className="sr-only"
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPick(f) }} />
  )
  return (
    <div className="flex flex-col gap-2">
      <p className="sticker-label">{label}</p>
      {url ? (
        <div className="flex flex-wrap items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- ya viene optimizada desde R2 */}
          <img src={url} alt="" className="max-h-48 rounded-2xl border-4 border-white object-contain" />
          <div className="flex items-center gap-3">
            <label className="quiet-link cursor-pointer">{busy ? 'Subiendo…' : 'Cambiar'}{!busy && input}</label>
            <button type="button" className="quiet-link" onClick={onRemove} disabled={busy}>Quitar imagen</button>
          </div>
        </div>
      ) : (
        <label className={`flex min-h-24 cursor-pointer items-center justify-center rounded-2xl border-[3px] border-dashed border-ink-soft/60 p-4 text-center font-semibold text-ink-soft hover:border-white hover:text-white ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {busy ? 'Optimizando y subiendo…' : '+ Agregar imagen'}
          {!busy && input}
        </label>
      )}
      {error && <p className="sticker-note" role="alert">{error}</p>}
    </div>
  )
}
