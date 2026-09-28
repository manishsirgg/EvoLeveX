-- One trusted, current cache row per currency pair. Historical rates and
-- product prices intentionally do not belong in this table.
create table public.currency_exchange_rates (
  base_currency text not null,
  quote_currency text not null,
  rate numeric(30, 18) not null,
  provider text not null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (base_currency, quote_currency),
  constraint currency_exchange_rates_base_supported_check
    check (base_currency in ('USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'JPY')),
  constraint currency_exchange_rates_quote_supported_check
    check (quote_currency in ('USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'JPY')),
  constraint currency_exchange_rates_distinct_pair_check check (base_currency <> quote_currency),
  constraint currency_exchange_rates_positive_rate_check check (rate > 0),
  constraint currency_exchange_rates_provider_check check (btrim(provider) <> '')
);

create trigger currency_exchange_rates_set_updated_at
before update on public.currency_exchange_rates
for each row execute function public.set_updated_at();

alter table public.currency_exchange_rates enable row level security;

-- There are deliberately no browser-facing RLS policies. All cache reads and
-- writes use the server-only service-role client.
revoke all on table public.currency_exchange_rates from anon, authenticated;
grant select, insert, update on table public.currency_exchange_rates to service_role;

-- A complete validated set is written in one transaction. Keeping this check
-- in the database prevents a caller from accidentally committing a partial set.
create function public.replace_usd_currency_exchange_rates(
  p_provider text,
  p_fetched_at timestamptz,
  p_rates jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  required_quotes constant text[] := array['EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'JPY'];
  supplied_quotes text[];
  quote text;
  parsed_rate numeric(30, 18);
begin
  if nullif(btrim(p_provider), '') is null then
    raise exception using errcode = '22023', message = 'FX provider is required';
  end if;
  if p_fetched_at is null or p_fetched_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'Invalid FX fetch timestamp';
  end if;
  if jsonb_typeof(p_rates) <> 'object' then
    raise exception using errcode = '22023', message = 'FX rates must be a JSON object';
  end if;

  select array_agg(rate_key order by rate_key)
  into supplied_quotes
  from jsonb_object_keys(p_rates) as keys(rate_key);
  if supplied_quotes is distinct from (
    select array_agg(required_quote order by required_quote)
    from unnest(required_quotes) as quotes(required_quote)
  ) then
    raise exception using errcode = '22023', message = 'FX response must contain exactly the required USD quote currencies';
  end if;

  foreach quote in array required_quotes loop
    begin
      parsed_rate := (p_rates ->> quote)::numeric(30, 18);
    exception when others then
      raise exception using errcode = '22023', message = format('Invalid FX rate for %s', quote);
    end;
    if parsed_rate is null or parsed_rate <= 0 then
      raise exception using errcode = '22023', message = format('Invalid FX rate for %s', quote);
    end if;

    insert into public.currency_exchange_rates (base_currency, quote_currency, rate, provider, fetched_at)
    values ('USD', quote, parsed_rate, btrim(p_provider), p_fetched_at)
    on conflict (base_currency, quote_currency) do update set
      rate = excluded.rate,
      provider = excluded.provider,
      fetched_at = excluded.fetched_at;
  end loop;

  return cardinality(required_quotes);
end;
$$;

revoke all on function public.replace_usd_currency_exchange_rates(text, timestamptz, jsonb) from public;
revoke all on function public.replace_usd_currency_exchange_rates(text, timestamptz, jsonb) from anon, authenticated;
grant execute on function public.replace_usd_currency_exchange_rates(text, timestamptz, jsonb) to service_role;
