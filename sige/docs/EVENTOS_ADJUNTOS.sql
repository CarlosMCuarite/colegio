-- Permite adjuntar hasta cinco imágenes o PDF por evento.
-- Ejecutar una vez en Supabase SQL Editor antes de usar la nueva función.
create table if not exists public.evento_adjuntos (
  id text primary key,
  "eventoId" text not null references public.eventos(id) on delete cascade,
  url text not null,
  nombre text not null,
  "mimeType" text,
  tamano integer,
  "createdAt" timestamptz not null default now()
);
create index if not exists evento_adjuntos_evento_id_idx on public.evento_adjuntos ("eventoId");
