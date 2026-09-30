-- Encadenar partidas en el mismo proyector: al terminar un quiz, el anfitrión lanza otro y la
-- partida terminada apunta a la nueva. El proyector (y los jugadores) escuchan el UPDATE y la siguen.
alter table games add column next_game_id uuid references games on delete set null;

create function create_next_game(p_game_id uuid, p_quiz_id uuid) returns games
language plpgsql security definer set search_path = public as $$
declare
  v_prev games;
  v_game games;
begin
  select * into v_prev from games where id = p_game_id and host_id = auth.uid() for update;
  if not found then raise exception 'forbidden'; end if;
  -- Solo desde el podio: una partida en curso no se reemplaza por debajo.
  if v_prev.phase <> 'finished' then raise exception 'invalid_transition'; end if;
  -- Ya se lanzó la siguiente (doble toque u otro celular): se devuelve esa en vez de crear otra.
  if v_prev.next_game_id is not null then
    select * into v_game from games where id = v_prev.next_game_id;
    if found then return v_game; end if;
  end if;

  v_game := create_game(p_quiz_id);
  update games set next_game_id = v_game.id where id = v_prev.id;
  return v_game;
end $$;

revoke execute on function create_next_game(uuid, uuid) from public, anon;
grant execute on function create_next_game(uuid, uuid) to authenticated;
