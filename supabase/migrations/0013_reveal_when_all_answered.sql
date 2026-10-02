-- "Revelar cuando respondieron todos" lo decidía el proyector contando las respuestas que le llegaban por
-- Realtime. Si se perdía un aviso (reconexión, pestaña dormida, carrera con la recarga del conteo), el
-- conteo quedaba uno abajo y la pregunta no se revelaba: el control seguía esperando hasta que se acabara
-- el tiempo. Ahora lo decide submit_answer: la última respuesta pasa la partida a 'reveal' y el control y
-- el proyector se enteran por el UPDATE de games, como con cualquier otro paso.
create or replace function submit_answer(p_code text, p_choice int) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_game games;
  v_player players;
  v_q questions;
  v_elapsed numeric;
  v_correct boolean;
  v_points int;
begin
  select * into v_game from games where code = upper(btrim(p_code));
  if not found then raise exception 'game_not_found'; end if;
  select * into v_player from players where game_id = v_game.id and user_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
  if v_game.phase <> 'question' then raise exception 'not_accepting_answers'; end if;

  select * into v_q from questions where quiz_id = v_game.quiz_id
    order by position, id offset v_game.current_position limit 1;
  if p_choice < 0 or p_choice >= array_length(v_q.options, 1) then raise exception 'invalid_choice'; end if;

  v_elapsed := extract(epoch from (now() - v_game.question_started_at));
  if v_elapsed > v_q.time_limit_s + 1 then raise exception 'too_late'; end if; -- 1 s de gracia por latencia

  v_correct := p_choice = v_q.correct_index;
  v_points := case when v_correct
    then round(1000 * (1 - 0.5 * least(v_elapsed, v_q.time_limit_s) / v_q.time_limit_s))::int
    else 0 end;

  begin
    insert into answers (player_id, question_id, game_id, choice, is_correct, points)
    values (v_player.id, v_q.id, v_game.id, p_choice, v_correct, v_points);
  exception when unique_violation then
    raise exception 'already_answered';
  end;

  -- El lock va después del insert para no serializar las respuestas enteras. Con el lock tomado, el conteo
  -- ve las respuestas ya confirmadas por las otras transacciones: si las dos últimas llegan juntas, la que
  -- espera el lock cuenta las dos y revela. Se vuelve a leer la partida por si el host avanzó mientras tanto.
  select * into v_game from games where id = v_game.id for update;
  if v_game.phase = 'question'
     and (select count(*) from answers where game_id = v_game.id and question_id = v_q.id)
         >= (select count(*) from players where game_id = v_game.id)
     and v_q.id = (select id from questions where quiz_id = v_game.quiz_id
                   order by position, id offset v_game.current_position limit 1) then
    update games set phase = 'reveal' where id = v_game.id;
  end if;
end $$;
