-- Public Evo Daily like totals. This function exposes only an aggregate; raw like
-- rows remain protected by the existing evo_daily_likes RLS configuration.

create or replace function public.get_evo_daily_article_like_count(article_uuid uuid)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select count(*)::bigint
  from public.evo_daily_likes as likes
  where likes.article_id = article_uuid
    and exists (
      select 1
      from public.evo_daily_articles as articles
      where articles.id = article_uuid
        and articles.status = 'published'
        and articles.published_at is not null
        and articles.published_at <= now()
    );
$$;

revoke all on function public.get_evo_daily_article_like_count(uuid) from public;
grant execute on function public.get_evo_daily_article_like_count(uuid) to anon, authenticated;

comment on function public.get_evo_daily_article_like_count(uuid) is
  'Returns only the aggregate like count for an article that is currently public.';
