-- Imagen opcional por pregunta (ej.: "¿Quién es este personaje?"). Vive en Cloudflare R2; acá solo la URL pública.
alter table questions add column image_url text check (image_url ~ '^https://' and char_length(image_url) <= 500);

-- Igual que en 0001, sumando image_url.
create or replace function get_current_question(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_game games;
  v_q questions;
  v_total int;
begin
  select * into v_game from games where code = upper(btrim(p_code));
  if not found then raise exception 'game_not_found'; end if;
  if v_game.host_id <> auth.uid()
     and not exists (select 1 from players where game_id = v_game.id and user_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  if v_game.phase in ('lobby', 'finished') then return null; end if;

  select * into v_q from questions where quiz_id = v_game.quiz_id
    order by position, id offset v_game.current_position limit 1;
  select count(*) into v_total from questions where quiz_id = v_game.quiz_id;

  return jsonb_build_object(
    'id', v_q.id,
    'index', v_game.current_position,
    'total', v_total,
    'text', v_q.text,
    'image_url', v_q.image_url,
    'options', to_jsonb(v_q.options),
    'time_limit_s', v_q.time_limit_s,
    'question_started_at', v_game.question_started_at,
    'server_now', now(),
    'correct_index', case when v_game.phase in ('reveal', 'leaderboard') then v_q.correct_index end
  );
end $$;
