-- PostgREST14 automatically retries SQLSTATE40001 indefinitely.
-- A deliberate compare-and-swap conflict is an HTTP409, not a transient database failure.
create or replace function public.commit_classcompass_state(p_expected_revision integer,p_state jsonb) returns void
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
  if coalesce(v_revision,1) <> p_expected_revision then raise exception 'Classroom revision changed' using errcode='PT409'; end if;
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
