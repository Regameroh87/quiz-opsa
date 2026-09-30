import { adminDb } from '@/lib/admin-api'
import { OPTION_MAX } from '@/components/OptionButton'

// Arma un borrador de quiz con Gemini (capa gratuita de Google AI Studio). La clave vive solo en el servidor.
// No guarda nada: devuelve preguntas que el admin revisa en el editor antes de guardar.

const MAX_GENERATED = 20 // igual que en el editor (quiz/[id]/page.tsx)
// En la capa gratuita los modelos se saturan seguido (503): si uno falla se prueba el siguiente.
// Flash-Lite primero: responde en segundos, mientras que 3.8 Flash suele tardar o rechazar pedidos gratis.
const MODELS = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : ['gemini-3.5-flash-lite', 'gemini-3.8-flash']
const TIMEOUT_MS = 60_000

// Mismos límites que la tabla `questions` y el editor.
const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Nombre corto del quiz, máximo 60 caracteres.' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'La pregunta, máximo 200 caracteres.' },
          options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4, description: 'Exactamente 4 opciones cortas (idealmente menos de 40 caracteres, nunca más de 80), una sola correcta.' },
          correct_index: { type: 'integer', minimum: 0, maximum: 3 },
          reveal_text: { type: 'string', description: 'Explicación breve de por qué es la correcta, máximo 250 caracteres.' },
        },
        required: ['text', 'options', 'correct_index', 'reveal_text'],
      },
    },
  },
  required: ['title', 'questions'],
}

interface Generated { title: string; questions: { text: string; options: string[]; correct_index: number; reveal_text: string }[] }

export async function POST(req: Request) {
  if (!(await adminDb(req))) return new Response('forbidden', { status: 403 })
  const key = process.env.GEMINI_API_KEY
  if (!key) return new Response('ai_not_configured', { status: 500 })

  const body = (await req.json().catch(() => ({}))) as { topic?: unknown; count?: unknown }
  const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
  const count = Number(body.count)
  if (!topic || topic.length > 200 || !Number.isInteger(count) || count < 1 || count > MAX_GENERATED) {
    return new Response('bad_request', { status: 400 })
  }

  const prompt = [
    `Armá un quiz de ${count} preguntas de opción múltiple sobre este tema: "${topic}".`,
    'Escribí en español rioplatense, claro y entretenido, para jugar en vivo en un proyector.',
    'Cada pregunta tiene 4 opciones plausibles y una sola correcta; variá la posición de la correcta.',
    'Usá solo datos que sean ciertos y verificables; si el tema es muy específico, mantenete en lo general.',
  ].join('\n')

  const request = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: SCHEMA },
  })
  let res: Response | null = null
  let busy = false
  for (const model of MODELS) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: request,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => null)
    if (res?.ok) break
    // 429: cuota gratuita agotada; 503 o sin respuesta: modelo saturado.
    busy ||= !res || res.status === 429 || res.status === 503
    console.error('gemini', model, res?.status ?? 'timeout', await res?.text())
    res = null
  }
  if (!res) return busy ? new Response('ai_busy', { status: 429 }) : new Response('ai_failed', { status: 502 })

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  let out: Generated
  try {
    out = JSON.parse(data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '')
  } catch {
    return new Response('ai_failed', { status: 502 })
  }

  // El modelo puede no respetar el esquema al pie de la letra: se descarta lo que la base rechazaría.
  const questions = (Array.isArray(out.questions) ? out.questions : [])
    .map((q) => ({
      text: String(q?.text ?? '').trim().slice(0, 300),
      options: (Array.isArray(q?.options) ? q.options : []).map((o) => String(o).trim().slice(0, OPTION_MAX)).slice(0, 4),
      correct_index: Number(q?.correct_index),
      reveal_text: String(q?.reveal_text ?? '').trim().slice(0, 500) || null,
    }))
    .filter((q) => q.text && q.options.length >= 2 && q.options.every(Boolean)
      && Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length)
    .slice(0, count)
  if (!questions.length) return new Response('ai_failed', { status: 502 })

  return Response.json({ title: String(out.title ?? '').trim().slice(0, 120), questions })
}
