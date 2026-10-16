begin;

create extension if not exists pg_trgm;

alter table public.document_chunks
  add column if not exists chunk_index integer;

comment on column public.document_chunks.chunk_index is
  'Zero-based position within a source location, used to restore adjacent context after retrieval.';

create index if not exists document_chunks_source_location_index
  on public.document_chunks (
    source_file_id,
    page_number,
    slide_number,
    section_header,
    chunk_index
  );

create index if not exists document_chunks_source_name_trgm_index
  on public.document_chunks using gin (source_file_name gin_trgm_ops);

create index if not exists document_chunks_section_header_trgm_index
  on public.document_chunks using gin (section_header gin_trgm_ops);

create index if not exists document_chunks_content_trgm_index
  on public.document_chunks using gin (content gin_trgm_ops);

grant select on public.document_chunks to service_role;

notify pgrst, 'reload schema';

commit;
