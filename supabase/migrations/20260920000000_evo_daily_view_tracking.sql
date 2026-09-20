-- Public Evo Daily view totals and race-safe, rolling session deduplication.
-- Both functions intentionally expose aggregate results only; raw view rows remain
-- protected by the existing evo_daily_views RLS configuration.

create or replace function public.get_evo_daily_article_view_count(article_uuid uuid)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select count(*)::bigint
  from public.evo_daily_views as views
  where views.article_id = article_uuid
    and exists (
      select 1
      from public.evo_daily_articles as articles
      where articles.id = article_uuid
        and articles.status = 'published'
        and articles.published_at is not null
        and articles.published_at <= now()
    );
$$;

revoke all on function public.get_evo_daily_article_view_count(uuid) from public;
grant execute on function public.get_evo_daily_article_view_count(uuid) to anon, authenticated;

create or replace function public.record_evo_daily_article_view(
  article_slug text,
  viewer_session_id text
)
returns table(inserted boolean, view_count bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_article_id uuid;
  did_insert boolean := false;
begin
  -- Only server-generated UUID session identifiers are accepted.
  if viewer_session_id is null
    or viewer_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception 'invalid viewer session identifier' using errcode = '22023';
  end if;

  select articles.id
  into target_article_id
  from public.evo_daily_articles as articles
  where articles.slug = article_slug
    and articles.status = 'published'
    and articles.published_at is not null
    and articles.published_at <= now()
  limit 1;

  -- Draft, archived, scheduled, and unknown slugs all have the same result.
  if target_article_id is null then
    return query select false, 0::bigint;
    return;
  end if;

  -- Serialize attempts for this article/session pair without imposing permanent
  -- uniqueness, allowing the same reader to count again after the rolling window.
  perform pg_advisory_xact_lock(
    hashtextextended(target_article_id::text || ':' || viewer_session_id, 0)
  );

  if not exists (
    select 1
    from public.evo_daily_views as views
    where views.article_id = target_article_id
      and views.session_id = viewer_session_id
      and views.viewed_at >= now() - interval '30 minutes'
  ) then
    insert into public.evo_daily_views (article_id, user_id, session_id)
    values (target_article_id, auth.uid(), viewer_session_id);
    did_insert := true;
  end if;

  return query
  select did_insert, count(*)::bigint
  from public.evo_daily_views as views
  where views.article_id = target_article_id;
end;
$$;

revoke all on function public.record_evo_daily_article_view(text, text) from public;
grant execute on function public.record_evo_daily_article_view(text, text) to anon, authenticated;

comment on function public.get_evo_daily_article_view_count(uuid) is
  'Returns only the aggregate view count for an article that is currently public.';
comment on function public.record_evo_daily_article_view(text, text) is
  'Validates publication, deduplicates a server-issued session for 30 minutes, records auth.uid(), and returns an aggregate count.';
