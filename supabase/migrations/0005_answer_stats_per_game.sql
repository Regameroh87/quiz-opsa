-- get_answer_stats contaba las respuestas de la pregunta en todas las partidas del quiz.
-- Al repetir un quiz, las respuestas viejas hacían creer al proyector que "ya respondieron todos"
-- y revelaba la pregunta apenas empezaba. Ahora cuenta solo las de esta partida.
create or replace function get_answer_stats(p_game_id uuid) returns int[]
language plpgsql stable security definer set search_path = public as $$
declare
  v_game games;
  v_q questions;
  v_counts int[];
begin
  select * into v_game from games where id = p_game_id and host_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
  select * into v_q from questions where quiz_id = v_game.quiz_id
    order by position, id offset v_game.current_position limit 1;
  select array_agg((select count(*) from answers a
      where a.game_id = v_game.id and a.question_id = v_q.id and a.choice = i)::int order by i)
    into v_counts from generate_series(0, array_length(v_q.options, 1) - 1) i;
  return v_counts;
end $$;
