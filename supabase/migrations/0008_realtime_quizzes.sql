-- El panel admin se mantiene al día en vivo: quizzes creados, editados o borrados desde otro
-- dispositivo (la cantidad de preguntas sale de questions). Realtime respeta RLS: solo lo ven admins.
alter publication supabase_realtime add table quizzes, questions;
