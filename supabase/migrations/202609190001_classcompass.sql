-- ClassCompass: one owner-scoped classroom, normalized entity rows and atomic CAS.
-- All app calls use an authenticated teacher JWT; no runtime service-role key.
create table public.classcompass_classrooms (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null check (revision > 0),
  header jsonb not null check (jsonb_typeof(header) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (header->>'ownerId' = owner_id::text),
  check (header#>>'{classroom,ownerId}' = owner_id::text),
  check ((header->>'revision')::integer = revision)
);
alter table public.classcompass_classrooms enable row level security;
create policy classcompass_classroom_owner on public.classcompass_classrooms to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update on public.classcompass_classrooms to authenticated;

-- The bounded JSON payload stores each entity's own fields, never the entire app.
-- Composite identities let each teacher use the same authored fixture identifiers.
do $$
declare name text;
begin
  foreach name in array array['students','assets','batches','submissions','extractions','responses','reading_reviews','response_revisions','findings','observations','lesson_plans','plan_versions','proposals','material_sets','calendar_entries','jobs','audit_events','mutation_keys','lesson_imports'] loop
    execute format('create table public.classcompass_%I (
      owner_id uuid not null references public.classcompass_classrooms(owner_id) on delete cascade,
      id text not null check (length(id) between 1 and 160),
      position integer not null check (position >= 0),
      data jsonb not null check (jsonb_typeof(data) = ''object''),
      revision integer generated always as ((data->>''revision'')::integer) stored,
      created_at timestamptz not null default now(),
      primary key(owner_id,id),
      check (data->>''id'' = id),
      check (data->>''ownerId'' = owner_id::text),
      check (revision is null or revision > 0)
    )',name);
    execute format('alter table public.classcompass_%I enable row level security',name);
    execute format('create policy owner_only on public.classcompass_%I to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',name);
    execute format('grant select, insert, update on public.classcompass_%I to authenticated',name);
  end loop;
end $$;

-- Immutable history can be read and appended, but not rewritten by a teacher.
create function public.classcompass_protect_history() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'classcompass_observations' then
    if (new.data - 'superseded' - 'supersededReason') is distinct from (old.data - 'superseded' - 'supersededReason')
      or (old.data->>'superseded' = 'true' and new.data->>'superseded' is distinct from 'true') then
      raise exception 'Observation history is immutable; append a new observation' using errcode='23514';
    end if;
  elsif new.data is distinct from old.data then
    raise exception 'Historical records are immutable' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function public.classcompass_protect_history() from public, anon;
do $$
declare name text;
begin
  foreach name in array array['extractions','reading_reviews','response_revisions','observations','plan_versions','material_sets','audit_events','mutation_keys'] loop
    execute format('create trigger immutable_history before update on public.classcompass_%I for each row execute function public.classcompass_protect_history()',name);
  end loop;
end $$;

alter table public.classcompass_submissions
  add column batch_id text generated always as (data->>'batchId') stored,
  add column student_id text generated always as (data->>'studentId') stored,
  add column asset_id text generated always as (data->>'assetId') stored,
  add unique(owner_id,batch_id,student_id),
  add foreign key(owner_id,batch_id) references public.classcompass_batches(owner_id,id) deferrable initially deferred,
  add foreign key(owner_id,student_id) references public.classcompass_students(owner_id,id) deferrable initially deferred,
  add foreign key(owner_id,asset_id) references public.classcompass_assets(owner_id,id) deferrable initially deferred;
alter table public.classcompass_extractions
  add column submission_id text generated always as (data->>'submissionId') stored,
  add foreign key(owner_id,submission_id) references public.classcompass_submissions(owner_id,id) deferrable initially deferred;
alter table public.classcompass_responses
  add column submission_id text generated always as (data->>'submissionId') stored,
  add column question_id text generated always as (data->>'questionId') stored,
  add column extraction_id text generated always as (data->>'extractionId') stored,
  add unique(owner_id,submission_id,question_id),
  add foreign key(owner_id,submission_id) references public.classcompass_submissions(owner_id,id) deferrable initially deferred,
  add foreign key(owner_id,extraction_id) references public.classcompass_extractions(owner_id,id) deferrable initially deferred;
alter table public.classcompass_findings
  add column student_id text generated always as (data->>'studentId') stored,
  add column batch_id text generated always as (data->>'batchId') stored,
  add foreign key(owner_id,student_id) references public.classcompass_students(owner_id,id) deferrable initially deferred,
  add foreign key(owner_id,batch_id) references public.classcompass_batches(owner_id,id) deferrable initially deferred;
alter table public.classcompass_observations
  add column finding_id text generated always as (data->>'findingId') stored,
  add column finding_revision integer generated always as ((data->>'findingRevision')::integer) stored,
  add unique(owner_id,finding_id,finding_revision),
  add foreign key(owner_id,finding_id) references public.classcompass_findings(owner_id,id) deferrable initially deferred;
alter table public.classcompass_lesson_plans
  add column current_version_id text generated always as (data->>'currentVersionId') stored;
alter table public.classcompass_plan_versions
  add column lesson_id text generated always as (data->>'lessonId') stored,
  add column version_number integer generated always as ((data->>'versionNumber')::integer) stored,
  add unique(owner_id,lesson_id,version_number),
  add foreign key(owner_id,lesson_id) references public.classcompass_lesson_plans(owner_id,id) deferrable initially deferred;
alter table public.classcompass_lesson_plans
  add foreign key(owner_id,current_version_id) references public.classcompass_plan_versions(owner_id,id) deferrable initially deferred;
alter table public.classcompass_material_sets
  add column plan_version_id text generated always as (data->>'planVersionId') stored,
  add foreign key(owner_id,plan_version_id) references public.classcompass_plan_versions(owner_id,id) deferrable initially deferred;
alter table public.classcompass_proposals
  add column lesson_id text generated always as (data->>'lessonId') stored,
  add column base_plan_version_id text generated always as (data->>'basePlanVersionId') stored,
  add foreign key(owner_id,lesson_id) references public.classcompass_lesson_plans(owner_id,id) deferrable initially deferred,
  add foreign key(owner_id,base_plan_version_id) references public.classcompass_plan_versions(owner_id,id) deferrable initially deferred;
alter table public.classcompass_reading_reviews
  add column response_id text generated always as (data->>'responseId') stored,
  add column response_revision integer generated always as ((data->>'responseRevision')::integer) stored,
  add unique(owner_id,response_id,response_revision),
  add foreign key(owner_id,response_id) references public.classcompass_responses(owner_id,id) deferrable initially deferred;
alter table public.classcompass_response_revisions
  add column response_id text generated always as (data->>'responseId') stored,
  add foreign key(owner_id,response_id) references public.classcompass_responses(owner_id,id) deferrable initially deferred;
alter table public.classcompass_lesson_imports
  add column asset_id text generated always as (data->>'assetId') stored,
  add foreign key(owner_id,asset_id) references public.classcompass_assets(owner_id,id) deferrable initially deferred;
create unique index classcompass_mutation_unique on public.classcompass_mutation_keys(owner_id,(data->>'operation'),(data->>'key'));
create index classcompass_findings_status on public.classcompass_findings(owner_id,batch_id,(data->>'status'));
create index classcompass_jobs_ready on public.classcompass_jobs(owner_id,(data->>'status'),(data->>'nextAttemptAt'));
create index classcompass_calendar_date on public.classcompass_calendar_entries(owner_id,(data->>'date'));
create index classcompass_observation_student_date on public.classcompass_observations(owner_id,(data->>'studentId'),(data->>'date'));

create function public.load_classcompass_state() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := auth.uid(); result jsonb; mapping record; rows jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select header into result from public.classcompass_classrooms where owner_id=v_owner;
  if result is null then return null; end if;
  for mapping in select * from (values
    ('students','students'),('assets','assets'),('batches','batches'),('submissions','submissions'),('extractions','extractions'),('responses','responses'),
    ('readingReviews','reading_reviews'),('responseRevisions','response_revisions'),('findings','findings'),('observations','observations'),
    ('plans','lesson_plans'),('planVersions','plan_versions'),('proposals','proposals'),('materialSets','material_sets'),('calendarEntries','calendar_entries'),
    ('jobs','jobs'),('auditEvents','audit_events'),('mutationKeys','mutation_keys'),('lessonImports','lesson_imports')
  ) as m(key,table_name) loop
    execute format('select coalesce(jsonb_agg(data order by position,id),''[]''::jsonb) from public.classcompass_%I where owner_id=$1',mapping.table_name) into rows using v_owner;
    result := jsonb_set(result,array[mapping.key],rows);
  end loop;
  return result;
end $$;

create function public.commit_classcompass_state(p_expected_revision integer,p_state jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_revision integer; header jsonb; mapping record; item jsonb; ordinal bigint; existing_missing boolean;
begin
  if v_owner is null or p_state->>'ownerId' is distinct from v_owner::text or p_state#>>'{classroom,ownerId}' is distinct from v_owner::text then
    raise exception 'Owner mismatch' using errcode='42501';
  end if;
  if p_state->>'schemaVersion' is distinct from '1' or p_expected_revision < 1 or (p_state->>'revision')::integer <> p_expected_revision+1 then
    raise exception 'Invalid state revision' using errcode='23514';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text,0));
  select revision into v_revision from public.classcompass_classrooms where owner_id=v_owner for update;
  if coalesce(v_revision,1) <> p_expected_revision then raise exception 'Classroom revision changed' using errcode='40001'; end if;
  header := jsonb_build_object('schemaVersion',1,'ownerId',v_owner::text,'revision',p_state->'revision','classroom',p_state->'classroom');
  if p_state ? 'lastDispatchAt' then header:=header||jsonb_build_object('lastDispatchAt',p_state->'lastDispatchAt'); end if;
  insert into public.classcompass_classrooms(owner_id,revision,header) values(v_owner,(p_state->>'revision')::integer,header)
    on conflict(owner_id) do update set revision=excluded.revision,header=excluded.header,updated_at=now();
  for mapping in select * from (values
    ('students','students'),('assets','assets'),('batches','batches'),('submissions','submissions'),('extractions','extractions'),('responses','responses'),
    ('readingReviews','reading_reviews'),('responseRevisions','response_revisions'),('findings','findings'),('observations','observations'),
    ('plans','lesson_plans'),('planVersions','plan_versions'),('proposals','proposals'),('materialSets','material_sets'),('calendarEntries','calendar_entries'),
    ('jobs','jobs'),('auditEvents','audit_events'),('mutationKeys','mutation_keys'),('lessonImports','lesson_imports')
  ) as m(key,table_name) loop
    if jsonb_typeof(p_state->mapping.key) is distinct from 'array' then raise exception 'Missing entity array: %',mapping.key using errcode='23514'; end if;
    if (select count(*) from jsonb_array_elements(p_state->mapping.key)) <> (select count(distinct row->>'id') from jsonb_array_elements(p_state->mapping.key) row) then raise exception 'Duplicate entity IDs' using errcode='23514'; end if;
    execute format('select exists(select 1 from public.classcompass_%I previous where owner_id=$1 and not exists(select 1 from jsonb_array_elements($2) supplied where supplied->>''id''=previous.id))',mapping.table_name)
      into existing_missing using v_owner,p_state->mapping.key;
    if existing_missing then raise exception 'Existing records cannot be omitted; preserve history' using errcode='23514'; end if;
    for item,ordinal in select value,ordinality from jsonb_array_elements(p_state->mapping.key) with ordinality loop
      if item->>'ownerId' is distinct from v_owner::text then raise exception 'Nested entity owner mismatch' using errcode='42501'; end if;
      execute format('insert into public.classcompass_%I(owner_id,id,position,data) values($1,$2,$3,$4) on conflict(owner_id,id) do update set position=excluded.position,data=excluded.data',mapping.table_name)
        using v_owner,item->>'id',ordinal-1,item;
    end loop;
  end loop;
end $$;
revoke all on function public.load_classcompass_state() from public,anon;
revoke all on function public.commit_classcompass_state(integer,jsonb) from public,anon;
grant execute on function public.load_classcompass_state() to authenticated;
grant execute on function public.commit_classcompass_state(integer,jsonb) to authenticated;

-- Documents stay private. A client cannot read, sign, upload or replace another owner's paths.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('classcompass-evidence','classcompass-evidence',false,5242880,array['image/png','image/jpeg','application/pdf','application/json'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy classcompass_evidence_read on storage.objects for select to authenticated
  using (bucket_id='classcompass-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy classcompass_evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id='classcompass-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy classcompass_evidence_update on storage.objects for update to authenticated
  using (bucket_id='classcompass-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='classcompass-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text);
