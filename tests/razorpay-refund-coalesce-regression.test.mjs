import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const stage3d = readFileSync(new URL(
  '../supabase/migrations/20260929060000_razorpay_refund_reconciliation.sql', import.meta.url,
), 'utf8')
const repair = readFileSync(new URL(
  '../supabase/migrations/20260929070000_fix_razorpay_refund_numeric_coalesce.sql', import.meta.url,
), 'utf8')

function reconcileDefinition(sql) {
  const start = sql.search(/create (?:or replace )?function public\.reconcile_processed_razorpay_refund\(/)
  assert.notEqual(start, -1)
  const end = sql.indexOf('\n$$;', start)
  assert.notEqual(end, -1)
  return sql.slice(start, end + 4)
}

test('forward repair uses PostgreSQL COALESCE syntax and a numeric cumulative-refund fallback', () => {
  const definition = reconcileDefinition(repair)

  assert.match(definition, /select coalesce\(pg_catalog\.sum\(refund\.amount\), 0::numeric\) into v_cumulative/)
  assert.doesNotMatch(definition, /pg_catalog\.coalesce\s*\(/)
})

test('forward repair changes only the defective COALESCE expressions in the Stage 3D RPC', () => {
  const expected = reconcileDefinition(stage3d)
    .replace('create function ', 'create or replace function ')
    .replace(
      'pg_catalog.coalesce(pg_catalog.sum(refund.amount), 0)',
      'coalesce(pg_catalog.sum(refund.amount), 0::numeric)',
    )
    .replaceAll(
      'pg_catalog.coalesce(refunded_at, p_provider_created_at, v_now)',
      'coalesce(refunded_at, p_provider_created_at, v_now)',
    )

  assert.equal(reconcileDefinition(repair), expected)
})

test('refund repair preserves the signature, security definer transaction locks, and service-only grants', () => {
  const definition = reconcileDefinition(repair)

  assert.match(repair, /reconcile_processed_razorpay_refund\(\s*p_provider_event_id text, p_payload_sha256 text, p_provider_refund_id text,\s*p_provider_payment_id text, p_refund_amount bigint, p_provider_currency text,\s*p_provider_created_at timestamptz\s*\)/)
  assert.match(definition, /returns table \(payment_id uuid, order_id uuid, refunded_amount numeric, processing_status text\)/)
  assert.match(definition, /language plpgsql security definer set search_path = ''/)
  assert.match(definition, /payment_webhook_events event[\s\S]*for update/)
  assert.match(definition, /payments payment[\s\S]*for update/)
  assert.match(definition, /orders candidate[\s\S]*for update/)
  assert.match(definition, /on conflict \(provider, provider_refund_id\) do nothing/)
  assert.match(definition, /if v_cumulative > v_payment\.amount then/)
  assert.match(definition, /if v_cumulative < v_payment\.amount then/)
  assert.match(definition, /update public\.payment_webhook_events set processing_status = 'processed'/)
  assert.match(repair, /revoke all on function public\.reconcile_processed_razorpay_refund\(text,text,text,text,bigint,text,timestamptz\) from public, anon, authenticated;/)
  assert.match(repair, /grant execute on function public\.reconcile_processed_razorpay_refund\(text,text,text,text,bigint,text,timestamptz\) to service_role;/)
  assert.doesNotMatch(repair, /grant\s+[^;]*on table/i)
})
