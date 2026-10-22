-- One-time cleanup: US projects store their state as the two-letter code, as the project form now
-- does, instead of a mix of codes and full names ("IN", "in", "Indiana"). Codes and names are read
-- the way lib/us-states.ts reads them; other countries' states and values that are not a US state are
-- left as they are. Safe to run more than once.
with states(code, name) as (values
  ('AL', 'alabama'),
  ('AK', 'alaska'),
  ('AZ', 'arizona'),
  ('AR', 'arkansas'),
  ('CA', 'california'),
  ('CO', 'colorado'),
  ('CT', 'connecticut'),
  ('DE', 'delaware'),
  ('DC', 'district of columbia'),
  ('FL', 'florida'),
  ('GA', 'georgia'),
  ('HI', 'hawaii'),
  ('ID', 'idaho'),
  ('IL', 'illinois'),
  ('IN', 'indiana'),
  ('IA', 'iowa'),
  ('KS', 'kansas'),
  ('KY', 'kentucky'),
  ('LA', 'louisiana'),
  ('ME', 'maine'),
  ('MD', 'maryland'),
  ('MA', 'massachusetts'),
  ('MI', 'michigan'),
  ('MN', 'minnesota'),
  ('MS', 'mississippi'),
  ('MO', 'missouri'),
  ('MT', 'montana'),
  ('NE', 'nebraska'),
  ('NV', 'nevada'),
  ('NH', 'new hampshire'),
  ('NJ', 'new jersey'),
  ('NM', 'new mexico'),
  ('NY', 'new york'),
  ('NC', 'north carolina'),
  ('ND', 'north dakota'),
  ('OH', 'ohio'),
  ('OK', 'oklahoma'),
  ('OR', 'oregon'),
  ('PA', 'pennsylvania'),
  ('PR', 'puerto rico'),
  ('RI', 'rhode island'),
  ('SC', 'south carolina'),
  ('SD', 'south dakota'),
  ('TN', 'tennessee'),
  ('TX', 'texas'),
  ('UT', 'utah'),
  ('VT', 'vermont'),
  ('VA', 'virginia'),
  ('WA', 'washington'),
  ('WV', 'west virginia'),
  ('WI', 'wisconsin'),
  ('WY', 'wyoming'),
  ('DC', 'washington dc')
), us_projects as (
  select id, lower(regexp_replace(regexp_replace(trim(state), '[.,]', '', 'g'), '\s+', ' ', 'g')) as state_key
  from public.projects
  where lower(regexp_replace(regexp_replace(trim(country), '[.,]', '', 'g'), '\s+', ' ', 'g')) in ('united states', 'united states of america', 'usa', 'us')
)
update public.projects as p
set state = s.code
from us_projects as u
join states as s on u.state_key in (lower(s.code), s.name)
where p.id = u.id
  and p.state is distinct from s.code;
