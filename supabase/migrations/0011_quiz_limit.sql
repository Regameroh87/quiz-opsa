-- Tope de quizzes por usuario común (rol 'user'): 15. Los admin no tienen tope.
-- Si se cambia el número, cambiar también QUIZ_LIMIT en src/lib/game.ts.
create function enforce_quiz_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- El upsert de un quiz que ya existe también dispara este trigger (before insert): ese caso no crea nada.
  if exists (select 1 from quizzes where id = new.id) then return new; end if;
  if not exists (select 1 from admins where user_id = new.created_by and role = 'user') then return new; end if;
  -- Serializa altas simultáneas del mismo usuario para que no se pasen del tope.
  perform pg_advisory_xact_lock(hashtext(new.created_by::text));
  if (select count(*) from quizzes where created_by = new.created_by) >= 15 then
    raise exception 'quiz_limit';
  end if;
  return new;
end $$;

create trigger quizzes_limit before insert on quizzes for each row execute function enforce_quiz_limit();
