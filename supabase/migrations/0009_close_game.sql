-- Cierre del evento: desde el podio, el anfitrión avisa que no sigue otro quiz.
-- Los jugadores pasan a la página de agradecimiento y el proyector la muestra.
alter table games add column closed_at timestamptz;

create function close_game(p_game_id uuid) returns games
language plpgsql security definer set search_path = public as $$
declare
  v_game games;
begin
  select * into v_game from games where id = p_game_id and host_id = auth.uid() for update;
  if not found then raise exception 'forbidden'; end if;
  -- Solo desde el podio y si no se lanzó otro quiz a continuación.
  if v_game.phase <> 'finished' or v_game.next_game_id is not null then raise exception 'invalid_transition'; end if;
  if v_game.closed_at is null then
    update games set closed_at = now() where id = v_game.id returning * into v_game;
  end if;
  return v_game;
end $$;

-- Una partida cerrada ya despidió a los jugadores: no se le encadena otra.
create or replace function create_next_game(p_game_id uuid, p_quiz_id uuid) returns games
language plpgsql security definer set search_path = public as $$
declare
  v_prev games;
  v_game games;
begin
  select * into v_prev from games where id = p_game_id and host_id = auth.uid() for update;
  if not found then raise exception 'forbidden'; end if;
  -- Solo desde el podio: una partida en curso no se reemplaza por debajo.
  if v_prev.phase <> 'finished' or v_prev.closed_at is not null then raise exception 'invalid_transition'; end if;
  -- Ya se lanzó la siguiente (doble toque u otro celular): se devuelve esa en vez de crear otra.
  if v_prev.next_game_id is not null then
    select * into v_game from games where id = v_prev.next_game_id;
    if found then return v_game; end if;
  end if;

  v_game := create_game(p_quiz_id);
  update games set next_game_id = v_game.id where id = v_prev.id;
  return v_game;
end $$;

revoke execute on function close_game(uuid) from public, anon;
grant execute on function close_game(uuid) to authenticated;
