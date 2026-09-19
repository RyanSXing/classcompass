-- Source objects are append-only. Retries may repeat an identical upload, but
-- replacing an existing path requires preparing a fresh asset identity.
drop policy if exists classcompass_evidence_update on storage.objects;
