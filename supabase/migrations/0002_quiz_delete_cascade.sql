-- Los quizzes son de un solo evento: borrarlos se lleva sus partidas (y con ellas jugadores y respuestas).
alter table games drop constraint games_quiz_id_fkey;
alter table games add constraint games_quiz_id_fkey
  foreign key (quiz_id) references quizzes on delete cascade;
