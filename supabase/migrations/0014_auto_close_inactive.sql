-- Cierre automático de partidas abandonadas: sin actividad por 2 horas se terminan y se cierran
-- (los celulares que sigan abiertos pasan a /gracias, el proyector muestra el agradecimiento).

alter table games add column updated_at timestamptz not null default now();

create function touch_game() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger games_touch before update on games for each row execute function touch_game();

-- Actividad = último cambio de fase, última persona que se sumó o último voto.
create function close_inactive_games(p_idle interval default interval '2 hours') returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  with stale as (
    select g.id
    from games g
    where g.closed_at is null
      and g.next_game_id is null
      and greatest(
            g.updated_at,
            coalesce((select max(p.created_at) from players p where p.game_id = g.id), g.created_at),
            coalesce((select max(a.answered_at) from answers a where a.game_id = g.id), g.created_at)
          ) < now() - p_idle
  )
  update games set phase = 'finished', closed_at = now()
  where id in (select id from stale);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function close_inactive_games(interval) from public, anon, authenticated;

-- Cada hora (requiere pg_cron: Database → Extensions en Supabase).
create extension if not exists pg_cron;
select cron.schedule('close-inactive-games', '0 * * * *', $$select close_inactive_games()$$);
