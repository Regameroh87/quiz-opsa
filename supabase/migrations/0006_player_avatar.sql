-- Avatar del jugador: uno de los personajes New Holland de public/mascotas.
-- La lista válida vive acá y en src/components/Avatar.tsx: si se agrega un personaje, van los dos.
alter table players add column avatar text not null default 'tractor'
  check (avatar in ('tractor', 'cosechadora', 'pulverizadora', 'tt4'));

-- p_avatar tiene default para que un cliente viejo (sin avatar) pueda seguir uniéndose durante el deploy.
drop function join_game(text, text);
create function join_game(p_code text, p_nickname text, p_avatar text default 'tractor') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_game games;
  v_nick text := btrim(p_nickname);
  v_id uuid;
begin
  if char_length(v_nick) not between 1 and 20 then raise exception 'invalid_nickname'; end if;
  if p_avatar is null or p_avatar not in ('tractor', 'cosechadora', 'pulverizadora', 'tt4') then
    raise exception 'invalid_avatar';
  end if;
  select * into v_game from games where code = upper(btrim(p_code));
  if not found then raise exception 'game_not_found'; end if;
  if v_game.phase = 'finished' then raise exception 'game_finished'; end if;

  select id into v_id from players where game_id = v_game.id and user_id = auth.uid();
  if found then return v_id; end if; -- reconexión: conserva puntaje

  -- Tope de jugadores por partida (límite de conexiones Realtime del plan de Supabase).
  if (select count(*) from players where game_id = v_game.id) >= 190 then raise exception 'game_full'; end if;

  begin
    insert into players (game_id, user_id, nickname, avatar) values (v_game.id, auth.uid(), v_nick, p_avatar) returning id into v_id;
  exception when unique_violation then
    raise exception 'nickname_taken';
  end;
  return v_id;
end $$;

-- Puntaje, posición y resultado de la última pregunta (este último solo desde el reveal).
create or replace function get_my_standing(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_game games;
  v_player players;
  v_score bigint;
  v_rank int;
  v_q_id uuid;
  v_ans answers;
begin
  select * into v_game from games where code = upper(btrim(p_code));
  if not found then raise exception 'game_not_found'; end if;
  select * into v_player from players where game_id = v_game.id and user_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;

  select coalesce(sum(points), 0) into v_score from answers where player_id = v_player.id;
  select 1 + count(*) into v_rank from (
    select p.id from players p left join answers a on a.player_id = p.id
    where p.game_id = v_game.id group by p.id having coalesce(sum(a.points), 0) > v_score
  ) t;

  select id into v_q_id from questions where quiz_id = v_game.quiz_id
    order by position, id offset v_game.current_position limit 1;
  select * into v_ans from answers where player_id = v_player.id and question_id = v_q_id;

  return jsonb_build_object(
    'nickname', v_player.nickname,
    'avatar', v_player.avatar,
    'score', v_score,
    'rank', v_rank,
    'answered', found,
    'last_correct', case when v_game.phase <> 'question' then v_ans.is_correct end,
    'last_points', case when v_game.phase <> 'question' then v_ans.points end
  );
end $$;

-- Cambia el tipo de retorno: hay que recrearla.
drop function get_leaderboard(uuid, int);
create function get_leaderboard(p_game_id uuid, p_limit int default 5)
returns table (nickname text, avatar text, score bigint, rank bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from games where id = p_game_id and host_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  return query
    select p.nickname, p.avatar, coalesce(sum(a.points), 0)::bigint as score,
           rank() over (order by coalesce(sum(a.points), 0) desc) as rank
    from players p left join answers a on a.player_id = p.id
    where p.game_id = p_game_id
    group by p.id, p.nickname, p.avatar
    order by score desc, p.nickname
    limit greatest(p_limit, 1);
end $$;

revoke execute on function join_game(text, text, text), get_leaderboard(uuid, int) from public, anon;
grant execute on function join_game(text, text, text), get_leaderboard(uuid, int) to authenticated;
