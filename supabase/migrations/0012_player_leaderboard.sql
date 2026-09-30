-- El ranking también se muestra en el celular de cada jugador: además del host,
-- lo pueden leer los jugadores de esa partida (son los mismos nombres que ya ve la sala en el proyector).
create or replace function get_leaderboard(p_game_id uuid, p_limit int default 5)
returns table (nickname text, avatar text, score bigint, rank bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from games where id = p_game_id and host_id = auth.uid())
     and not exists (select 1 from players where game_id = p_game_id and user_id = auth.uid()) then
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
