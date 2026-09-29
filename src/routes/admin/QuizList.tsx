import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../../lib/supabase'
import { errorMessage, rpc, type Game } from '../../lib/game'

interface Quiz { id: string; title: string; created_at: string }

export default function QuizList() {
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = () =>
    supabase.from('quizzes').select('id, title, created_at').order('created_at', { ascending: false })
      .then(({ data }) => setQuizzes(data ?? []))
  useEffect(() => { void load() }, [])

  const launch = async (quizId: string) => {
    setError('')
    try {
      const game = await rpc<Game>('create_game', { p_quiz_id: quizId })
      navigate(`/host/${game.id}`)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const remove = async (q: Quiz) => {
    if (!confirm(`¿Borrar "${q.title}"? Se pierden también sus preguntas.`)) return
    const { error } = await supabase.from('quizzes').delete().eq('id', q.id)
    // games.quiz_id es on delete restrict: un quiz ya jugado no se puede borrar.
    if (error) setError('No se puede borrar un quiz que ya se usó en una partida.')
    else void load()
  }

  return (
    <main className="page">
      <div className="row">
        <h1 className="grow">Quizzes</h1>
        <Link className="btn" to="quiz/new">Nuevo quiz</Link>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {quizzes?.length === 0 && <p className="muted">Todavía no hay quizzes. Creá el primero.</p>}
      {quizzes?.map((q) => (
        <div key={q.id} className="card">
          <strong>{q.title}</strong>
          <div className="row">
            <button className="btn" onClick={() => launch(q.id)}>Lanzar en vivo</button>
            <Link className="btn secondary" to={`quiz/${q.id}`}>Editar</Link>
            <button className="btn secondary" onClick={() => remove(q)}>Borrar</button>
          </div>
        </div>
      ))}
    </main>
  )
}
