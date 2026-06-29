-- =============================================================================
-- GermaniaApp — Dummy / demo data
-- Run AFTER schema.sql (and optionally storage.sql) in the Supabase SQL editor.
-- ~10 members worldwide with geocoded homes, precise professions, families and
-- recurring gatherings — enough to exercise proximity, profession search, the
-- map, and contact export. Safe to re-run (ON CONFLICT DO NOTHING).
--
-- Members are admin-entered (auth_user_id = null); a real person "claims" their
-- row on first login. RLS is bypassed here because the SQL editor runs as owner.
-- =============================================================================

-- --- Extra profession categories (schema.sql already seeds a few) ------------
insert into profession_category (name, slug, parent_id) values
    ('Finance','finance', null),
    ('Architecture','architecture', null)
on conflict (slug) do nothing;
insert into profession_category (name, slug, parent_id)
    select v.name, v.slug, p.id
    from (values
        ('Pediatric cardiology','pediatric-cardiology','medicine'),
        ('Dermatology','dermatology','medicine'),
        ('Orthopedic surgery','orthopedic-surgery','medicine'),
        ('Tax law','tax-law','law'),
        ('Intellectual property law','ip-law','law'),
        ('Notary','notary','law')
    ) as v(name, slug, parent_slug)
    join profession_category p on p.slug = v.parent_slug
on conflict (slug) do nothing;

-- --- Members -----------------------------------------------------------------
insert into member (id, salutation, first_name, last_name, email, phone, member_since, date_of_birth, gender, bio) values
 ('a0000000-0000-0000-0000-000000000001','Dr.','Anna','Berger','anna.berger@example.org','+49 30 1110001','2016-04-01','1978-03-12','female','Urologist in Berlin.'),
 ('a0000000-0000-0000-0000-000000000002','','Thomas','Klein','thomas.klein@example.org','+49 89 1110002','2018-09-15','1982-07-08','male','Real-estate lawyer in Munich.'),
 ('a0000000-0000-0000-0000-000000000003','Dr.','Sophie','Wagner','sophie.wagner@example.org','+49 40 1110003','2020-01-20','1985-11-22','female','Pediatric cardiologist in Hamburg.'),
 ('a0000000-0000-0000-0000-000000000004','','Markus','Vogel','markus.vogel@example.org','+41 44 1110004','2014-06-10','1975-01-30','male','Tax lawyer in Zurich.'),
 ('a0000000-0000-0000-0000-000000000005','Dipl.-Ing.','Elena','Fischer','elena.fischer@example.org','+43 1 1110005','2019-11-03','1983-05-17','female','Architect in Vienna.'),
 ('a0000000-0000-0000-0000-000000000006','','David','Cohen','david.cohen@example.org','+1 212 1110006','2017-03-22','1972-09-03','male','Investment banker in New York.'),
 ('a0000000-0000-0000-0000-000000000007','Dr.','Charlotte','Bauer','charlotte.bauer@example.org','+44 20 1110007','2021-07-12','1988-02-14','female','Dermatologist in London.'),
 ('a0000000-0000-0000-0000-000000000008','','Johann','Schmidt','johann.schmidt@example.org','+49 69 1110008','2015-02-28','1969-12-01','male','Notary in Frankfurt.'),
 ('a0000000-0000-0000-0000-000000000009','Dr.','Lukas','Hoffmann','lukas.hoffmann@example.org','+49 221 1110009','2013-10-05','1974-06-25','male','Orthopedic surgeon in Cologne.'),
 ('a0000000-0000-0000-0000-00000000000a','','Camille','Laurent','camille.laurent@example.org','+33 1 1110010','2022-05-18','1986-10-09','female','IP lawyer in Paris.')
on conflict (id) do nothing;

-- --- Primary addresses (geocoded) --------------------------------------------
insert into address (member_id, label, is_primary, street, postal_code, city, region, country_code, geo) values
 ('a0000000-0000-0000-0000-000000000001','home',true,'Hauptstrasse 5','10115','Berlin','Berlin','DE',     st_setsrid(st_makepoint(13.4050,52.5200),4326)::geography),
 ('a0000000-0000-0000-0000-000000000002','home',true,'Leopoldstrasse 12','80802','Munich','Bavaria','DE',  st_setsrid(st_makepoint(11.5820,48.1351),4326)::geography),
 ('a0000000-0000-0000-0000-000000000003','home',true,'Elbchaussee 100','22763','Hamburg','Hamburg','DE',   st_setsrid(st_makepoint(9.9937,53.5511),4326)::geography),
 ('a0000000-0000-0000-0000-000000000004','home',true,'Bahnhofstrasse 3','8001','Zurich','Zurich','CH',     st_setsrid(st_makepoint(8.5417,47.3769),4326)::geography),
 ('a0000000-0000-0000-0000-000000000005','home',true,'Ringstrasse 22','1010','Vienna','Vienna','AT',       st_setsrid(st_makepoint(16.3738,48.2082),4326)::geography),
 ('a0000000-0000-0000-0000-000000000006','home',true,'5th Avenue 700','10019','New York','NY','US',        st_setsrid(st_makepoint(-74.0060,40.7128),4326)::geography),
 ('a0000000-0000-0000-0000-000000000007','home',true,'Baker Street 21','NW1','London','England','GB',      st_setsrid(st_makepoint(-0.1278,51.5074),4326)::geography),
 ('a0000000-0000-0000-0000-000000000008','home',true,'Zeil 50','60313','Frankfurt','Hesse','DE',           st_setsrid(st_makepoint(8.6821,50.1109),4326)::geography),
 ('a0000000-0000-0000-0000-000000000009','home',true,'Domkloster 4','50667','Cologne','NRW','DE',          st_setsrid(st_makepoint(6.9603,50.9375),4326)::geography),
 ('a0000000-0000-0000-0000-00000000000a','home',true,'Rue de Rivoli 10','75001','Paris','Ile-de-France','FR',st_setsrid(st_makepoint(2.3522,48.8566),4326)::geography);

