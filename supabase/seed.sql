-- Quiz de ejemplo (correr en el SQL editor después de la migración).
with q as (
  insert into quizzes (title) values ('Quiz de ejemplo') returning id
)
insert into questions (quiz_id, position, text, options, correct_index, time_limit_s)
select q.id, v.position, v.text, v.options, v.correct_index, 20
from q, (values
  (0, '¿Qué significa QR?', array['Quick Response','Quality Rate','Query Result','Quantum Radio'], 0),
  (1, '¿Cuál de estos es un canal de pago digital?', array['Google Ads','Excel','Photoshop','Slack'], 0),
  (2, '¿Qué mide el CTR?', array['Clics sobre impresiones','Costo por lead','Tiempo en página','Tasa de rebote'], 0)
) as v(position, text, options, correct_index);
