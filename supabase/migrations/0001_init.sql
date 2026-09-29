-- Quiz OPSA: esquema, RLS y funciones de juego.
-- Los jugadores usan anonymous sign-in; nunca leen `questions` directo ni escriben puntajes.

create type game_phase as enum ('lobby', 'question', 'reveal', 'leaderboard', 'finished');

create table admins (
  user_id uuid primary key references auth.users on delete cascade
);

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes on delete cascade,
  position int not null default 0,
  text text not null check (char_length(text) between 1 and 300),
  options text[] not null check (array_length(options, 1) between 2 and 4),
  correct_index int not null,
  time_limit_s int not null default 20 check (time_limit_s between 5 and 120),
  check (correct_index >= 0 and correct_index < array_length(options, 1))
);
create index on questions (quiz_id, position);

create table games (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes on delete restrict,
  code text not null unique,
  host_id uuid not null references auth.users on delete cascade,
  phase game_phase not null default 'lobby',
  current_position int not null default 0,
  question_started_at timestamptz,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);
create unique index players_nickname_unique on players (game_id, lower(nickname));

create table answers (
  player_id uuid not null references players on delete cascade,
  question_id uuid not null references questions on delete cascade,
  game_id uuid not null references games on delete cascade,
  choice int not null,
  is_correct boolean not null,
  points int not null,
  answered_at timestamptz not null default now(),
  primary key (player_id, question_id)
);
create index on answers (game_id, question_id);

-- ---------- RLS ----------
alter table admins enable row level security;
alter table quizzes enable row level security;
alter table questions enable row level security;
alter table games enable row level security;
alter table players enable row level security;
alter table answers enable row level security;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create policy admins_self on admins for select to authenticated using (user_id = auth.uid());
create policy quizzes_admin on quizzes for all to authenticated using (is_admin()) with check (is_admin());
create policy questions_admin on questions for all to authenticated using (is_admin()) with check (is_admin());

-- games: legible por cualquier autenticado (no contiene respuestas); solo el host la modifica (vía RPC).
create policy games_read on games for select to authenticated using (true);
create policy players_read on players for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from games g where g.id = game_id and g.host_id = auth.uid()));
create policy answers_read on answers for select to authenticated
  using (exists (select 1 from players p where p.id = player_id and p.user_id = auth.uid())
      or exists (select 1 from games g where g.id = game_id and g.host_id = auth.uid()));
-- Sin políticas de insert/update/delete en games, players y answers: todo pasa por funciones security definer.

-- ---------- Funciones ----------
create function create_game(p_quiz_id uuid) returns games
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_game games;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from questions where quiz_id = p_quiz_id) then
    raise exception 'quiz_empty';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from games where code = v_code);
  end loop;
  insert into games (quiz_id, code, host_id) values (p_quiz_id, v_code, auth.uid()) returning * into v_game;
  return v_game;
end $$;

create function join_game(p_code text, p_nickname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_game games;
  v_nick text := btrim(p_nickname);
  v_id uuid;
begin
  if char_length(v_nick) not between 1 and 20 then raise exception 'invalid_nickname'; end if;
  select * into v_game from games where code = upper(btrim(p_code));
  if not found then raise exception 'game_not_found'; end if;
  if v_game.phase = 'finished' then raise exception 'game_finished'; end if;

  select id into v_id from players where game_id = v_game.id and user_id = auth.uid();
  if found then return v_id; end if; -- reconexión: conserva puntaje

  -- Tope de jugadores por partida (límite de conexiones Realtime del plan de Supabase).
  if (select count(*) from players where game_id = v_game.id) >= 190 then raise exception 'game_full'; end if;

  begin
    insert into players (game_id, user_id, nickname) values (v_game.id, auth.uid(), v_nick) returning id into v_id;
  exception when unique_violation then
    raise exception 'nickname_taken';
  end;
  return v_id;
end $$;

-- Pregunta actual. correct_index solo se incluye desde el reveal. Accesible para jugadores de la partida y para el host.
create function get_current_question(p_code text) returns jsonb
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
    'options', to_jsonb(v_q.options),
    'time_limit_s', v_q.time_limit_s,
    'question_started_at', v_game.question_started_at,
    'server_now', now(),
    'correct_index', case when v_game.phase in ('reveal', 'leaderboard') then v_q.correct_index end
  );
end $$;

create function submit_answer(p_code text, p_choice int) returns void
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
end $$;

-- Puntaje, posición y resultado de la última pregunta (este último solo desde el reveal).
create function get_my_standing(p_code text) returns jsonb
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
    'score', v_score,
    'rank', v_rank,
    'answered', found,
    'last_correct', case when v_game.phase <> 'question' then v_ans.is_correct end,
    'last_points', case when v_game.phase <> 'question' then v_ans.points end
  );
end $$;

create function get_leaderboard(p_game_id uuid, p_limit int default 5)
returns table (nickname text, score bigint, rank bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from games where id = p_game_id and host_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  return query
    select p.nickname, coalesce(sum(a.points), 0)::bigint as score,
           rank() over (order by coalesce(sum(a.points), 0) desc) as rank
    from players p left join answers a on a.player_id = p.id
    where p.game_id = p_game_id
    group by p.id, p.nickname
    order by score desc, p.nickname
    limit greatest(p_limit, 1);
end $$;

-- Distribución de respuestas de la pregunta actual (host).
create function get_answer_stats(p_game_id uuid) returns int[]
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
  select array_agg((select count(*) from answers a where a.question_id = v_q.id and a.choice = i)::int order by i)
    into v_counts from generate_series(0, array_length(v_q.options, 1) - 1) i;
  return v_counts;
end $$;

create function host_advance(p_game_id uuid, p_action text) returns games
language plpgsql security definer set search_path = public as $$
declare
  v_game games;
  v_total int;
begin
  select * into v_game from games where id = p_game_id and host_id = auth.uid() for update;
  if not found then raise exception 'forbidden'; end if;
  select count(*) into v_total from questions where quiz_id = v_game.quiz_id;

  if p_action = 'start' and v_game.phase = 'lobby' then
    update games set phase = 'question', current_position = 0, question_started_at = now()
      where id = v_game.id returning * into v_game;
  elsif p_action = 'reveal' and v_game.phase = 'question' then
    update games set phase = 'reveal' where id = v_game.id returning * into v_game;
  elsif p_action = 'leaderboard' and v_game.phase = 'reveal' then
    update games set phase = 'leaderboard' where id = v_game.id returning * into v_game;
  elsif p_action = 'next' and v_game.phase in ('reveal', 'leaderboard') then
    if v_game.current_position + 1 >= v_total then
      update games set phase = 'finished' where id = v_game.id returning * into v_game;
    else
      update games set phase = 'question', current_position = current_position + 1, question_started_at = now()
        where id = v_game.id returning * into v_game;
    end if;
  elsif p_action = 'finish' and v_game.phase <> 'finished' then
    update games set phase = 'finished' where id = v_game.id returning * into v_game;
  else
    raise exception 'invalid_transition';
  end if;
  return v_game;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ---------- Realtime ----------
alter publication supabase_realtime add table games, players, answers;