-- --- Professions (precise title + taxonomy link) -----------------------------
insert into member_profession (member_id, category_id, title, organization, is_primary)
select m.member_id, c.id, m.title, m.org, true
from (values
 ('a0000000-0000-0000-0000-000000000001','urology','Urologist','Charite Berlin'),
 ('a0000000-0000-0000-0000-000000000002','real-estate-law','Real-estate-specialized lawyer','Klein & Partner'),
 ('a0000000-0000-0000-0000-000000000003','pediatric-cardiology','Pediatric cardiologist','UKE Hamburg'),
 ('a0000000-0000-0000-0000-000000000004','tax-law','Tax lawyer','Vogel Steuerrecht'),
 ('a0000000-0000-0000-0000-000000000005','architecture','Architect','Fischer Atelier'),
 ('a0000000-0000-0000-0000-000000000006','finance','Investment banker','Cohen Capital'),
 ('a0000000-0000-0000-0000-000000000007','dermatology','Dermatologist','Harley Street Clinic'),
 ('a0000000-0000-0000-0000-000000000008','notary','Notary','Schmidt Notariat'),
 ('a0000000-0000-0000-0000-000000000009','orthopedic-surgery','Orthopedic surgeon','Koln Klinik'),
 ('a0000000-0000-0000-0000-00000000000a','ip-law','Intellectual property lawyer','Laurent IP')
) as m(member_id, slug, title, org)
join profession_category c on c.slug = m.slug;

-- --- Relatives (spouses & children) ------------------------------------------
insert into relative (member_id, relationship, first_name, last_name, gender, date_of_birth, street, postal_code, city, country_code, geo) values
 ('a0000000-0000-0000-0000-000000000001','spouse','Karl','Berger','male','1979-02-14','Hauptstrasse 5','10115','Berlin','DE', st_setsrid(st_makepoint(13.4050,52.5200),4326)::geography),
 ('a0000000-0000-0000-0000-000000000001','child','Lena','Berger','female','2012-08-30','Hauptstrasse 5','10115','Berlin','DE', st_setsrid(st_makepoint(13.4050,52.5200),4326)::geography),
 ('a0000000-0000-0000-0000-000000000002','spouse','Maria','Klein','female','1983-06-09','Leopoldstrasse 12','80802','Munich','DE', st_setsrid(st_makepoint(11.5820,48.1351),4326)::geography),
 ('a0000000-0000-0000-0000-000000000004','spouse','Nina','Vogel','female','1981-11-25','Bahnhofstrasse 3','8001','Zurich','CH', st_setsrid(st_makepoint(8.5417,47.3769),4326)::geography),
 ('a0000000-0000-0000-0000-000000000004','child','Jonas','Vogel','male','2010-03-17','Bahnhofstrasse 3','8001','Zurich','CH', st_setsrid(st_makepoint(8.5417,47.3769),4326)::geography),
 ('a0000000-0000-0000-0000-000000000004','child','Mia','Vogel','female','2014-07-02','Bahnhofstrasse 3','8001','Zurich','CH', st_setsrid(st_makepoint(8.5417,47.3769),4326)::geography),
 ('a0000000-0000-0000-0000-000000000006','spouse','Rachel','Cohen','female','1976-09-19','5th Avenue 700','10019','New York','US', st_setsrid(st_makepoint(-74.0060,40.7128),4326)::geography),
 ('a0000000-0000-0000-0000-000000000009','child','Paul','Hoffmann','male','2008-01-05','Domkloster 4','50667','Cologne','DE', st_setsrid(st_makepoint(6.9603,50.9375),4326)::geography);

-- --- Gatherings (recurring, worldwide) ---------------------------------------
insert into gathering (title, description, venue_name, city, country_code, geo, starts_at, timezone, recurrence_rule, host_member_id) values
 ('Berlin Monthly Stammtisch','Casual dinner, first Friday each month.','Restaurant Lutter','Berlin','DE',
    st_setsrid(st_makepoint(13.4050,52.5200),4326)::geography,'2026-07-03 19:00+02','Europe/Berlin','FREQ=MONTHLY;BYDAY=1FR',
    'a0000000-0000-0000-0000-000000000001'),
 ('Zurich Weekly Lunch','Members lunch every Wednesday.','Cafe Sprungli','Zurich','CH',
    st_setsrid(st_makepoint(8.5417,47.3769),4326)::geography,'2026-07-01 12:30+02','Europe/Zurich','FREQ=WEEKLY;BYDAY=WE',
    'a0000000-0000-0000-0000-000000000004'),
 ('New York Quarterly Gala','Black-tie networking evening.','The Plaza','New York','US',
    st_setsrid(st_makepoint(-74.0060,40.7128),4326)::geography,'2026-09-19 18:30-04','America/New_York','FREQ=MONTHLY;INTERVAL=3;BYDAY=3SA',
    'a0000000-0000-0000-0000-000000000006'),
 ('London Members Dinner','Quarterly dinner in the City.','The Ivy','London','GB',
    st_setsrid(st_makepoint(-0.1278,51.5074),4326)::geography,'2026-07-17 19:30+01','Europe/London','FREQ=MONTHLY;INTERVAL=3;BYDAY=3FR',
    'a0000000-0000-0000-0000-000000000007');

-- =============================================================================
-- Quick checks after loading:
--   select * from member_directory order by last_name;
--   select * from members_near(52.52, 13.405, 600);   -- around Berlin
--   select * from members_by_profession('lawyer');
-- =============================================================================
