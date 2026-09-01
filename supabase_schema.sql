-- ==============================================================================
-- NUTRILEV - BLOG DATABASE & STORAGE SCHEMA (CON CONTROL DE ACCESO ESTRICTO)
-- Ejecuta este script en el "SQL Editor" de tu panel de Supabase
-- ==============================================================================

-- 1. Crear tabla de Administradores Autorizados del Blog
create table if not exists public.blog_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.blog_admins enable row level security;

-- Permitir a los usuarios autenticados consultar si ellos mismos son administradores
create policy "Verificar si usuario actual es admin"
  on public.blog_admins
  for select
  to authenticated
  using (auth.uid() = id);

-- 2. Crear tabla de posts
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique,
  title text not null,
  excerpt text,
  content text not null,
  cover_image text,
  category text default 'Nutrición Clínica',
  reading_time text default '3 min',
  lang text not null default 'es' check (lang in ('es', 'en')),
  published boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Crear índices
create index if not exists idx_posts_slug on public.posts (slug);
create index if not exists idx_posts_lang_published on public.posts (lang, published, created_at desc);

-- 4. Habilitar Seguridad por Fila (Row Level Security - RLS)
alter table public.posts enable row level security;

-- Política de lectura pública: cualquier visitante puede ver artículos publicados
drop policy if exists "Cualquiera puede leer posts publicados" on public.posts;
create policy "Cualquiera puede leer posts publicados"
  on public.posts
  for select
  using (published = true);

-- Políticas CRUD exclusivas para miembros de blog_admins
drop policy if exists "Administrador autenticado puede ver todos los posts" on public.posts;
drop policy if exists "Solo blog_admins pueden ver todos los posts" on public.posts;
create policy "Solo blog_admins pueden ver todos los posts"
  on public.posts
  for select
  to authenticated
  using (exists (select 1 from public.blog_admins where id = auth.uid()));

drop policy if exists "Administrador autenticado puede crear posts" on public.posts;
drop policy if exists "Solo blog_admins pueden crear posts" on public.posts;
create policy "Solo blog_admins pueden crear posts"
  on public.posts
  for insert
  to authenticated
  with check (exists (select 1 from public.blog_admins where id = auth.uid()));

drop policy if exists "Administrador autenticado puede editar posts" on public.posts;
drop policy if exists "Solo blog_admins pueden editar posts" on public.posts;
create policy "Solo blog_admins pueden editar posts"
  on public.posts
  for update
  to authenticated
  using (exists (select 1 from public.blog_admins where id = auth.uid()))
  with check (exists (select 1 from public.blog_admins where id = auth.uid()));

drop policy if exists "Administrador autenticado puede eliminar posts" on public.posts;
drop policy if exists "Solo blog_admins pueden eliminar posts" on public.posts;
create policy "Solo blog_admins pueden eliminar posts"
  on public.posts
  for delete
  to authenticated
  using (exists (select 1 from public.blog_admins where id = auth.uid()));

-- 5. Configurar bucket de almacenamiento para imágenes del blog
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update set public = true;

-- Políticas de seguridad para el bucket 'blog-images' (Solo blog_admins pueden gestionar archivos)
drop policy if exists "Lectura publica de imagenes de blog" on storage.objects;
create policy "Lectura publica de imagenes de blog"
  on storage.objects
  for select
  using (bucket_id = 'blog-images');

drop policy if exists "Admin autenticado puede subir imagenes" on storage.objects;
drop policy if exists "Solo blog_admins pueden subir imagenes" on storage.objects;
create policy "Solo blog_admins pueden subir imagenes"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'blog-images' and 
    exists (select 1 from public.blog_admins where id = auth.uid())
  );

drop policy if exists "Admin autenticado puede actualizar imagenes" on storage.objects;
drop policy if exists "Solo blog_admins pueden actualizar imagenes" on storage.objects;
create policy "Solo blog_admins pueden actualizar imagenes"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'blog-images' and 
    exists (select 1 from public.blog_admins where id = auth.uid())
  )
  with check (
    bucket_id = 'blog-images' and 
    exists (select 1 from public.blog_admins where id = auth.uid())
  );

drop policy if exists "Admin autenticado puede borrar imagenes" on storage.objects;
drop policy if exists "Solo blog_admins pueden borrar imagenes" on storage.objects;
create policy "Solo blog_admins pueden borrar imagenes"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'blog-images' and 
    exists (select 1 from public.blog_admins where id = auth.uid())
  );

-- ==============================================================================
-- INSTRUCCIÓN PARA ASIGNAR TU USUARIO COMO ADMINISTRADOR:
-- Después de ejecutar este script, cambia 'tu-email-admin@nutrilev.com' por tu correo real
-- y ejecuta la siguiente línea en el SQL Editor:
--
-- insert into public.blog_admins (id, email)
-- select id, email from auth.users where email = 'tu-email-admin@nutrilev.com'
-- on conflict (email) do nothing;
-- ==============================================================================
