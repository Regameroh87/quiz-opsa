-- Roles del panel y quizzes privados.
--   admin: ve y edita todos los quizzes.
--   user:  solo ve, edita, borra y lanza los quizzes que creó él (quizzes.created_by).
-- Los roles se asignan desde el SQL editor (admins no tiene políticas de escritura):
--   insert into admins (user_id, role) values ('<uuid>', 'user');
--   update admins set role = 'admin' where user_id = '<uuid>';

create type admin_role as enum ('admin', 'user');

-- Por defecto 'user': un alta olvidada nunca da acceso total. Quienes ya estaban pasan a admin.
alter table admins add column role admin_role not null default 'user';
update admins set role = 'admin';

-- El dueño lo fija el servidor al crear el quiz; guardar un quiz existente ya no lo pisa.
alter table quizzes alter column created_by set default auth.uid();

create function has_admin_role() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid() and role = 'admin');
$$;

-- ¿Puede el usuario actual tocar este quiz? (admin: cualquiera; user: solo los suyos)
create function can_manage_quiz(p_quiz_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() and exists (
    select 1 from quizzes q where q.id = p_quiz_id and (has_admin_role() or q.created_by = auth.uid())
  );
$$;

revoke execute on function has_admin_role(), can_manage_quiz(uuid) from public, anon;
grant execute on function has_admin_role(), can_manage_quiz(uuid) to authenticated;

drop policy quizzes_admin on quizzes;
create policy quizzes_owner on quizzes for all to authenticated
  using (is_admin() and (has_admin_role() or created_by = auth.uid()))
  with check (is_admin() and (has_admin_role() or created_by = auth.uid()));

drop policy questions_admin on questions;
create policy questions_owner on questions for all to authenticated
  using (can_manage_quiz(quiz_id)) with check (can_manage_quiz(quiz_id));

-- Lanzar una partida: solo de un quiz propio (create_next_game también pasa por acá).
create or replace function create_game(p_quiz_id uuid) returns games
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_game games;
begin
  if not can_manage_quiz(p_quiz_id) then raise exception 'forbidden'; end if;
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
