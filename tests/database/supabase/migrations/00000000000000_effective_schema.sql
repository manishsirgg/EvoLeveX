--
-- PostgreSQL database dump
--

-- \restrict PUnDrAc9k1A951XfDHw6hmPXRgZzchwX74Ur19YtD4oAFKGkcm3XqkyshvDwDEc

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: article_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."article_status" AS ENUM (
    'draft',
    'published',
    'archived'
);


ALTER TYPE "public"."article_status" OWNER TO "postgres";

--
-- Name: challenge_participant_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."challenge_participant_status" AS ENUM (
    'active',
    'completed',
    'withdrawn'
);


ALTER TYPE "public"."challenge_participant_status" OWNER TO "postgres";

--
-- Name: challenge_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."challenge_status" AS ENUM (
    'draft',
    'active',
    'completed',
    'archived'
);


ALTER TYPE "public"."challenge_status" OWNER TO "postgres";

--
-- Name: circle_discussion_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."circle_discussion_status" AS ENUM (
    'published',
    'locked',
    'removed'
);


ALTER TYPE "public"."circle_discussion_status" OWNER TO "postgres";

--
-- Name: circle_reply_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."circle_reply_status" AS ENUM (
    'published',
    'removed'
);


ALTER TYPE "public"."circle_reply_status" OWNER TO "postgres";

--
-- Name: commerce_source; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."commerce_source" AS ENUM (
    'evo_vault',
    'store'
);


ALTER TYPE "public"."commerce_source" OWNER TO "postgres";

--
-- Name: coupon_scope; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."coupon_scope" AS ENUM (
    'all',
    'evo_vault',
    'store'
);


ALTER TYPE "public"."coupon_scope" OWNER TO "postgres";

--
-- Name: digital_access_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."digital_access_status" AS ENUM (
    'active',
    'revoked',
    'expired'
);


ALTER TYPE "public"."digital_access_status" OWNER TO "postgres";

--
-- Name: discount_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."discount_type" AS ENUM (
    'percentage',
    'fixed_amount'
);


ALTER TYPE "public"."discount_type" OWNER TO "postgres";

--
-- Name: media_kind; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."media_kind" AS ENUM (
    'image',
    'video',
    'audio',
    'document',
    'other'
);


ALTER TYPE "public"."media_kind" OWNER TO "postgres";

--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."notification_type" AS ENUM (
    'system',
    'circle',
    'commerce',
    'course',
    'content'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'refunded'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";

--
-- Name: payment_provider; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."payment_provider" AS ENUM (
    'razorpay'
);


ALTER TYPE "public"."payment_provider" OWNER TO "postgres";

--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded',
    'partially_refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";

--
-- Name: product_mode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."product_mode" AS ENUM (
    'digital',
    'physical',
    'hybrid'
);


ALTER TYPE "public"."product_mode" OWNER TO "postgres";

--
-- Name: report_content_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."report_content_type" AS ENUM (
    'article',
    'discussion',
    'reply',
    'evo_tv_video'
);


ALTER TYPE "public"."report_content_type" OWNER TO "postgres";

--
-- Name: report_reason; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."report_reason" AS ENUM (
    'spam',
    'harassment',
    'hate',
    'misinformation',
    'copyright',
    'sexual_content',
    'violence',
    'other'
);


ALTER TYPE "public"."report_reason" OWNER TO "postgres";

--
-- Name: report_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."report_status" AS ENUM (
    'pending',
    'reviewed',
    'dismissed',
    'action_taken'
);


ALTER TYPE "public"."report_status" OWNER TO "postgres";

--
-- Name: shipment_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."shipment_status" AS ENUM (
    'pending',
    'packed',
    'shipped',
    'in_transit',
    'delivered',
    'returned',
    'cancelled'
);


ALTER TYPE "public"."shipment_status" OWNER TO "postgres";

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."user_status" AS ENUM (
    'active',
    'suspended',
    'deactivated'
);


ALTER TYPE "public"."user_status" OWNER TO "postgres";

--
-- Name: vault_product_kind; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."vault_product_kind" AS ENUM (
    'book',
    'course'
);


ALTER TYPE "public"."vault_product_kind" OWNER TO "postgres";

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE OR REPLACE FUNCTION "private"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN

  INSERT INTO public.profiles (
    id,
    display_name,
    avatar_url
  )
  VALUES (
    NEW.id,

    NULLIF(
      COALESCE(
        NEW.raw_user_meta_data ->> 'display_name',
        NEW.raw_user_meta_data ->> 'full_name'
      ),
      ''
    ),

    NULLIF(
      NEW.raw_user_meta_data ->> 'avatar_url',
      ''
    )
  )
  ON CONFLICT (id) DO NOTHING;


  INSERT INTO public.user_roles (
    user_id,
    role_id
  )
  SELECT
    NEW.id,
    r.id
  FROM public.roles r
  WHERE r.code = 'member'
  ON CONFLICT DO NOTHING;


  RETURN NEW;

END;
$$;


ALTER FUNCTION "private"."handle_new_user"() OWNER TO "postgres";

--
-- Name: is_admin(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE OR REPLACE FUNCTION "private"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r
      ON r.id = ur.role_id
    WHERE ur.user_id = (SELECT auth.uid())
      AND r.code IN (
        'super_admin',
        'admin'
      )
  );
$$;


ALTER FUNCTION "private"."is_admin"() OWNER TO "postgres";

--
-- Name: is_staff(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE OR REPLACE FUNCTION "private"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r
      ON r.id = ur.role_id
    WHERE ur.user_id = (SELECT auth.uid())
      AND r.code IN (
        'super_admin',
        'admin',
        'editor',
        'moderator',
        'support'
      )
  );
$$;


ALTER FUNCTION "private"."is_staff"() OWNER TO "postgres";

--
-- Name: is_valid_circle_parent_reply("uuid", "uuid"); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE OR REPLACE FUNCTION "private"."is_valid_circle_parent_reply"("parent_uuid" "uuid", "discussion_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
    select exists (
        select 1
        from public.evo_circle_replies as parent
        where parent.id = parent_uuid
          and parent.discussion_id = discussion_uuid
          and parent.status = 'published'::public.circle_reply_status
    );
$$;


ALTER FUNCTION "private"."is_valid_circle_parent_reply"("parent_uuid" "uuid", "discussion_uuid" "uuid") OWNER TO "postgres";

--
-- Name: notify_evo_circle_reply(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE OR REPLACE FUNCTION "private"."notify_evo_circle_reply"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$
declare
    target_user_id uuid;
    target_discussion_slug text;
    target_discussion_title text;
    actor_display_name text;
    notification_title text;
    notification_body text;
begin

    -- Only public/published replies should generate notifications.
    if new.status <> 'published' then
        return new;
    end if;


    -- Resolve the discussion.
    select
        d.slug,
        d.title
    into
        target_discussion_slug,
        target_discussion_title
    from public.evo_circle_discussions as d
    where d.id = new.discussion_id
      and d.status = 'published'
    limit 1;


    -- Do nothing if the parent discussion is unavailable/non-public.
    if target_discussion_slug is null then
        return new;
    end if;


    -- Resolve a display name for the member who replied.
    select
        coalesce(
            nullif(trim(p.display_name), ''),
            nullif(trim(p.username), ''),
            'Someone'
        )
    into actor_display_name
    from public.profiles as p
    where p.id = new.author_id
    limit 1;

    actor_display_name := coalesce(actor_display_name, 'Someone');


    -- --------------------------------------------------------
    -- TOP-LEVEL REPLY
    -- Notify the discussion author.
    -- --------------------------------------------------------
    if new.parent_reply_id is null then

        select d.author_id
        into target_user_id
        from public.evo_circle_discussions as d
        where d.id = new.discussion_id
          and d.status = 'published'
        limit 1;

        notification_title := 'New reply to your discussion';

        notification_body :=
            actor_display_name
            || ' replied to "'
            || target_discussion_title
            || '".';


    -- --------------------------------------------------------
    -- NESTED REPLY
    -- Notify only the immediate parent-reply author.
    -- --------------------------------------------------------
    else

        select r.author_id
        into target_user_id
        from public.evo_circle_replies as r
        where r.id = new.parent_reply_id
          and r.discussion_id = new.discussion_id
          and r.status = 'published'
        limit 1;

        notification_title := 'New reply to your comment';

        notification_body :=
            actor_display_name
            || ' replied to your comment in "'
            || target_discussion_title
            || '".';

    end if;


    -- No valid recipient.
    if target_user_id is null then
        return new;
    end if;


    -- Never notify a member about their own reply.
    if new.author_id is not null
       and target_user_id = new.author_id
    then
        return new;
    end if;


    insert into public.notifications (
        user_id,
        type,
        title,
        body,
        action_url,
        metadata
    )
    values (
        target_user_id,
        'circle',
        notification_title,
        notification_body,
        '/circle/discussion/' || target_discussion_slug,
        jsonb_build_object(
            'event', 'circle_reply',
            'discussion_id', new.discussion_id,
            'reply_id', new.id,
            'parent_reply_id', new.parent_reply_id,
            'actor_id', new.author_id
        )
    );


    return new;

end;
$$;


ALTER FUNCTION "private"."notify_evo_circle_reply"() OWNER TO "postgres";

--
-- Name: user_has_course_access("uuid"); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE OR REPLACE FUNCTION "private"."user_has_course_access"("p_course_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.evo_vault_enrollments e
    WHERE e.course_id = p_course_id
      AND e.user_id = (SELECT auth.uid())
  );
$$;


ALTER FUNCTION "private"."user_has_course_access"("p_course_id" "uuid") OWNER TO "postgres";

--
-- Name: user_owns_order("uuid"); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE OR REPLACE FUNCTION "private"."user_owns_order"("p_order_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.user_id = (SELECT auth.uid())
  );
$$;


ALTER FUNCTION "private"."user_owns_order"("p_order_id" "uuid") OWNER TO "postgres";

--
-- Name: attach_razorpay_order("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."attach_razorpay_order"("p_payment_id" "uuid", "p_provider_order_id" "text") RETURNS TABLE("payment_id" "uuid", "order_id" "uuid", "amount" numeric, "currency" "text", "provider_order_id" "text", "checkout_expired" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_provider_order_id text := pg_catalog.btrim(p_provider_order_id);
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if p_payment_id is null
    or v_provider_order_id is null
    or v_provider_order_id !~ '^order_[A-Za-z0-9]{8,64}$' then
    raise exception using errcode = '22023', message = 'Provider order ID is invalid.';
  end if;

  select payment.* into v_payment
  from public.payments as payment
  join public.orders as owned_order on owned_order.id = payment.order_id
  where payment.id = p_payment_id and owned_order.user_id = v_user_id
  for update of payment;

  if not found then
    raise exception using errcode = 'P0002', message = 'Payment is unavailable.';
  end if;
  select owned_order.* into v_order
  from public.orders as owned_order
  where owned_order.id = v_payment.order_id and owned_order.user_id = v_user_id
  for update;

  if v_payment.provider is distinct from 'razorpay'
    or (v_payment.status is distinct from 'pending'
      and not (v_payment.status = 'failed' and v_order.status = 'cancelled'
        and v_order.payment_status = 'failed' and v_order.checkout_expired_at is not null)) then
    raise exception using errcode = 'P0001', message = 'Payment is not eligible.';
  end if;

  -- Always preserve a first valid correlation, even if the provider call crossed
  -- the deadline. This prevents an orphaned provider order.
  if v_payment.provider_order_id is null then
    update public.payments
    set provider_order_id = v_provider_order_id
    where id = v_payment.id
    returning * into v_payment;
  elsif v_payment.provider_order_id is distinct from v_provider_order_id then
    raise exception using errcode = 'P0001', message = 'Provider order reconciliation conflict.';
  end if;

  if v_payment.status = 'failed' and v_order.checkout_expired_at is not null then
    return query select v_payment.id, v_payment.order_id, v_payment.amount,
      v_payment.currency::text, v_payment.provider_order_id, true;
    return;
  end if;

  if v_order.status = 'pending' and v_order.payment_status = 'pending'
    and v_order.checkout_expires_at <= pg_catalog.now() then
    update public.payments set status = 'failed' where id = v_payment.id returning * into v_payment;
    update public.orders set status = 'cancelled', payment_status = 'failed',
      checkout_expired_at = pg_catalog.now() where id = v_order.id;
    return query select v_payment.id, v_payment.order_id, v_payment.amount,
      v_payment.currency::text, v_payment.provider_order_id, true;
    return;
  end if;
  if v_order.status is distinct from 'pending' or v_order.payment_status is distinct from 'pending'
    or v_order.checkout_expires_at is null then
    raise exception using errcode = 'P0001', message = 'Order is not pending.';
  end if;

  return query select v_payment.id, v_payment.order_id, v_payment.amount,
    v_payment.currency::text, v_payment.provider_order_id, false;
end;
$_$;


ALTER FUNCTION "public"."attach_razorpay_order"("p_payment_id" "uuid", "p_provider_order_id" "text") OWNER TO "postgres";

--
-- Name: FUNCTION "attach_razorpay_order"("p_payment_id" "uuid", "p_provider_order_id" "text"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."attach_razorpay_order"("p_payment_id" "uuid", "p_provider_order_id" "text") IS 'Idempotently attaches a Razorpay order ID to an owned pending payment without changing payment or order status.';


--
-- Name: begin_razorpay_refund_webhook_event("text", "jsonb", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."begin_razorpay_refund_webhook_event"("p_provider_event_id" "text", "p_payload" "jsonb", "p_payload_sha256" "text", "p_provider_payment_id" "text", "p_provider_refund_id" "text") RETURNS TABLE("processing_status" "text", "payment_id" "uuid", "order_id" "uuid", "amount" numeric, "refunded_amount" numeric, "currency" "text", "provider_payment_id" "text", "provider_refund_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_event public.payment_webhook_events%rowtype;
  v_payment public.payments%rowtype;
begin
  if p_provider_event_id is null
    or p_provider_event_id !~ '^[!-~]{1,255}$'
    or p_payload is null
    or p_payload_sha256 !~ '^[a-f0-9]{64}$'
    or p_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$'
    or p_provider_refund_id !~ '^rfnd_[A-Za-z0-9]{8,64}$' then
    raise exception using
      errcode = '22023',
      message = 'Refund webhook receipt is invalid.';
  end if;

  insert into public.payment_webhook_events (
    provider,
    provider_event_id,
    event_type,
    payload,
    payload_sha256,
    provider_payment_id,
    provider_refund_id
  )
  values (
    'razorpay',
    p_provider_event_id,
    'refund.processed',
    p_payload,
    p_payload_sha256,
    p_provider_payment_id,
    p_provider_refund_id
  )
  on conflict (provider, provider_event_id)
  do nothing;

  select event.*
  into v_event
  from public.payment_webhook_events event
  where event.provider = 'razorpay'
    and event.provider_event_id = p_provider_event_id
  for update;

  if v_event.event_type is distinct from 'refund.processed'
    or v_event.payload_sha256 is distinct from p_payload_sha256
    or v_event.provider_payment_id is distinct from p_provider_payment_id
    or v_event.provider_refund_id is distinct from p_provider_refund_id then
    raise exception using
      errcode = '22023',
      message = 'Refund webhook event identity conflicts.';
  end if;

  select payment.*
  into v_payment
  from public.payments payment
  where payment.provider = 'razorpay'
    and payment.provider_payment_id = p_provider_payment_id;

  -- Match the Stage 3C receipt contract: retain the signed event for bounded
  -- failure/retry handling, but never manufacture payment/order values when the
  -- provider payment is not known locally.
  if not found then
    if v_event.processing_status not in ('processed', 'ignored') then
      update public.payment_webhook_events
      set processing_status = 'processing',
          attempt_count = attempt_count + 1,
          last_attempted_at = pg_catalog.now(),
          processing_error = null,
          safe_error_code = null,
          payment_id = null,
          order_id = null
      where id = v_event.id
      returning * into v_event;
    end if;

    return query
    select
      v_event.processing_status,
      null::uuid,
      null::uuid,
      null::numeric,
      null::numeric,
      null::text,
      v_event.provider_payment_id,
      v_event.provider_refund_id;

    return;
  end if;

  if v_event.processing_status not in ('processed', 'ignored') then
    update public.payment_webhook_events
    set processing_status = 'processing',
        attempt_count = attempt_count + 1,
        last_attempted_at = pg_catalog.now(),
        processing_error = null,
        safe_error_code = null,
        payment_id = v_payment.id,
        order_id = v_payment.order_id
    where id = v_event.id
    returning * into v_event;
  end if;

  return query
  select
    v_event.processing_status,
    v_payment.id,
    v_payment.order_id,
    v_payment.amount,
    v_payment.refunded_amount,
    v_payment.currency::text,
    v_event.provider_payment_id,
    v_event.provider_refund_id;
end;
$_$;


ALTER FUNCTION "public"."begin_razorpay_refund_webhook_event"("p_provider_event_id" "text", "p_payload" "jsonb", "p_payload_sha256" "text", "p_provider_payment_id" "text", "p_provider_refund_id" "text") OWNER TO "postgres";

--
-- Name: begin_razorpay_webhook_event("text", "text", "jsonb", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."begin_razorpay_webhook_event"("p_provider_event_id" "text", "p_event_type" "text", "p_payload" "jsonb", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text") RETURNS TABLE("processing_status" "text", "payment_id" "uuid", "order_id" "uuid", "amount" numeric, "currency" "text", "provider_order_id" "text", "provider_payment_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_event public.payment_webhook_events%rowtype;
  v_payment public.payments%rowtype;
begin
  if p_provider_event_id is null or p_provider_event_id !~ '^[!-~]{1,255}$'
    or p_event_type not in ('payment.captured', 'order.paid')
    or p_payload is null
    or p_payload_sha256 !~ '^[a-f0-9]{64}$'
    or p_provider_order_id !~ '^order_[A-Za-z0-9]{8,64}$'
    or p_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$' then
    raise exception using errcode = '22023', message = 'Webhook receipt is invalid.';
  end if;

  insert into public.payment_webhook_events (
    provider, provider_event_id, event_type, payload, payload_sha256,
    provider_order_id, provider_payment_id
  ) values (
    'razorpay', p_provider_event_id, p_event_type, p_payload, p_payload_sha256,
    p_provider_order_id, p_provider_payment_id
  ) on conflict (provider, provider_event_id) do nothing;

  select event.* into v_event
  from public.payment_webhook_events as event
  where event.provider = 'razorpay' and event.provider_event_id = p_provider_event_id
  for update;

  if v_event.event_type is distinct from p_event_type
    or v_event.payload_sha256 is distinct from p_payload_sha256
    or v_event.provider_order_id is distinct from p_provider_order_id
    or v_event.provider_payment_id is distinct from p_provider_payment_id then
    raise exception using errcode = '22023', message = 'Webhook event identity conflicts.';
  end if;

  if v_event.processing_status in ('processed', 'ignored') then
    return query select v_event.processing_status, v_event.payment_id, v_event.order_id,
      payment.amount, payment.currency::text, v_event.provider_order_id, v_event.provider_payment_id
    from public.payments as payment where payment.id = v_event.payment_id;
    if not found then
      return query select v_event.processing_status, null::uuid, null::uuid, null::numeric,
        null::text, v_event.provider_order_id, v_event.provider_payment_id;
    end if;
    return;
  end if;

  select payment.* into v_payment
  from public.payments as payment
  where payment.provider = 'razorpay' and payment.provider_order_id = p_provider_order_id;
  if not found then
    update public.payment_webhook_events
    set processing_status = 'processing', attempt_count = attempt_count + 1,
        last_attempted_at = pg_catalog.now(), processing_error = null, safe_error_code = null
    where id = v_event.id returning * into v_event;
    return query select v_event.processing_status, null::uuid, null::uuid, null::numeric,
      null::text, v_event.provider_order_id, v_event.provider_payment_id;
    return;
  end if;

  update public.payment_webhook_events
  set processing_status = 'processing', attempt_count = attempt_count + 1,
      last_attempted_at = pg_catalog.now(), processing_error = null, safe_error_code = null,
      payment_id = v_payment.id, order_id = v_payment.order_id
  where id = v_event.id
  returning * into v_event;

  return query select v_event.processing_status, v_payment.id, v_payment.order_id,
    v_payment.amount, v_payment.currency::text, v_payment.provider_order_id,
    v_event.provider_payment_id;
end;
$_$;


ALTER FUNCTION "public"."begin_razorpay_webhook_event"("p_provider_event_id" "text", "p_event_type" "text", "p_payload" "jsonb", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text") OWNER TO "postgres";

--
-- Name: confirm_razorpay_payment("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."confirm_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text") RETURNS TABLE("payment_id" "uuid", "order_id" "uuid", "provider_order_id" "text", "provider_payment_id" "text", "payment_status" "public"."payment_status", "order_status" "public"."order_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_provider_order_id text := pg_catalog.btrim(p_provider_order_id);
  v_provider_payment_id text := pg_catalog.btrim(p_provider_payment_id);
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_now timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if p_payment_id is null
    or v_provider_order_id is null
    or v_provider_order_id !~ '^order_[A-Za-z0-9]{8,64}$'
    or v_provider_payment_id is null
    or v_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$' then
    raise exception using errcode = '22023', message = 'Payment identifiers are invalid.';
  end if;

  select payment.* into v_payment
  from public.payments as payment
  join public.orders as owned_order on owned_order.id = payment.order_id
  where payment.id = p_payment_id and owned_order.user_id = v_user_id
  for update of payment;

  if not found then
    raise exception using errcode = 'P0002', message = 'Payment is unavailable.';
  end if;

  select owned_order.* into v_order
  from public.orders as owned_order
  where owned_order.id = v_payment.order_id and owned_order.user_id = v_user_id
  for update;

  if not found
    or v_payment.provider is distinct from 'razorpay'
    or v_payment.provider_order_id is distinct from v_provider_order_id then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;

  -- Authenticated/HMAC-only callers can never cross the commercial deadline.
  -- Retire and return no confirmation; the server route may recover only after
  -- it has independently fetched and validated canonical captured evidence.
  if v_payment.status = 'pending' and v_order.status = 'pending'
    and v_order.payment_status = 'pending'
    and v_order.checkout_expires_at <= pg_catalog.now() then
    update public.payments set status = 'failed' where id = v_payment.id;
    update public.orders set status = 'cancelled', payment_status = 'failed',
      checkout_expired_at = pg_catalog.now() where id = v_order.id;
    return;
  end if;
  if v_payment.amount is null
    or v_payment.amount <= 0
    or v_payment.amount is distinct from v_order.total_amount
    or v_payment.currency::text is distinct from v_order.currency::text
    or v_order.subtotal is null
    or v_order.subtotal <= 0
    or v_order.subtotal is distinct from v_order.total_amount
    or v_order.discount_amount is distinct from 0::numeric
    or v_order.shipping_amount is distinct from 0::numeric
    or v_order.tax_amount is distinct from 0::numeric then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;

  if (select pg_catalog.count(*) from public.order_items as counted
      where counted.order_id = v_order.id) <> 1 then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;

  select item.* into v_item
  from public.order_items as item
  join public.evo_vault_products as product on product.id = item.vault_product_id
  join public.evo_vault_books as book on book.vault_product_id = product.id
  where item.order_id = v_order.id
    and item.source = 'evo_vault'
    and item.quantity = 1
    and item.vault_product_id is not null
    and item.store_variant_id is null
    and item.discount_amount = 0
    and item.unit_price = v_order.subtotal
    and item.total_price = v_order.total_amount
    and product.kind = 'book'
    and product.product_mode = 'digital';

  if not found then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;

  if v_payment.provider_payment_id is not distinct from v_provider_payment_id
    and v_payment.status is not distinct from 'paid'
    and v_payment.paid_at is not null
    and v_order.payment_status is not distinct from 'paid'
    and v_order.status is not distinct from 'confirmed'
    and v_order.confirmed_at is not null then
    -- Valid duplicate confirmation: fall through so fulfillment is recovered too.
  elsif v_payment.provider_payment_id is not null
    or v_payment.status is distinct from 'pending'
    or v_order.payment_status is distinct from 'pending'
    or v_order.status is distinct from 'pending' then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  else
    v_now := pg_catalog.now();

    update public.payments
    set provider_payment_id = v_provider_payment_id,
        status = 'paid',
        paid_at = v_now
    where id = v_payment.id
    returning * into v_payment;

    update public.orders
    set payment_status = 'paid',
        status = 'confirmed',
        confirmed_at = v_now
    where id = v_order.id
    returning * into v_order;
  end if;

  -- The nested function executes inside this transaction. Any fulfillment error
  -- rolls confirmation back, preventing a paid/confirmed row without ownership.
  perform public.fulfill_confirmed_evo_vault_order(v_order.id);

  return query select v_payment.id, v_order.id, v_payment.provider_order_id,
    v_payment.provider_payment_id, v_payment.status, v_order.status;
end;
$_$;


ALTER FUNCTION "public"."confirm_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text") OWNER TO "postgres";

--
-- Name: FUNCTION "confirm_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."confirm_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text") IS 'Atomically confirms an owned Razorpay payment after server-side Checkout signature verification and grants idempotent Vault ownership.';


--
-- Name: create_pending_evo_vault_order("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_pending_evo_vault_order"("p_vault_product_id" "uuid", "p_requested_currency" "text") RETURNS TABLE("order_id" "uuid", "order_status" "public"."order_status", "payment_status" "public"."payment_status", "currency" "text", "total_amount" numeric, "created" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_requested_currency text := pg_catalog.upper(pg_catalog.btrim(p_requested_currency));
  v_product_name text;
  v_product_kind public.vault_product_kind;
  v_product_mode public.product_mode;
  v_product_price numeric;
  v_product_currency text;
  v_product_is_active boolean;
  v_fx_rate numeric;
  v_fx_fetched_at timestamptz;
  v_resolved_currency text;
  v_resolved_amount numeric;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to create an order.';
  end if;
  if p_vault_product_id is null then
    raise exception using errcode = '22023', message = 'A Vault product is required.';
  end if;
  if v_requested_currency is null
    or v_requested_currency = ''
    or v_requested_currency not in ('USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'JPY') then
    raise exception using errcode = '22023', message = 'Requested currency is unsupported.';
  end if;

  select product.name, product.kind, product.product_mode, product.price,
    pg_catalog.upper(pg_catalog.btrim(product.currency::text)), product.is_active
  into v_product_name, v_product_kind, v_product_mode, v_product_price,
    v_product_currency, v_product_is_active
  from public.evo_vault_products as product
  where product.id = p_vault_product_id;

  if not found or v_product_is_active is not true then
    raise exception 'This Vault product is unavailable.';
  end if;
  if v_product_kind is distinct from 'book' then
    raise exception 'Only digital books are currently available for checkout.';
  end if;
  if v_product_mode is distinct from 'digital' then
    raise exception 'This product is not eligible for digital checkout.';
  end if;
  if v_product_price is null or v_product_price <= 0 then
    raise exception 'Free products are not supported by paid checkout.';
  end if;

  if not public.evo_vault_book_has_deliverable_pdf(p_vault_product_id) then
    raise exception 'This digital book is not ready for delivery.';
  end if;

  if exists (
    select 1 from public.digital_access as access
    where access.user_id = v_user_id
      and access.vault_product_id = p_vault_product_id
      and access.status = 'active'
      and (access.expires_at is null or access.expires_at > pg_catalog.now())
  ) then
    raise exception 'You already have access to this product.';
  end if;

  v_resolved_currency := v_requested_currency;
  if v_requested_currency = v_product_currency then
    v_resolved_amount := v_product_price;
  elsif v_product_currency = 'USD' then
    select rate.rate, rate.fetched_at
    into v_fx_rate, v_fx_fetched_at
    from public.currency_exchange_rates as rate
    where rate.base_currency = 'USD'
      and rate.quote_currency = v_requested_currency;

    if not found then
      raise exception 'No trusted FX rate is available for the requested currency.';
    end if;
    if v_fx_rate is null or v_fx_rate <= 0 then
      raise exception 'The trusted FX rate is invalid.';
    end if;
    if v_fx_fetched_at is null or v_fx_fetched_at > pg_catalog.now() + interval '5 minutes' then
      raise exception 'The trusted FX rate has an invalid fetch timestamp.';
    end if;
    if v_fx_fetched_at < pg_catalog.now() - interval '72 hours' then
      raise exception 'The trusted FX rate has expired.';
    end if;

    v_resolved_amount := case
      when v_requested_currency = 'JPY' then pg_catalog.round(v_product_price * v_fx_rate, 0)
      else pg_catalog.round(v_product_price * v_fx_rate, 2)
    end;
  else
    raise exception 'Automatic conversion from this product currency is unsupported.';
  end if;

  if v_resolved_amount is null or v_resolved_amount <= 0 then
    raise exception 'The resolved checkout amount is invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    (('x' || pg_catalog.substr(
      pg_catalog.md5(v_user_id::text || ':' || p_vault_product_id::text), 1, 16
    ))::bit(64)::bigint)
  );

  -- The lock serializes retirement and replacement for this customer/product.
  -- A payment row is failed only while both sides are still genuinely pending.
  with expired as (
    update public.orders as stale
    set status = 'cancelled', payment_status = 'failed',
        checkout_expired_at = pg_catalog.now()
    where stale.user_id = v_user_id
      and stale.status = 'pending' and stale.payment_status = 'pending'
      and stale.checkout_expires_at <= pg_catalog.now()
      and exists (select 1 from public.order_items as stale_item
        where stale_item.order_id = stale.id
          and stale_item.source = 'evo_vault'
          and stale_item.vault_product_id = p_vault_product_id)
    returning stale.id
  )
  update public.payments as stale_payment
  set status = 'failed'
  from expired
  where stale_payment.order_id = expired.id and stale_payment.status = 'pending';

  select candidate.id into v_order_id
  from public.orders as candidate
  where candidate.user_id = v_user_id
    and candidate.status = 'pending'
    and candidate.payment_status = 'pending'
    and candidate.checkout_expires_at > pg_catalog.now()
    and candidate.subtotal = v_resolved_amount
    and candidate.discount_amount = 0
    and candidate.shipping_amount = 0
    and candidate.tax_amount = 0
    and candidate.total_amount = v_resolved_amount
    and candidate.currency::text = v_resolved_currency
    and (select pg_catalog.count(*) from public.order_items as counted_item
      where counted_item.order_id = candidate.id) = 1
    and exists (
      select 1 from public.order_items as matching_item
      where matching_item.order_id = candidate.id
        and matching_item.source = 'evo_vault'
        and matching_item.vault_product_id = p_vault_product_id
        and matching_item.store_variant_id is null
        and matching_item.quantity = 1
        and matching_item.unit_price = v_resolved_amount
        and matching_item.discount_amount = 0
        and matching_item.total_price = v_resolved_amount
    )
  order by candidate.created_at desc, candidate.id desc
  limit 1;

  if v_order_id is not null then
    return query select reusable.id, reusable.status, reusable.payment_status,
      reusable.currency::text, reusable.total_amount, false
    from public.orders as reusable where reusable.id = v_order_id;
    return;
  end if;

  insert into public.orders (
    user_id, coupon_id, status, payment_status, subtotal, discount_amount,
    shipping_amount, tax_amount, total_amount, currency, address_id,
    checkout_expires_at
  ) values (
    v_user_id, null, 'pending', 'pending', v_resolved_amount, 0,
    0, 0, v_resolved_amount, v_resolved_currency, null,
    pg_catalog.now() + interval '30 minutes'
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, source, vault_product_id, store_variant_id, product_name_snapshot,
    sku_snapshot, quantity, unit_price, discount_amount, total_price, metadata
  ) values (
    v_order_id, 'evo_vault', p_vault_product_id, null, v_product_name,
    null, 1, v_resolved_amount, 0, v_resolved_amount, '{}'::jsonb
  );

  return query select inserted_order.id, inserted_order.status,
    inserted_order.payment_status, inserted_order.currency::text,
    inserted_order.total_amount, true
  from public.orders as inserted_order where inserted_order.id = v_order_id;
end;
$$;


ALTER FUNCTION "public"."create_pending_evo_vault_order"("p_vault_product_id" "uuid", "p_requested_currency" "text") OWNER TO "postgres";

--
-- Name: FUNCTION "create_pending_evo_vault_order"("p_vault_product_id" "uuid", "p_requested_currency" "text"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."create_pending_evo_vault_order"("p_vault_product_id" "uuid", "p_requested_currency" "text") IS 'Creates or reuses an immutable trusted-currency pending order for an authenticated customer purchasing a deliverable digital Vault book.';


--
-- Name: enforce_evo_vault_book_asset_publication_readiness(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enforce_evo_vault_book_asset_publication_readiness"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  product_id uuid := old.vault_product_id;
  removes_valid_pdf boolean;
begin
  removes_valid_pdf := old.is_active and old.mime_type = 'application/pdf' and old.file_size > 0
    and (tg_op = 'DELETE' or not (new.is_active and new.mime_type = 'application/pdf' and new.file_size > 0));
  if not removes_valid_pdf then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- The subtype row is the common mutex. Every path locks it before counting assets.
  perform 1 from public.evo_vault_books
  where vault_product_id = product_id
  for update;

  if exists (
    select 1 from public.evo_vault_products product
    where product.id = product_id and product.kind = 'book' and product.is_active
      and product.product_mode in ('digital', 'hybrid')
  ) and not exists (
    select 1 from public.evo_vault_book_assets asset
    where asset.vault_product_id = product_id
      and asset.id <> old.id
      and asset.is_active
      and asset.mime_type = 'application/pdf'
      and asset.file_size > 0
  ) then
    raise exception using errcode = 'P0001', message = 'EVO_VAULT_PUBLICATION_READINESS_REQUIRED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_evo_vault_book_asset_publication_readiness"() OWNER TO "postgres";

--
-- Name: FUNCTION "enforce_evo_vault_book_asset_publication_readiness"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."enforce_evo_vault_book_asset_publication_readiness"() IS 'Prevents direct DML from removing the final normalized deliverable of an active digital/hybrid book.';


--
-- Name: enforce_evo_vault_product_publication_readiness(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."enforce_evo_vault_product_publication_readiness"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  -- UPDATE-only is intentional: save_evo_vault_product creates the parent before its
  -- book subtype, then performs the first safe readiness check after subtype creation.
  if new.kind = 'book' and new.is_active and new.product_mode in ('digital', 'hybrid')
     and (old.is_active is distinct from new.is_active
       or old.product_mode is distinct from new.product_mode
       or old.kind is distinct from new.kind) then
    perform 1 from public.evo_vault_books
    where vault_product_id = new.id
    for update;

    if not public.evo_vault_book_has_deliverable_pdf(new.id) then
      raise exception using errcode = 'P0001', message = 'EVO_VAULT_PUBLICATION_READINESS_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_evo_vault_product_publication_readiness"() OWNER TO "postgres";

--
-- Name: FUNCTION "enforce_evo_vault_product_publication_readiness"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."enforce_evo_vault_product_publication_readiness"() IS 'UPDATE-only boundary guard; subtype creation timing is handled atomically by save_evo_vault_product.';


--
-- Name: evo_vault_book_has_deliverable_pdf("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."evo_vault_book_has_deliverable_pdf"("p_product_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.evo_vault_book_assets as asset
    where asset.vault_product_id = p_product_id
      and asset.is_active = true
      and asset.mime_type = 'application/pdf'
      and asset.file_size > 0
  );
$$;


ALTER FUNCTION "public"."evo_vault_book_has_deliverable_pdf"("p_product_id" "uuid") OWNER TO "postgres";

--
-- Name: expire_pending_evo_vault_checkouts(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."expire_pending_evo_vault_checkouts"("p_batch_size" integer DEFAULT 100) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_count integer;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception using errcode = '22023', message = 'Batch size must be between 1 and 500.';
  end if;
  with candidates as (
    select candidate.id from public.orders candidate
    where candidate.status = 'pending' and candidate.payment_status = 'pending'
      and candidate.checkout_expires_at <= pg_catalog.now()
      and exists (select 1 from public.order_items item where item.order_id = candidate.id
        and item.source = 'evo_vault')
    order by candidate.checkout_expires_at, candidate.id
    limit p_batch_size for update of candidate skip locked
  ), expired as (
    update public.orders stale set status = 'cancelled', payment_status = 'failed',
      checkout_expired_at = pg_catalog.now()
    from candidates where stale.id = candidates.id returning stale.id
  ), failed_payments as (
    update public.payments payment set status = 'failed' from expired
    where payment.order_id = expired.id and payment.status = 'pending' returning payment.id
  )
  select pg_catalog.count(*)::integer into v_count from expired;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."expire_pending_evo_vault_checkouts"("p_batch_size" integer) OWNER TO "postgres";

--
-- Name: FUNCTION "expire_pending_evo_vault_checkouts"("p_batch_size" integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."expire_pending_evo_vault_checkouts"("p_batch_size" integer) IS 'Service-only bounded lazy cleanup for elapsed, still-unpaid Evo Vault checkout snapshots.';


--
-- Name: fail_razorpay_webhook_event("text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."fail_razorpay_webhook_event"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_safe_error_code" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
begin
  if p_safe_error_code !~ '^[a-z][a-z0-9_]{0,63}$' then
    raise exception using errcode = '22023', message = 'Safe error code is invalid.';
  end if;
  update public.payment_webhook_events
  set processing_status = 'failed', processed_at = null,
      processing_error = p_safe_error_code, safe_error_code = p_safe_error_code
  where provider = 'razorpay' and provider_event_id = p_provider_event_id
    and payload_sha256 = p_payload_sha256 and processing_status not in ('processed', 'ignored');
end;
$_$;


ALTER FUNCTION "public"."fail_razorpay_webhook_event"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_safe_error_code" "text") OWNER TO "postgres";

--
-- Name: finalize_evo_vault_book_asset_upload("uuid", "uuid", "text", "text", bigint, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."finalize_evo_vault_book_asset_upload"("p_product_id" "uuid", "p_asset_id" "uuid", "p_title" "text", "p_file_path" "text", "p_file_size" bigint, "p_expected_file_path" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
declare
  previous_path text;
  saved_asset_id uuid;
  next_order integer;
begin
  perform 1 from public.evo_vault_books where vault_product_id = p_product_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Vault book not found'; end if;
  if nullif(btrim(p_title), '') is null then raise exception using errcode = '22023', message = 'Asset title is required'; end if;
  if p_file_size <= 0 or p_file_size > 52428800 then raise exception using errcode = '22023', message = 'Invalid PDF size'; end if;
  if p_file_path !~ ('^vault/' || p_product_id::text || '/books/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]pdf$') then
    raise exception using errcode = '22023', message = 'Invalid managed PDF path';
  end if;

  if p_asset_id is null then
    if p_expected_file_path is not null then raise exception using errcode = '22023', message = 'New asset cannot have an expected path'; end if;
    select coalesce(max(sort_order) + 1, 0) into next_order
    from public.evo_vault_book_assets where vault_product_id = p_product_id and is_active;
    insert into public.evo_vault_book_assets
      (vault_product_id, title, file_path, file_size, mime_type, sort_order, is_primary, is_active)
    values
      (p_product_id, btrim(p_title), p_file_path, p_file_size, 'application/pdf', next_order, false, true)
    returning id into saved_asset_id;
  else
    select file_path into previous_path
    from public.evo_vault_book_assets
    where id = p_asset_id and vault_product_id = p_product_id
    for update;
    if not found or previous_path is distinct from p_expected_file_path then
      raise exception using errcode = '40001', message = 'The asset changed while the replacement was uploading';
    end if;
    update public.evo_vault_book_assets
    set title = btrim(p_title), file_path = p_file_path, file_size = p_file_size,
        mime_type = 'application/pdf', is_active = true
    where id = p_asset_id
    returning id into saved_asset_id;
  end if;

  perform public.normalize_evo_vault_book_assets(p_product_id, null);
  return jsonb_build_object('asset_id', saved_asset_id, 'previous_file_path', previous_path);
end;
$_$;


ALTER FUNCTION "public"."finalize_evo_vault_book_asset_upload"("p_product_id" "uuid", "p_asset_id" "uuid", "p_title" "text", "p_file_path" "text", "p_file_size" bigint, "p_expected_file_path" "text") OWNER TO "postgres";

--
-- Name: fulfill_confirmed_evo_vault_order("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."fulfill_confirmed_evo_vault_order"("p_order_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_existing public.digital_access%rowtype;
  v_access_id uuid;
begin
  if p_order_id is null then
    raise exception using
      errcode = '22023',
      message = 'An order is required.';
  end if;

  select candidate.*
  into v_order
  from public.orders as candidate
  where candidate.id = p_order_id
  for update;

  if not found
    or v_order.status is distinct from 'confirmed'
    or v_order.payment_status is distinct from 'paid'
    or v_order.confirmed_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'Order is not eligible for Vault fulfillment.';
  end if;

  -- The paid provider relationship, not a caller assertion, authorizes fulfillment.
  if not exists (
    select 1
    from public.payments as payment
    where payment.order_id = v_order.id
      and payment.provider = 'razorpay'
      and payment.status = 'paid'
      and payment.provider_order_id is not null
      and payment.provider_payment_id is not null
      and payment.paid_at is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Order payment is not eligible for Vault fulfillment.';
  end if;

  if (
    select pg_catalog.count(*)
    from public.order_items as counted
    where counted.order_id = v_order.id
  ) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Order items are not eligible for Vault fulfillment.';
  end if;

  select item.*
  into v_item
  from public.order_items as item
  join public.evo_vault_products as product
    on product.id = item.vault_product_id
  join public.evo_vault_books as book
    on book.vault_product_id = product.id
  where item.order_id = v_order.id
    and item.source = 'evo_vault'
    and item.quantity = 1
    and item.vault_product_id is not null
    and item.store_variant_id is null
    and product.kind = 'book'
    and product.product_mode = 'digital';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Order item is not eligible for Vault fulfillment.';
  end if;

  insert into public.digital_access (
    user_id,
    source,
    vault_product_id,
    store_variant_id,
    order_item_id,
    status,
    granted_at,
    expires_at,
    revoked_at
  )
  values (
    v_order.user_id,
    'evo_vault',
    v_item.vault_product_id,
    null,
    v_item.id,
    'active',
    pg_catalog.now(),
    null,
    null
  )
  on conflict (user_id, vault_product_id)
  where vault_product_id is not null
  do update set
    order_item_id = excluded.order_item_id,
    status = 'active',
    granted_at = excluded.granted_at,
    expires_at = null,
    revoked_at = null,
    updated_at = pg_catalog.now()
  -- A retry must not undo a later revocation of the entitlement it originally made.
  -- A genuinely new purchase may reactivate an older expired/revoked entitlement,
  -- and replaces provenance and grant time with the new paid order item.
  where public.digital_access.status is distinct from 'active'
    and public.digital_access.order_item_id is distinct from excluded.order_item_id
  returning id into v_access_id;

  if v_access_id is null then
    select access.*
    into v_existing
    from public.digital_access as access
    where access.user_id = v_order.user_id
      and access.vault_product_id = v_item.vault_product_id;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'Vault fulfillment requires reconciliation.';
    end if;

    v_access_id := v_existing.id;
  end if;

  return v_access_id;
end;
$$;


ALTER FUNCTION "public"."fulfill_confirmed_evo_vault_order"("p_order_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "fulfill_confirmed_evo_vault_order"("p_order_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."fulfill_confirmed_evo_vault_order"("p_order_id" "uuid") IS 'Idempotently grants canonical digital_access for one confirmed, paid Razorpay Vault order; callable directly only by service_role for controlled recovery.';


--
-- Name: get_evo_circle_discussion_like_count("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_evo_circle_discussion_like_count"("discussion_uuid" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
    select count(*)::bigint
    from public.evo_circle_discussion_likes as likes
    where likes.discussion_id = discussion_uuid
      and exists (
          select 1
          from public.evo_circle_discussions as discussions
          where discussions.id = discussion_uuid
            and discussions.status = 'published'::public.circle_discussion_status
      );
$$;


ALTER FUNCTION "public"."get_evo_circle_discussion_like_count"("discussion_uuid" "uuid") OWNER TO "postgres";

--
-- Name: get_evo_circle_discussion_view_count("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_evo_circle_discussion_view_count"("discussion_uuid" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$

    select count(*)::bigint
    from public.evo_circle_discussion_views as views
    where views.discussion_id = discussion_uuid
      and exists (
          select 1
          from public.evo_circle_discussions as discussions
          where discussions.id = discussion_uuid
            and discussions.status = 'published'
      );

$$;


ALTER FUNCTION "public"."get_evo_circle_discussion_view_count"("discussion_uuid" "uuid") OWNER TO "postgres";

--
-- Name: get_evo_circle_reply_like_count("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_evo_circle_reply_like_count"("reply_uuid" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
    select count(*)::bigint
    from public.evo_circle_reply_likes as likes
    where likes.reply_id = reply_uuid
      and exists (
          select 1
          from public.evo_circle_replies as replies
          join public.evo_circle_discussions as discussions
            on discussions.id = replies.discussion_id
          where replies.id = reply_uuid
            and replies.status = 'published'::public.circle_reply_status
            and discussions.status = 'published'::public.circle_discussion_status
      );
$$;


ALTER FUNCTION "public"."get_evo_circle_reply_like_count"("reply_uuid" "uuid") OWNER TO "postgres";

--
-- Name: get_evo_daily_article_like_count("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_evo_daily_article_like_count"("article_uuid" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."get_evo_daily_article_like_count"("article_uuid" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "get_evo_daily_article_like_count"("article_uuid" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."get_evo_daily_article_like_count"("article_uuid" "uuid") IS 'Returns only the aggregate like count for an article that is currently public.';


--
-- Name: get_evo_daily_article_view_count("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_evo_daily_article_view_count"("article_uuid" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."get_evo_daily_article_view_count"("article_uuid" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "get_evo_daily_article_view_count"("article_uuid" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."get_evo_daily_article_view_count"("article_uuid" "uuid") IS 'Returns only the aggregate view count for an article that is currently public.';


--
-- Name: get_evo_tv_video_like_count("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_evo_tv_video_like_count"("video_uuid" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
    select count(*)::bigint
    from public.evo_tv_video_likes as likes
    where likes.video_id = video_uuid
      and exists (
          select 1
          from public.evo_tv_videos as videos
          where videos.id = video_uuid
            and videos.active = true
            and (
                videos.published_at is null
                or videos.published_at <= now()
            )
      );
$$;


ALTER FUNCTION "public"."get_evo_tv_video_like_count"("video_uuid" "uuid") OWNER TO "postgres";

--
-- Name: get_evo_tv_video_view_count("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_evo_tv_video_view_count"("video_uuid" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
    select count(*)::bigint
    from public.evo_tv_video_views as views
    where views.video_id = video_uuid
      and exists (
          select 1
          from public.evo_tv_videos as videos
          where videos.id = video_uuid
            and videos.active = true
            and (
                videos.published_at is null
                or videos.published_at <= now()
            )
      );
$$;


ALTER FUNCTION "public"."get_evo_tv_video_view_count"("video_uuid" "uuid") OWNER TO "postgres";

--
-- Name: ignore_razorpay_webhook_event("text", "text", "jsonb", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."ignore_razorpay_webhook_event"("p_provider_event_id" "text", "p_event_type" "text", "p_payload" "jsonb", "p_payload_sha256" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare v_event public.payment_webhook_events%rowtype;
begin
  if p_provider_event_id is null or p_provider_event_id !~ '^[!-~]{1,255}$'
    or p_event_type is null or pg_catalog.btrim(p_event_type) = ''
    or p_payload is null or p_payload_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Webhook receipt is invalid.';
  end if;
  insert into public.payment_webhook_events (
    provider, provider_event_id, event_type, payload, payload_sha256,
    processing_status, attempt_count, last_attempted_at, processed_at
  ) values (
    'razorpay', p_provider_event_id, p_event_type, p_payload, p_payload_sha256,
    'ignored', 1, pg_catalog.now(), pg_catalog.now()
  ) on conflict (provider, provider_event_id) do nothing;
  select event.* into v_event from public.payment_webhook_events event
    where event.provider = 'razorpay' and event.provider_event_id = p_provider_event_id for update;
  if v_event.event_type is distinct from p_event_type
    or v_event.payload_sha256 is distinct from p_payload_sha256 then
    raise exception using errcode = '22023', message = 'Webhook event identity conflicts.';
  end if;
  if v_event.processing_status not in ('processed', 'ignored') then
    update public.payment_webhook_events set processing_status = 'ignored',
      attempt_count = attempt_count + 1, last_attempted_at = pg_catalog.now(),
      processed_at = pg_catalog.now(), processing_error = null, safe_error_code = null
    where id = v_event.id;
  end if;
  return 'ignored';
end;
$_$;


ALTER FUNCTION "public"."ignore_razorpay_webhook_event"("p_provider_event_id" "text", "p_event_type" "text", "p_payload" "jsonb", "p_payload_sha256" "text") OWNER TO "postgres";

--
-- Name: mutate_evo_vault_book_asset("uuid", "uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."mutate_evo_vault_book_asset"("p_product_id" "uuid", "p_asset_id" "uuid", "p_operation" "text", "p_title" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  target public.evo_vault_book_assets%rowtype;
  swap_id uuid;
  preferred_primary uuid;
begin
  perform 1 from public.evo_vault_books where vault_product_id = p_product_id for update;
  select * into target from public.evo_vault_book_assets
  where id = p_asset_id and vault_product_id = p_product_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Book asset not found'; end if;

  if p_operation = 'rename' then
    if nullif(btrim(p_title), '') is null then raise exception using errcode = '22023', message = 'Asset title is required'; end if;
    update public.evo_vault_book_assets set title = btrim(p_title) where id = target.id;
  elsif p_operation = 'primary' then
    if not target.is_active then raise exception using errcode = '22023', message = 'Inactive assets cannot be primary'; end if;
    preferred_primary := target.id;
  elsif p_operation in ('up', 'down') then
    if not target.is_active then raise exception using errcode = '22023', message = 'Inactive assets cannot be reordered'; end if;
    select id into swap_id from public.evo_vault_book_assets
    where vault_product_id = p_product_id and is_active
      and case when p_operation = 'up' then sort_order < target.sort_order else sort_order > target.sort_order end
    order by case when p_operation = 'up' then sort_order end desc,
             case when p_operation = 'down' then sort_order end asc,
             created_at, id limit 1;
    if swap_id is not null then
      update public.evo_vault_book_assets set sort_order = target.sort_order where id = swap_id;
      update public.evo_vault_book_assets
      set sort_order = case when p_operation = 'up' then greatest(target.sort_order - 1, 0) else target.sort_order + 1 end
      where id = target.id;
    end if;
  elsif p_operation = 'remove' then
    if target.is_active and target.mime_type = 'application/pdf' and target.file_size > 0
       and exists (select 1 from public.evo_vault_products product
         where product.id = p_product_id and product.kind = 'book' and product.is_active
           and product.product_mode in ('digital', 'hybrid'))
       and not exists (select 1 from public.evo_vault_book_assets asset
         where asset.vault_product_id = p_product_id and asset.id <> target.id
           and asset.is_active and asset.mime_type = 'application/pdf' and asset.file_size > 0) then
      raise exception using errcode = 'P0001', message = 'EVO_VAULT_PUBLICATION_READINESS_REQUIRED';
    end if;
    update public.evo_vault_book_assets set is_active = false, is_primary = false where id = target.id;
  else
    raise exception using errcode = '22023', message = 'Unsupported asset operation';
  end if;

  perform public.normalize_evo_vault_book_assets(p_product_id, preferred_primary);
  return jsonb_build_object(
    'removed_file_path', case when p_operation = 'remove' then target.file_path else null end
  );
end;
$$;


ALTER FUNCTION "public"."mutate_evo_vault_book_asset"("p_product_id" "uuid", "p_asset_id" "uuid", "p_operation" "text", "p_title" "text") OWNER TO "postgres";

--
-- Name: normalize_evo_vault_book_assets("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."normalize_evo_vault_book_assets"("p_product_id" "uuid", "p_preferred_primary_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  selected_primary_id uuid;
begin
  -- The book row is the per-product mutex for every asset mutation.
  perform 1 from public.evo_vault_books
  where vault_product_id = p_product_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Vault book not found';
  end if;

  select asset.id into selected_primary_id
  from public.evo_vault_book_assets asset
  where asset.vault_product_id = p_product_id
    and asset.is_active
    and (asset.id = p_preferred_primary_id or (p_preferred_primary_id is null and asset.is_primary))
  order by (asset.id = p_preferred_primary_id) desc, asset.sort_order, asset.created_at, asset.id
  limit 1;

  if selected_primary_id is null then
    select asset.id into selected_primary_id
    from public.evo_vault_book_assets asset
    where asset.vault_product_id = p_product_id and asset.is_active
    order by asset.sort_order, asset.created_at, asset.id
    limit 1;
  end if;

  -- Clear first so changing primary never transiently violates the partial unique index.
  update public.evo_vault_book_assets
  set is_primary = false
  where vault_product_id = p_product_id and is_primary;

  with ordered as (
    select id, row_number() over (order by sort_order, created_at, id) - 1 as normalized_order
    from public.evo_vault_book_assets
    where vault_product_id = p_product_id and is_active
  )
  update public.evo_vault_book_assets asset
  set sort_order = ordered.normalized_order
  from ordered
  where asset.id = ordered.id and asset.sort_order <> ordered.normalized_order;

  update public.evo_vault_book_assets
  set is_primary = true
  where id = selected_primary_id;

  update public.evo_vault_books book
  set digital_file_path = primary_asset.file_path,
      digital_file_size = primary_asset.file_size,
      updated_at = now()
  from public.evo_vault_book_assets primary_asset
  where book.vault_product_id = p_product_id
    and primary_asset.id = selected_primary_id;

  if selected_primary_id is null then
    update public.evo_vault_books
    set digital_file_path = null, digital_file_size = null, updated_at = now()
    where vault_product_id = p_product_id;
  end if;

  return selected_primary_id;
end;
$$;


ALTER FUNCTION "public"."normalize_evo_vault_book_assets"("p_product_id" "uuid", "p_preferred_primary_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "normalize_evo_vault_book_assets"("p_product_id" "uuid", "p_preferred_primary_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."normalize_evo_vault_book_assets"("p_product_id" "uuid", "p_preferred_primary_id" "uuid") IS 'Service-role-only atomic ordering, primary selection, and Stage 2B legacy book-field synchronization.';


--
-- Name: reconcile_captured_razorpay_payment("text", "text", "text", "text", bigint, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."reconcile_captured_razorpay_payment"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text") RETURNS TABLE("payment_id" "uuid", "order_id" "uuid", "processing_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_event public.payment_webhook_events%rowtype;
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_now timestamptz;
  v_expected_amount numeric;
begin
  if p_provider_event_id is null or p_payload_sha256 !~ '^[a-f0-9]{64}$'
    or p_provider_order_id !~ '^order_[A-Za-z0-9]{8,64}$'
    or p_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$'
    or p_provider_amount <= 0 or p_provider_currency not in
      ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY') then
    raise exception using errcode = '22023', message = 'Reconciliation input is invalid.';
  end if;

  select event.* into v_event from public.payment_webhook_events event
  where event.provider = 'razorpay' and event.provider_event_id = p_provider_event_id
  for update;
  if not found or v_event.payload_sha256 is distinct from p_payload_sha256
    or v_event.provider_order_id is distinct from p_provider_order_id
    or v_event.provider_payment_id is distinct from p_provider_payment_id then
    raise exception using errcode = 'P0001', message = 'Webhook event requires reconciliation.';
  end if;
  if v_event.processing_status = 'processed' then
    return query select v_event.payment_id, v_event.order_id, 'processed'::text;
    return;
  end if;
  if v_event.processing_status <> 'processing' then
    raise exception using errcode = 'P0001', message = 'Webhook event is not claimed.';
  end if;

  select payment.* into v_payment from public.payments payment
  where payment.provider = 'razorpay' and payment.provider_order_id = p_provider_order_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Payment is unavailable.'; end if;
  select candidate.* into v_order from public.orders candidate
  where candidate.id = v_payment.order_id for update;

  v_expected_amount := case when p_provider_currency = 'JPY'
    then v_payment.amount else v_payment.amount * 100 end;
  if v_payment.provider is distinct from 'razorpay'
    or v_payment.provider_order_id is distinct from p_provider_order_id
    or v_payment.amount is null or v_payment.amount <= 0
    or v_payment.amount is distinct from v_order.total_amount
    or v_payment.currency::text is distinct from v_order.currency::text
    or v_payment.currency::text is distinct from p_provider_currency
    or v_expected_amount is distinct from p_provider_amount::numeric
    or v_order.subtotal is null or v_order.subtotal <= 0
    or v_order.subtotal is distinct from v_order.total_amount
    or v_order.discount_amount is distinct from 0::numeric
    or v_order.shipping_amount is distinct from 0::numeric
    or v_order.tax_amount is distinct from 0::numeric then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;

  if (select pg_catalog.count(*) from public.order_items counted
      where counted.order_id = v_order.id) <> 1 then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;
  select item.* into v_item from public.order_items item
  join public.evo_vault_products product on product.id = item.vault_product_id
  join public.evo_vault_books book on book.vault_product_id = product.id
  where item.order_id = v_order.id and item.source = 'evo_vault' and item.quantity = 1
    and item.vault_product_id is not null and item.store_variant_id is null
    and item.discount_amount = 0 and item.unit_price = v_order.subtotal
    and item.total_price = v_order.total_amount and product.kind = 'book'
    and product.product_mode = 'digital';
  if not found then raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.'; end if;

  if v_payment.provider_payment_id is not distinct from p_provider_payment_id
    and v_payment.status = 'paid' and v_payment.paid_at is not null
    and v_order.payment_status = 'paid' and v_order.status = 'confirmed'
    and v_order.confirmed_at is not null then
    null; -- Browser-first or duplicate webhook convergence.
  elsif v_payment.provider_payment_id is not null then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  elsif not (
      (v_payment.status = 'pending' and v_order.payment_status = 'pending' and v_order.status = 'pending')
      or (v_payment.status = 'failed' and v_order.payment_status = 'failed'
        and v_order.status = 'cancelled' and v_order.checkout_expired_at is not null
        and v_order.checkout_expires_at <= pg_catalog.now())
    ) then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  else
    v_now := pg_catalog.now();
    update public.payments set provider_payment_id = p_provider_payment_id,
      status = 'paid', paid_at = v_now where id = v_payment.id returning * into v_payment;
    update public.orders set payment_status = 'paid', status = 'confirmed',
      confirmed_at = v_now where id = v_order.id returning * into v_order;
  end if;

  perform public.fulfill_confirmed_evo_vault_order(v_order.id);
  update public.payment_webhook_events set processing_status = 'processed',
    processed_at = pg_catalog.now(), processing_error = null, safe_error_code = null,
    payment_id = v_payment.id, order_id = v_order.id
  where id = v_event.id;
  return query select v_payment.id, v_order.id, 'processed'::text;
end;
$_$;


ALTER FUNCTION "public"."reconcile_captured_razorpay_payment"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text") OWNER TO "postgres";

--
-- Name: FUNCTION "reconcile_captured_razorpay_payment"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."reconcile_captured_razorpay_payment"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text") IS 'Service-only atomic Razorpay captured-payment reconciliation, Vault fulfillment, and webhook completion.';


--
-- Name: reconcile_processed_razorpay_refund("text", "text", "text", "text", bigint, "text", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."reconcile_processed_razorpay_refund"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_refund_id" "text", "p_provider_payment_id" "text", "p_refund_amount" bigint, "p_provider_currency" "text", "p_provider_created_at" timestamp with time zone) RETURNS TABLE("payment_id" "uuid", "order_id" "uuid", "refunded_amount" numeric, "processing_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_event public.payment_webhook_events%rowtype;
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_existing public.payment_refunds%rowtype;
  v_refund_amount numeric;
  v_cumulative numeric;
  v_now timestamptz := pg_catalog.now();
begin
  if p_provider_event_id is null or p_payload_sha256 !~ '^[a-f0-9]{64}$'
    or p_provider_refund_id !~ '^rfnd_[A-Za-z0-9]{8,64}$'
    or p_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$' or p_refund_amount <= 0
    or p_provider_currency not in ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY')
    or p_provider_created_at is null then
    raise exception using errcode = '22023', message = 'Refund reconciliation input is invalid.';
  end if;

  select event.* into v_event from public.payment_webhook_events event
  where event.provider = 'razorpay' and event.provider_event_id = p_provider_event_id for update;
  if not found or v_event.event_type is distinct from 'refund.processed'
    or v_event.payload_sha256 is distinct from p_payload_sha256
    or v_event.provider_refund_id is distinct from p_provider_refund_id
    or v_event.provider_payment_id is distinct from p_provider_payment_id then
    raise exception using errcode = 'P0001', message = 'Refund webhook requires reconciliation.';
  end if;
  if v_event.processing_status = 'processed' then
    return query select v_event.payment_id, v_event.order_id, payment.refunded_amount, 'processed'::text
      from public.payments payment where payment.id = v_event.payment_id;
    return;
  end if;
  if v_event.processing_status <> 'processing' then
    raise exception using errcode = 'P0001', message = 'Refund webhook is not claimed.';
  end if;

  select payment.* into v_payment from public.payments payment
  where payment.provider = 'razorpay' and payment.provider_payment_id = p_provider_payment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Payment is unavailable.'; end if;
  select candidate.* into v_order from public.orders candidate where candidate.id = v_payment.order_id for update;

  if p_provider_currency = 'JPY' then
    v_refund_amount := p_refund_amount::numeric;
  else
    v_refund_amount := p_refund_amount::numeric / 100;
  end if;
  if v_payment.currency::text is distinct from p_provider_currency
    or v_order.currency::text is distinct from p_provider_currency
    or v_payment.amount is distinct from v_order.total_amount
    or v_payment.status not in ('paid', 'partially_refunded', 'refunded')
    or v_order.status not in ('confirmed', 'refunded') then
    raise exception using errcode = 'P0001', message = 'Refund payment requires reconciliation.';
  end if;

  select refund.* into v_existing from public.payment_refunds refund
  where refund.provider = 'razorpay' and refund.provider_refund_id = p_provider_refund_id for update;
  if found and (v_existing.payment_id is distinct from v_payment.id
    or v_existing.amount is distinct from v_refund_amount
    or v_existing.currency is distinct from p_provider_currency
    or v_existing.status is distinct from 'processed') then
    raise exception using errcode = 'P0001', message = 'Provider refund identity conflicts.';
  end if;

  insert into public.payment_refunds (payment_id, provider, provider_refund_id, amount, currency,
    status, provider_created_at, processed_at)
  values (v_payment.id, 'razorpay', p_provider_refund_id, v_refund_amount, p_provider_currency,
    'processed', p_provider_created_at, v_now)
  on conflict (provider, provider_refund_id) do nothing;

  select coalesce(pg_catalog.sum(refund.amount), 0::numeric) into v_cumulative
  from public.payment_refunds refund where refund.payment_id = v_payment.id and refund.status = 'processed';
  if v_cumulative > v_payment.amount then
    raise exception using errcode = 'P0001', message = 'Cumulative refund exceeds payment.';
  end if;

  if v_cumulative < v_payment.amount then
    if v_order.status is distinct from 'confirmed' then
      raise exception using errcode = 'P0001', message = 'Partial refund order requires reconciliation.';
    end if;
    update public.payments set refunded_amount = v_cumulative, status = 'partially_refunded'
      where id = v_payment.id;
    update public.orders set payment_status = 'partially_refunded' where id = v_order.id;
  else
    update public.payments set refunded_amount = v_cumulative, status = 'refunded',
      refunded_at = coalesce(refunded_at, p_provider_created_at, v_now) where id = v_payment.id;
    update public.orders set payment_status = 'refunded', status = 'refunded',
      refunded_at = coalesce(refunded_at, p_provider_created_at, v_now) where id = v_order.id;
    update public.digital_access access set status = 'revoked', revoked_at = v_now, updated_at = v_now
    from public.order_items item
    where item.order_id = v_order.id and item.source = 'evo_vault'
      and item.vault_product_id is not null and item.store_variant_id is null
      and access.order_item_id = item.id and access.user_id = v_order.user_id
      and access.source = 'evo_vault' and access.vault_product_id = item.vault_product_id
      and access.status = 'active' and access.revoked_at is null;
  end if;

  update public.payment_webhook_events set processing_status = 'processed', processed_at = v_now,
    processing_error = null, safe_error_code = null, payment_id = v_payment.id, order_id = v_order.id
  where id = v_event.id;
  return query select v_payment.id, v_order.id, v_cumulative, 'processed'::text;
end;
$_$;


ALTER FUNCTION "public"."reconcile_processed_razorpay_refund"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_refund_id" "text", "p_provider_payment_id" "text", "p_refund_amount" bigint, "p_provider_currency" "text", "p_provider_created_at" timestamp with time zone) OWNER TO "postgres";

--
-- Name: FUNCTION "reconcile_processed_razorpay_refund"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_refund_id" "text", "p_provider_payment_id" "text", "p_refund_amount" bigint, "p_provider_currency" "text", "p_provider_created_at" timestamp with time zone); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."reconcile_processed_razorpay_refund"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_refund_id" "text", "p_provider_payment_id" "text", "p_refund_amount" bigint, "p_provider_currency" "text", "p_provider_created_at" timestamp with time zone) IS 'Service-only atomic reconciliation of a canonically verified processed Razorpay refund.';


--
-- Name: record_evo_circle_discussion_view("text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."record_evo_circle_discussion_view"("discussion_slug" "text", "viewer_session_id" "text") RETURNS TABLE("inserted" boolean, "view_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare
    target_discussion_id uuid;
    did_insert boolean := false;
    authoritative_count bigint := 0;
begin

    if viewer_session_id is null
       or viewer_session_id !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
        raise exception 'invalid viewer session identifier'
            using errcode = '22023';
    end if;

    select discussions.id
    into target_discussion_id
    from public.evo_circle_discussions as discussions
    where discussions.slug = discussion_slug
      and discussions.status = 'published'
    limit 1;

    if target_discussion_id is null then
        return query
        select false, 0::bigint;

        return;
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            target_discussion_id::text || ':' || viewer_session_id,
            0
        )
    );

    if not exists (
        select 1
        from public.evo_circle_discussion_views as views
        where views.discussion_id = target_discussion_id
          and views.session_id = viewer_session_id
          and views.viewed_at >= now() - interval '30 minutes'
    ) then

        insert into public.evo_circle_discussion_views (
            discussion_id,
            user_id,
            session_id
        )
        values (
            target_discussion_id,
            auth.uid(),
            viewer_session_id
        );

        did_insert := true;
    end if;

    select count(*)::bigint
    into authoritative_count
    from public.evo_circle_discussion_views as views
    where views.discussion_id = target_discussion_id;

    update public.evo_circle_discussions as discussions
    set view_count = authoritative_count
    where discussions.id = target_discussion_id
      and discussions.view_count is distinct from authoritative_count;

    return query
    select did_insert, authoritative_count;

end;
$_$;


ALTER FUNCTION "public"."record_evo_circle_discussion_view"("discussion_slug" "text", "viewer_session_id" "text") OWNER TO "postgres";

--
-- Name: record_evo_daily_article_view("text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."record_evo_daily_article_view"("article_slug" "text", "viewer_session_id" "text") RETURNS TABLE("inserted" boolean, "view_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."record_evo_daily_article_view"("article_slug" "text", "viewer_session_id" "text") OWNER TO "postgres";

--
-- Name: FUNCTION "record_evo_daily_article_view"("article_slug" "text", "viewer_session_id" "text"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."record_evo_daily_article_view"("article_slug" "text", "viewer_session_id" "text") IS 'Validates publication, deduplicates a server-issued session for 30 minutes, records auth.uid(), and returns an aggregate count.';


--
-- Name: record_evo_tv_video_view("text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."record_evo_tv_video_view"("video_slug" "text", "viewer_session_id" "text") RETURNS TABLE("inserted" boolean, "view_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare
    target_video_id uuid;
    did_insert boolean := false;
begin

    -- Only UUID-v4 session identifiers are accepted.
    -- The application API will issue/validate this identifier server-side.
    if viewer_session_id is null
       or viewer_session_id !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
        raise exception 'invalid viewer session identifier'
            using errcode = '22023';
    end if;


    -- Resolve only a currently public Evo TV video.
    select videos.id
    into target_video_id
    from public.evo_tv_videos as videos
    where videos.slug = video_slug
      and videos.active = true
      and (
          videos.published_at is null
          or videos.published_at <= now()
      )
    limit 1;


    -- Hidden, future-scheduled, or unknown videos all behave the same.
    if target_video_id is null then
        return query
        select false, 0::bigint;

        return;
    end if;


    -- Serialize competing requests for this video/session pair.
    --
    -- We intentionally DO NOT impose permanent uniqueness because
    -- the same browser/session may legitimately count another view
    -- after the rolling 30-minute window.
    perform pg_advisory_xact_lock(
        hashtextextended(
            target_video_id::text || ':' || viewer_session_id,
            0
        )
    );


    -- Count at most one view for the same browser session/video
    -- during a rolling 30-minute period.
    if not exists (
        select 1
        from public.evo_tv_video_views as views
        where views.video_id = target_video_id
          and views.session_id = viewer_session_id
          and views.viewed_at >= now() - interval '30 minutes'
    ) then

        insert into public.evo_tv_video_views (
            video_id,
            user_id,
            session_id
        )
        values (
            target_video_id,
            auth.uid(),
            viewer_session_id
        );

        did_insert := true;
    end if;


    -- Return both whether this request created a new view and the
    -- authoritative aggregate view count.
    return query
    select
        did_insert,
        count(*)::bigint
    from public.evo_tv_video_views as views
    where views.video_id = target_video_id;

end;
$_$;


ALTER FUNCTION "public"."record_evo_tv_video_view"("video_slug" "text", "viewer_session_id" "text") OWNER TO "postgres";

--
-- Name: recover_expired_captured_razorpay_payment("uuid", "text", "text", bigint, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."recover_expired_captured_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text") RETURNS TABLE("payment_id" "uuid", "order_id" "uuid", "payment_status" "public"."payment_status", "order_status" "public"."order_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_now timestamptz;
  v_expected_amount numeric;
begin
  if p_payment_id is null or p_provider_order_id !~ '^order_[A-Za-z0-9]{8,64}$'
    or p_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$' or p_provider_amount <= 0
    or p_provider_currency not in ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY') then
    raise exception using errcode = '22023', message = 'Canonical payment input is invalid.';
  end if;
  select payment.* into v_payment from public.payments payment
    where payment.id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Payment is unavailable.'; end if;
  select candidate.* into v_order from public.orders candidate
    where candidate.id = v_payment.order_id for update;
  v_expected_amount := case when p_provider_currency = 'JPY'
    then v_payment.amount else v_payment.amount * 100 end;
  if v_payment.provider is distinct from 'razorpay'
    or v_payment.provider_order_id is distinct from p_provider_order_id
    or v_payment.provider_payment_id is not null
    or v_payment.status is distinct from 'failed'
    or v_order.status is distinct from 'cancelled'
    or v_order.payment_status is distinct from 'failed'
    or v_order.checkout_expired_at is null
    or v_order.checkout_expires_at > pg_catalog.now()
    or v_payment.amount is distinct from v_order.total_amount
    or v_payment.currency::text is distinct from v_order.currency::text
    or v_payment.currency::text is distinct from p_provider_currency
    or v_expected_amount is distinct from p_provider_amount::numeric then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;
  if v_order.subtotal is null or v_order.subtotal <= 0
    or v_order.subtotal is distinct from v_order.total_amount
    or v_order.discount_amount is distinct from 0::numeric
    or v_order.shipping_amount is distinct from 0::numeric
    or v_order.tax_amount is distinct from 0::numeric
    or (select pg_catalog.count(*) from public.order_items counted
      where counted.order_id = v_order.id) <> 1 then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;
  select item.* into v_item from public.order_items item
  join public.evo_vault_products product on product.id = item.vault_product_id
  join public.evo_vault_books book on book.vault_product_id = product.id
  where item.order_id = v_order.id and item.source = 'evo_vault' and item.quantity = 1
    and item.vault_product_id is not null and item.store_variant_id is null
    and item.discount_amount = 0 and item.unit_price = v_order.subtotal
    and item.total_price = v_order.total_amount and product.kind = 'book'
    and product.product_mode = 'digital';
  if not found then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;
  v_now := pg_catalog.now();
  update public.payments set provider_payment_id = p_provider_payment_id,
    status = 'paid', paid_at = v_now where id = v_payment.id returning * into v_payment;
  update public.orders set status = 'confirmed', payment_status = 'paid',
    confirmed_at = v_now where id = v_order.id returning * into v_order;
  perform public.fulfill_confirmed_evo_vault_order(v_order.id);
  return query select v_payment.id, v_order.id, v_payment.status, v_order.status;
end;
$_$;


ALTER FUNCTION "public"."recover_expired_captured_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text") OWNER TO "postgres";

--
-- Name: replace_usd_currency_exchange_rates("text", timestamp with time zone, "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."replace_usd_currency_exchange_rates"("p_provider" "text", "p_fetched_at" timestamp with time zone, "p_rates" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."replace_usd_currency_exchange_rates"("p_provider" "text", "p_fetched_at" timestamp with time zone, "p_rates" "jsonb") OWNER TO "postgres";

--
-- Name: reserve_razorpay_payment("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."reserve_razorpay_payment"("p_order_id" "uuid") RETURNS TABLE("payment_id" "uuid", "order_id" "uuid", "amount" numeric, "currency" "text", "provider_order_id" "text", "checkout_expires_at" timestamp with time zone, "created" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_product public.evo_vault_products%rowtype;
  v_payment public.payments%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if p_order_id is null then
    raise exception using errcode = '22023', message = 'An order is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    (('x' || pg_catalog.substr(pg_catalog.md5(p_order_id::text), 1, 16))::bit(64)::bigint)
  );

  select candidate.* into v_order from public.orders as candidate
  where candidate.id = p_order_id and candidate.user_id = v_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order is unavailable.';
  end if;
  if v_order.checkout_expires_at is null then
    raise exception using errcode = 'P0001', message = 'Order has no checkout deadline.';
  end if;
  if v_order.checkout_expires_at <= pg_catalog.now()
    and v_order.status = 'pending' and v_order.payment_status = 'pending' then
    update public.orders set status = 'cancelled', payment_status = 'failed',
      checkout_expired_at = pg_catalog.now() where id = v_order.id;
    update public.payments set status = 'failed'
      where order_id = v_order.id and status = 'pending';
    return;
  end if;
  if v_order.status is distinct from 'pending' or v_order.payment_status is distinct from 'pending' then
    raise exception using errcode = 'P0001', message = 'Order is not pending.';
  end if;
  if v_order.subtotal is null or v_order.total_amount is null
    or v_order.subtotal <= 0 or v_order.total_amount <= 0
    or v_order.subtotal is distinct from v_order.total_amount
    or v_order.discount_amount is distinct from 0::numeric
    or v_order.shipping_amount is distinct from 0::numeric
    or v_order.tax_amount is distinct from 0::numeric then
    raise exception using errcode = 'P0001', message = 'Order totals are invalid.';
  end if;

  if (select pg_catalog.count(*) from public.order_items as counted
    where counted.order_id = p_order_id) <> 1 then
    raise exception using errcode = 'P0001', message = 'Order items are invalid.';
  end if;
  select item.* into v_item from public.order_items as item where item.order_id = p_order_id;
  if v_item.source is distinct from 'evo_vault'
    or v_item.quantity is distinct from 1
    or v_item.vault_product_id is null
    or v_item.store_variant_id is not null
    or v_item.discount_amount is distinct from 0::numeric
    or v_item.unit_price is distinct from v_order.subtotal
    or v_item.total_price is distinct from v_order.total_amount then
    raise exception using errcode = 'P0001', message = 'Order item is invalid.';
  end if;

  select product.* into v_product from public.evo_vault_products as product
  where product.id = v_item.vault_product_id;
  if not found or v_product.is_active is not true
    or v_product.kind is distinct from 'book'
    or v_product.product_mode is distinct from 'digital' then
    raise exception using errcode = 'P0001', message = 'Product is unavailable.';
  end if;
  if not public.evo_vault_book_has_deliverable_pdf(v_item.vault_product_id) then
    raise exception using errcode = 'P0001', message = 'Product deliverable is unavailable.';
  end if;
  if exists (
    select 1 from public.digital_access as access
    where access.user_id = v_user_id
      and access.vault_product_id = v_item.vault_product_id
      and access.status = 'active'
      and (access.expires_at is null or access.expires_at > pg_catalog.now())
  ) then
    raise exception using errcode = 'P0001', message = 'Product access already exists.';
  end if;

  select payment.* into v_payment from public.payments as payment
  where payment.order_id = p_order_id and payment.provider = 'razorpay';
  if found then
    if v_payment.status is distinct from 'pending'
      or v_payment.amount is distinct from v_order.total_amount
      or v_payment.currency::text is distinct from v_order.currency::text then
      raise exception using errcode = 'P0001', message = 'Existing payment requires reconciliation.';
    end if;
    return query select v_payment.id, v_payment.order_id, v_payment.amount,
      v_payment.currency::text, v_payment.provider_order_id,
      v_order.checkout_expires_at, false;
    return;
  end if;

  insert into public.payments (
    order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, metadata
  ) values (
    p_order_id, 'razorpay', null, null, v_order.total_amount, v_order.currency,
    'pending', pg_catalog.jsonb_build_object('local_order_id', p_order_id)
  ) returning * into v_payment;

  return query select v_payment.id, v_payment.order_id, v_payment.amount,
    v_payment.currency::text, v_payment.provider_order_id,
    v_order.checkout_expires_at, true;
end;
$$;


ALTER FUNCTION "public"."reserve_razorpay_payment"("p_order_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "reserve_razorpay_payment"("p_order_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."reserve_razorpay_payment"("p_order_id" "uuid") IS 'Validates an immutable customer digital-book order snapshot and reserves its single pending Razorpay payment relationship.';


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

--
-- Name: save_evo_vault_product("uuid", "jsonb", "jsonb", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."save_evo_vault_product"("p_product_id" "uuid", "p_parent" "jsonb", "p_subtype" "jsonb", "p_prices" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
declare
  saved_id uuid;
  product_kind public.vault_product_kind;
  product_is_active boolean;
  base_currency text;
  base_amount numeric(14,2);
  price_row jsonb;
  price_currency text;
  price_amount numeric(14,2);
  seen_currencies text[] := array[]::text[];
  currency_order constant text[] := array['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'JPY'];
begin
  if private.is_staff() is not true then
    raise exception using errcode = '42501', message = 'Staff authorization is required';
  end if;

  if p_parent is null or jsonb_typeof(p_parent) <> 'object'
     or p_subtype is null or jsonb_typeof(p_subtype) <> 'object' then
    raise exception using errcode = '22023', message = 'Product and subtype payloads must be objects';
  end if;
  if nullif(btrim(p_parent->>'name'), '') is null
     or nullif(btrim(p_parent->>'slug'), '') is null
     or nullif(btrim(p_parent->>'category_id'), '') is null
     or nullif(btrim(p_parent->>'product_mode'), '') is null
     or nullif(btrim(p_parent->>'price'), '') is null
     or nullif(btrim(p_parent->>'currency'), '') is null
     or jsonb_typeof(p_parent->'is_active') <> 'boolean'
     or jsonb_typeof(p_parent->'is_featured') <> 'boolean'
     or (p_parent->>'sort_order') !~ '^-?[0-9]+$' then
    raise exception using errcode = '22023', message = 'Product payload is incomplete or invalid';
  end if;

  product_kind := (p_parent->>'kind')::public.vault_product_kind;
  product_is_active := (p_parent->>'is_active')::boolean;
  perform (p_parent->>'category_id')::uuid;
  perform (p_parent->>'product_mode')::public.product_mode;
  perform (p_parent->>'sort_order')::integer;

  base_currency := upper(btrim(p_parent->>'currency'));
  if not (base_currency = any(currency_order)) then
    raise exception using errcode = '22023', message = 'Unsupported base currency';
  end if;
  if (p_parent->>'price') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
     or (base_currency = 'JPY' and (p_parent->>'price') !~ '^[0-9]+$') then
    raise exception using errcode = '22023', message = 'Invalid base price amount or currency precision';
  end if;
  base_amount := (p_parent->>'price')::numeric(14,2);
  if base_amount < 0 then
    raise exception using errcode = '22023', message = 'Base price cannot be negative';
  end if;

  if p_prices is not null then
    if jsonb_typeof(p_prices) <> 'array'
       or jsonb_array_length(p_prices) > cardinality(currency_order) - 1 then
      raise exception using errcode = '22023', message = 'Overrides must be an array of no more than nine prices';
    end if;

    for price_row in select value from jsonb_array_elements(p_prices)
    loop
      if jsonb_typeof(price_row) <> 'object'
         or jsonb_typeof(price_row->'is_active') <> 'boolean'
         or nullif(btrim(price_row->>'currency'), '') is null
         or nullif(btrim(price_row->>'amount'), '') is null then
        raise exception using errcode = '22023', message = 'Every override must contain currency, amount, and active status';
      end if;
      price_currency := upper(btrim(price_row->>'currency'));
      if not (price_currency = any(currency_order)) then
        raise exception using errcode = '22023', message = 'Unsupported override currency';
      end if;
      if price_currency = base_currency then
        raise exception using errcode = '22023', message = 'Override currency cannot equal the base currency';
      end if;
      if price_currency = any(seen_currencies) then
        raise exception using errcode = '22023', message = 'Duplicate override currency';
      end if;
      if (price_row->>'amount') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
         or (price_currency = 'JPY' and (price_row->>'amount') !~ '^[0-9]+$') then
        raise exception using errcode = '22023', message = 'Invalid override amount or currency precision';
      end if;
      price_amount := (price_row->>'amount')::numeric(14,2);
      if price_amount < 0 then
        raise exception using errcode = '22023', message = 'Override amount cannot be negative';
      end if;
      seen_currencies := array_append(seen_currencies, price_currency);
    end loop;
  end if;

  if p_product_id is not null then
    -- Existing books join the same per-book lock domain as every asset mutation.
    if product_kind = 'book' then
      perform 1 from public.evo_vault_books
      where vault_product_id = p_product_id
      for update;
    end if;

    perform 1 from public.evo_vault_products
    where id = p_product_id and kind = product_kind;
    if not found then
      raise exception using errcode = 'P0002', message = 'Vault product not found or kind mismatch';
    end if;
  end if;

  if p_product_id is null then
    insert into public.evo_vault_products (
      kind, category_id, name, slug, description, short_description, product_mode, price, currency,
      cover_image_url, is_active, is_featured, sort_order, seo_title, seo_description
    ) values (
      product_kind, (p_parent->>'category_id')::uuid, p_parent->>'name', p_parent->>'slug', p_parent->>'description', p_parent->>'short_description',
      (p_parent->>'product_mode')::public.product_mode, base_amount, base_currency,
      p_parent->>'cover_image_url', product_is_active, (p_parent->>'is_featured')::boolean,
      (p_parent->>'sort_order')::integer, p_parent->>'seo_title', p_parent->>'seo_description'
    ) returning id into saved_id;
  else
    update public.evo_vault_products set
      category_id = (p_parent->>'category_id')::uuid,
      name = p_parent->>'name', slug = p_parent->>'slug', description = p_parent->>'description',
      short_description = p_parent->>'short_description', product_mode = (p_parent->>'product_mode')::public.product_mode,
      price = base_amount, currency = base_currency, cover_image_url = p_parent->>'cover_image_url',
      is_active = product_is_active, is_featured = (p_parent->>'is_featured')::boolean,
      sort_order = (p_parent->>'sort_order')::integer, seo_title = p_parent->>'seo_title',
      seo_description = p_parent->>'seo_description', updated_at = now()
    where id = p_product_id and kind = product_kind
    returning id into saved_id;
  end if;

  if product_kind = 'book' then
    insert into public.evo_vault_books (vault_product_id, author_name, isbn, page_count, physical_weight_g, preview_text)
    values (saved_id, p_subtype->>'author_name', p_subtype->>'isbn', (p_subtype->>'page_count')::integer, (p_subtype->>'physical_weight_g')::integer, p_subtype->>'preview_text')
    on conflict (vault_product_id) do update set author_name = excluded.author_name, isbn = excluded.isbn,
      page_count = excluded.page_count, physical_weight_g = excluded.physical_weight_g,
      preview_text = excluded.preview_text, updated_at = now();
  else
    insert into public.evo_vault_courses (vault_product_id, instructor_id, subtitle, level, duration_minutes, certificate_available, preview_video_url)
    values (saved_id, (p_subtype->>'instructor_id')::uuid, p_subtype->>'subtitle', p_subtype->>'level',
      (p_subtype->>'duration_minutes')::integer, (p_subtype->>'certificate_available')::boolean, p_subtype->>'preview_video_url')
    on conflict (vault_product_id) do update set instructor_id = excluded.instructor_id, subtitle = excluded.subtitle,
      level = excluded.level, duration_minutes = excluded.duration_minutes, certificate_available = excluded.certificate_available,
      preview_video_url = excluded.preview_video_url, updated_at = now();
  end if;

  -- New active books are checked only after subtype creation; failure rolls back the parent insert.
  if product_kind = 'book' and product_is_active
     and (p_parent->>'product_mode')::public.product_mode in ('digital', 'hybrid')
     and not public.evo_vault_book_has_deliverable_pdf(saved_id) then
    raise exception using errcode = 'P0001', message = 'EVO_VAULT_PUBLICATION_READINESS_REQUIRED';
  end if;

  if p_prices is not null then
    insert into public.evo_vault_product_prices (vault_product_id, currency, amount, is_active)
    select saved_id, upper(btrim(value->>'currency')), (value->>'amount')::numeric(14,2), (value->>'is_active')::boolean
    from jsonb_array_elements(p_prices) submitted(value)
    on conflict (vault_product_id, currency) do update set
      amount = excluded.amount, is_active = excluded.is_active, updated_at = now();

    delete from public.evo_vault_product_prices
    where vault_product_id = saved_id
      and not (upper(btrim(currency::text)) = any(seen_currencies));
  end if;

  return saved_id;
end;
$_$;


ALTER FUNCTION "public"."save_evo_vault_product"("p_product_id" "uuid", "p_parent" "jsonb", "p_subtype" "jsonb", "p_prices" "jsonb") OWNER TO "postgres";

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "address_line1" "text" NOT NULL,
    "address_line2" "text",
    "landmark" "text",
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "postal_code" "text" NOT NULL,
    "country" "text" DEFAULT 'India'::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."addresses" OWNER TO "postgres";

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";

--
-- Name: challenge_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."challenge_participants" (
    "challenge_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "public"."challenge_participant_status" DEFAULT 'active'::"public"."challenge_participant_status" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "progress" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."challenge_participants" OWNER TO "postgres";

--
-- Name: challenges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "status" "public"."challenge_status" DEFAULT 'draft'::"public"."challenge_status" NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "challenges_date_check" CHECK ((("end_at" IS NULL) OR ("start_at" IS NULL) OR ("end_at" >= "start_at")))
);


ALTER TABLE "public"."challenges" OWNER TO "postgres";

--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text",
    "email" "text" NOT NULL,
    "subject" "text",
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_messages" OWNER TO "postgres";

--
-- Name: content_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."content_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "content_type" "public"."report_content_type" NOT NULL,
    "article_id" "uuid",
    "discussion_id" "uuid",
    "reply_id" "uuid",
    "evo_tv_video_id" "uuid",
    "reason" "public"."report_reason" NOT NULL,
    "details" "text",
    "status" "public"."report_status" DEFAULT 'pending'::"public"."report_status" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "resolution_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_reports_one_target" CHECK (("num_nonnulls"("article_id", "discussion_id", "reply_id", "evo_tv_video_id") = 1)),
    CONSTRAINT "content_reports_type_target" CHECK (((("content_type" = 'article'::"public"."report_content_type") AND ("article_id" IS NOT NULL) AND ("discussion_id" IS NULL) AND ("reply_id" IS NULL) AND ("evo_tv_video_id" IS NULL)) OR (("content_type" = 'discussion'::"public"."report_content_type") AND ("discussion_id" IS NOT NULL) AND ("article_id" IS NULL) AND ("reply_id" IS NULL) AND ("evo_tv_video_id" IS NULL)) OR (("content_type" = 'reply'::"public"."report_content_type") AND ("reply_id" IS NOT NULL) AND ("article_id" IS NULL) AND ("discussion_id" IS NULL) AND ("evo_tv_video_id" IS NULL)) OR (("content_type" = 'evo_tv_video'::"public"."report_content_type") AND ("evo_tv_video_id" IS NOT NULL) AND ("article_id" IS NULL) AND ("discussion_id" IS NULL) AND ("reply_id" IS NULL))))
);


ALTER TABLE "public"."content_reports" OWNER TO "postgres";

--
-- Name: coupon_redemptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."coupon_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coupon_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "discount_amount" numeric(14,2) NOT NULL,
    "redeemed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coupon_redemptions_amount_check" CHECK (("discount_amount" >= (0)::numeric))
);


ALTER TABLE "public"."coupon_redemptions" OWNER TO "postgres";

--
-- Name: coupons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "scope" "public"."coupon_scope" DEFAULT 'all'::"public"."coupon_scope" NOT NULL,
    "discount_type" "public"."discount_type" NOT NULL,
    "discount_value" numeric(14,2) NOT NULL,
    "min_order_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "max_discount_amount" numeric(14,2),
    "usage_limit" integer,
    "per_user_limit" integer,
    "used_count" integer DEFAULT 0 NOT NULL,
    "starts_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coupons_dates_check" CHECK ((("expires_at" IS NULL) OR ("starts_at" IS NULL) OR ("expires_at" > "starts_at"))),
    CONSTRAINT "coupons_discount_value_check" CHECK (("discount_value" > (0)::numeric)),
    CONSTRAINT "coupons_max_discount_check" CHECK ((("max_discount_amount" IS NULL) OR ("max_discount_amount" > (0)::numeric))),
    CONSTRAINT "coupons_min_order_check" CHECK (("min_order_amount" >= (0)::numeric)),
    CONSTRAINT "coupons_per_user_limit_check" CHECK ((("per_user_limit" IS NULL) OR ("per_user_limit" > 0))),
    CONSTRAINT "coupons_percentage_check" CHECK ((("discount_type" <> 'percentage'::"public"."discount_type") OR ("discount_value" <= (100)::numeric))),
    CONSTRAINT "coupons_usage_limit_check" CHECK ((("usage_limit" IS NULL) OR ("usage_limit" > 0))),
    CONSTRAINT "coupons_used_count_check" CHECK (("used_count" >= 0))
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";

--
-- Name: currency_exchange_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."currency_exchange_rates" (
    "base_currency" "text" NOT NULL,
    "quote_currency" "text" NOT NULL,
    "rate" numeric(30,18) NOT NULL,
    "provider" "text" NOT NULL,
    "fetched_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "currency_exchange_rates_base_supported_check" CHECK (("base_currency" = ANY (ARRAY['USD'::"text", 'EUR'::"text", 'GBP'::"text", 'INR'::"text", 'CAD'::"text", 'AUD'::"text", 'NZD'::"text", 'SGD'::"text", 'AED'::"text", 'JPY'::"text"]))),
    CONSTRAINT "currency_exchange_rates_distinct_pair_check" CHECK (("base_currency" <> "quote_currency")),
    CONSTRAINT "currency_exchange_rates_positive_rate_check" CHECK (("rate" > (0)::numeric)),
    CONSTRAINT "currency_exchange_rates_provider_check" CHECK (("btrim"("provider") <> ''::"text")),
    CONSTRAINT "currency_exchange_rates_quote_supported_check" CHECK (("quote_currency" = ANY (ARRAY['USD'::"text", 'EUR'::"text", 'GBP'::"text", 'INR'::"text", 'CAD'::"text", 'AUD'::"text", 'NZD'::"text", 'SGD'::"text", 'AED'::"text", 'JPY'::"text"])))
);


ALTER TABLE "public"."currency_exchange_rates" OWNER TO "postgres";

--
-- Name: digital_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."digital_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source" "public"."commerce_source" NOT NULL,
    "vault_product_id" "uuid",
    "store_variant_id" "uuid",
    "order_item_id" "uuid",
    "status" "public"."digital_access_status" DEFAULT 'active'::"public"."digital_access_status" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "digital_access_dates_check" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "granted_at"))),
    CONSTRAINT "digital_access_target_check" CHECK (((("source" = 'evo_vault'::"public"."commerce_source") AND ("vault_product_id" IS NOT NULL) AND ("store_variant_id" IS NULL)) OR (("source" = 'store'::"public"."commerce_source") AND ("store_variant_id" IS NOT NULL) AND ("vault_product_id" IS NULL))))
);


ALTER TABLE "public"."digital_access" OWNER TO "postgres";

--
-- Name: digital_download_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."digital_download_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "digital_access_id" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "downloaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "asset_id" "uuid"
);


ALTER TABLE "public"."digital_download_logs" OWNER TO "postgres";

--
-- Name: TABLE "digital_download_logs"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."digital_download_logs" IS 'Server-authoritative records of authorized digital delivery issuance. downloaded_at records when the server successfully authorized and issued a signed download URL, not proof that the client completed the download.';


--
-- Name: COLUMN "digital_download_logs"."asset_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."digital_download_logs"."asset_id" IS 'Downloaded book asset when known; nullable for legacy download flows and historical rows.';


--
-- Name: evo_circle_discussion_bookmarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_circle_discussion_bookmarks" (
    "user_id" "uuid" NOT NULL,
    "discussion_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_circle_discussion_bookmarks" OWNER TO "postgres";

--
-- Name: evo_circle_discussion_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_circle_discussion_likes" (
    "user_id" "uuid" NOT NULL,
    "discussion_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_circle_discussion_likes" OWNER TO "postgres";

--
-- Name: evo_circle_discussion_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_circle_discussion_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "discussion_id" "uuid" NOT NULL,
    "session_id" "text",
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."evo_circle_discussion_views" OWNER TO "postgres";

--
-- Name: evo_circle_discussions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_circle_discussions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "topic_id" "uuid",
    "author_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "body" "text" NOT NULL,
    "status" "public"."circle_discussion_status" DEFAULT 'published'::"public"."circle_discussion_status" NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    "locked" boolean DEFAULT false NOT NULL,
    "view_count" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_circle_view_count_check" CHECK (("view_count" >= 0))
);


ALTER TABLE "public"."evo_circle_discussions" OWNER TO "postgres";

--
-- Name: COLUMN "evo_circle_discussions"."status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."evo_circle_discussions"."status" IS 'V1 visibility/moderation state. Application uses published and removed; legacy enum value locked is retained for compatibility but should not be used for V1 locking.';


--
-- Name: COLUMN "evo_circle_discussions"."locked"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."evo_circle_discussions"."locked" IS 'V1 authoritative reply-lock flag. When true, the published discussion remains readable but new replies are not allowed.';


--
-- Name: evo_circle_replies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_circle_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discussion_id" "uuid" NOT NULL,
    "parent_reply_id" "uuid",
    "author_id" "uuid",
    "body" "text" NOT NULL,
    "status" "public"."circle_reply_status" DEFAULT 'published'::"public"."circle_reply_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_circle_replies" OWNER TO "postgres";

--
-- Name: evo_circle_reply_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_circle_reply_likes" (
    "user_id" "uuid" NOT NULL,
    "reply_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_circle_reply_likes" OWNER TO "postgres";

--
-- Name: evo_circle_topics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_circle_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_circle_topics" OWNER TO "postgres";

--
-- Name: evo_daily_article_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_daily_article_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "block_type" "text" NOT NULL,
    "position_after_paragraph" integer DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "heading" "text",
    "body" "text",
    "image_url" "text",
    "image_alt" "text",
    "caption" "text",
    "evo_tv_video_id" "uuid",
    "vault_product_id" "uuid",
    "store_product_id" "uuid",
    "external_url" "text",
    "button_label" "text",
    "affiliate_disclosure" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_daily_article_blocks_position_check" CHECK (("position_after_paragraph" >= 0)),
    CONSTRAINT "evo_daily_article_blocks_reference_check" CHECK (((("block_type" <> 'evo_tv'::"text") OR ("evo_tv_video_id" IS NOT NULL)) AND (("block_type" <> 'evo_vault'::"text") OR ("vault_product_id" IS NOT NULL)) AND (("block_type" <> 'evo_store'::"text") OR ("store_product_id" IS NOT NULL)) AND (("block_type" <> 'affiliate'::"text") OR ("external_url" IS NOT NULL)) AND (("block_type" <> 'image'::"text") OR ("image_url" IS NOT NULL)))),
    CONSTRAINT "evo_daily_article_blocks_sort_order_check" CHECK (("sort_order" >= 0)),
    CONSTRAINT "evo_daily_article_blocks_type_check" CHECK (("block_type" = ANY (ARRAY['section_heading'::"text", 'pull_quote'::"text", 'divider'::"text", 'image'::"text", 'callout'::"text", 'evo_tv'::"text", 'evo_vault'::"text", 'evo_store'::"text", 'affiliate'::"text", 'cta'::"text"])))
);


ALTER TABLE "public"."evo_daily_article_blocks" OWNER TO "postgres";

--
-- Name: evo_daily_article_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_daily_article_tags" (
    "article_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_daily_article_tags" OWNER TO "postgres";

--
-- Name: evo_daily_articles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_daily_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid",
    "category_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "excerpt" "text",
    "content" "text" NOT NULL,
    "featured_image_url" "text",
    "status" "public"."article_status" DEFAULT 'draft'::"public"."article_status" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "read_time_minutes" integer,
    "published_at" timestamp with time zone,
    "seo_title" "text",
    "seo_description" "text",
    "seo_keywords" "text"[],
    "canonical_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_daily_articles_published_check" CHECK (((("status" = 'published'::"public"."article_status") AND ("published_at" IS NOT NULL)) OR ("status" <> 'published'::"public"."article_status"))),
    CONSTRAINT "evo_daily_articles_read_time_check" CHECK ((("read_time_minutes" IS NULL) OR ("read_time_minutes" > 0)))
);


ALTER TABLE "public"."evo_daily_articles" OWNER TO "postgres";

--
-- Name: evo_daily_bookmarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_daily_bookmarks" (
    "user_id" "uuid" NOT NULL,
    "article_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_daily_bookmarks" OWNER TO "postgres";

--
-- Name: evo_daily_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_daily_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "seo_title" "text",
    "seo_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_daily_categories" OWNER TO "postgres";

--
-- Name: evo_daily_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_daily_likes" (
    "user_id" "uuid" NOT NULL,
    "article_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_daily_likes" OWNER TO "postgres";

--
-- Name: evo_daily_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_daily_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_daily_tags" OWNER TO "postgres";

--
-- Name: evo_daily_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_daily_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "article_id" "uuid" NOT NULL,
    "session_id" "text",
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."evo_daily_views" OWNER TO "postgres";

--
-- Name: evo_store_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_store_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_store_categories" OWNER TO "postgres";

--
-- Name: evo_store_inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_store_inventory" (
    "variant_id" "uuid" NOT NULL,
    "quantity_on_hand" integer DEFAULT 0 NOT NULL,
    "quantity_reserved" integer DEFAULT 0 NOT NULL,
    "low_stock_threshold" integer DEFAULT 5 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_on_hand_check" CHECK (("quantity_on_hand" >= 0)),
    CONSTRAINT "inventory_reserved_check" CHECK (("quantity_reserved" >= 0)),
    CONSTRAINT "inventory_reserved_limit_check" CHECK (("quantity_reserved" <= "quantity_on_hand"))
);


ALTER TABLE "public"."evo_store_inventory" OWNER TO "postgres";

--
-- Name: evo_store_inventory_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_store_inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "variant_id" "uuid" NOT NULL,
    "quantity_change" integer NOT NULL,
    "reason" "text" NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "inventory_movement_nonzero" CHECK (("quantity_change" <> 0))
);


ALTER TABLE "public"."evo_store_inventory_movements" OWNER TO "postgres";

--
-- Name: evo_store_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_store_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "short_description" "text",
    "product_mode" "public"."product_mode" DEFAULT 'physical'::"public"."product_mode" NOT NULL,
    "base_price" numeric(14,2) DEFAULT 0 NOT NULL,
    "currency" character(3) DEFAULT 'USD'::"bpchar" NOT NULL,
    "cover_image_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "seo_title" "text",
    "seo_description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_store_products_currency_supported_check" CHECK (("currency" = ANY (ARRAY['USD'::"bpchar", 'EUR'::"bpchar", 'GBP'::"bpchar", 'INR'::"bpchar", 'CAD'::"bpchar", 'AUD'::"bpchar", 'NZD'::"bpchar", 'SGD'::"bpchar", 'AED'::"bpchar", 'JPY'::"bpchar"]))),
    CONSTRAINT "evo_store_products_price_check" CHECK (("base_price" >= (0)::numeric))
);


ALTER TABLE "public"."evo_store_products" OWNER TO "postgres";

--
-- Name: evo_store_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_store_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "sku" "text" NOT NULL,
    "name" "text",
    "price" numeric(14,2) NOT NULL,
    "currency" character(3) DEFAULT 'USD'::"bpchar" NOT NULL,
    "digital_file_path" "text",
    "weight_g" integer,
    "attributes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_store_variants_currency_supported_check" CHECK (("currency" = ANY (ARRAY['USD'::"bpchar", 'EUR'::"bpchar", 'GBP'::"bpchar", 'INR'::"bpchar", 'CAD'::"bpchar", 'AUD'::"bpchar", 'NZD'::"bpchar", 'SGD'::"bpchar", 'AED'::"bpchar", 'JPY'::"bpchar"]))),
    CONSTRAINT "evo_store_variants_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "evo_store_variants_weight_check" CHECK ((("weight_g" IS NULL) OR ("weight_g" > 0)))
);


ALTER TABLE "public"."evo_store_variants" OWNER TO "postgres";

--
-- Name: evo_store_wishlist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_store_wishlist" (
    "user_id" "uuid" NOT NULL,
    "store_product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_store_wishlist" OWNER TO "postgres";

--
-- Name: evo_tv_series; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_tv_series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "thumbnail_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_tv_series" OWNER TO "postgres";

--
-- Name: evo_tv_video_bookmarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_tv_video_bookmarks" (
    "user_id" "uuid" NOT NULL,
    "video_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_tv_video_bookmarks" OWNER TO "postgres";

--
-- Name: evo_tv_video_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_tv_video_likes" (
    "user_id" "uuid" NOT NULL,
    "video_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_tv_video_likes" OWNER TO "postgres";

--
-- Name: evo_tv_video_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_tv_video_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "video_id" "uuid" NOT NULL,
    "session_id" "text",
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "watch_seconds" integer,
    "completed" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "evo_tv_watch_seconds_check" CHECK ((("watch_seconds" IS NULL) OR ("watch_seconds" >= 0)))
);


ALTER TABLE "public"."evo_tv_video_views" OWNER TO "postgres";

--
-- Name: evo_tv_videos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_tv_videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "series_id" "uuid",
    "category_id" "uuid",
    "youtube_video_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "thumbnail_url" "text",
    "duration_seconds" integer,
    "featured" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "published_at" timestamp with time zone,
    "seo_title" "text",
    "seo_description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_tv_duration_check" CHECK ((("duration_seconds" IS NULL) OR ("duration_seconds" >= 0)))
);


ALTER TABLE "public"."evo_tv_videos" OWNER TO "postgres";

--
-- Name: evo_vault_book_assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_book_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vault_product_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "mime_type" "text" DEFAULT 'application/pdf'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_vault_book_assets_file_path_check" CHECK (("btrim"("file_path") <> ''::"text")),
    CONSTRAINT "evo_vault_book_assets_file_size_check" CHECK (("file_size" > 0)),
    CONSTRAINT "evo_vault_book_assets_mime_type_check" CHECK (("mime_type" = 'application/pdf'::"text")),
    CONSTRAINT "evo_vault_book_assets_sort_order_check" CHECK (("sort_order" >= 0)),
    CONSTRAINT "evo_vault_book_assets_title_check" CHECK (("btrim"("title") <> ''::"text"))
);


ALTER TABLE "public"."evo_vault_book_assets" OWNER TO "postgres";

--
-- Name: TABLE "evo_vault_book_assets"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."evo_vault_book_assets" IS 'Canonical protected PDF assets belonging to Evo Vault book products.';


--
-- Name: COLUMN "evo_vault_book_assets"."file_path"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."evo_vault_book_assets"."file_path" IS 'Private evo-private object path; never expose directly to customers.';


--
-- Name: evo_vault_book_pdf_uploads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_book_pdf_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vault_product_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "expected_file_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "target_asset_id" "uuid"
);


ALTER TABLE "public"."evo_vault_book_pdf_uploads" OWNER TO "postgres";

--
-- Name: evo_vault_books; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vault_product_id" "uuid" NOT NULL,
    "digital_file_path" "text",
    "digital_file_size" bigint,
    "physical_weight_g" integer,
    "isbn" "text",
    "author_name" "text",
    "page_count" integer,
    "preview_text" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_vault_books_file_size_check" CHECK ((("digital_file_size" IS NULL) OR ("digital_file_size" >= 0))),
    CONSTRAINT "evo_vault_books_page_count_check" CHECK ((("page_count" IS NULL) OR ("page_count" > 0))),
    CONSTRAINT "evo_vault_books_weight_check" CHECK ((("physical_weight_g" IS NULL) OR ("physical_weight_g" > 0)))
);


ALTER TABLE "public"."evo_vault_books" OWNER TO "postgres";

--
-- Name: evo_vault_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_vault_categories" OWNER TO "postgres";

--
-- Name: evo_vault_certificates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "certificate_number" "text" NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "certificate_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."evo_vault_certificates" OWNER TO "postgres";

--
-- Name: evo_vault_course_lessons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_course_lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "content" "text",
    "video_url" "text",
    "duration_seconds" integer,
    "is_free_preview" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_vault_lessons_duration_check" CHECK ((("duration_seconds" IS NULL) OR ("duration_seconds" >= 0)))
);


ALTER TABLE "public"."evo_vault_course_lessons" OWNER TO "postgres";

--
-- Name: evo_vault_course_modules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_course_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_vault_course_modules" OWNER TO "postgres";

--
-- Name: evo_vault_courses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vault_product_id" "uuid" NOT NULL,
    "instructor_id" "uuid",
    "subtitle" "text",
    "level" "text",
    "duration_minutes" integer,
    "certificate_available" boolean DEFAULT false NOT NULL,
    "preview_video_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_vault_courses_duration_check" CHECK ((("duration_minutes" IS NULL) OR ("duration_minutes" >= 0)))
);


ALTER TABLE "public"."evo_vault_courses" OWNER TO "postgres";

--
-- Name: evo_vault_enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "order_item_id" "uuid",
    "enrolled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "progress_percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "evo_vault_enrollment_progress_check" CHECK ((("progress_percent" >= (0)::numeric) AND ("progress_percent" <= (100)::numeric)))
);


ALTER TABLE "public"."evo_vault_enrollments" OWNER TO "postgres";

--
-- Name: evo_vault_lesson_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_lesson_progress" (
    "user_id" "uuid" NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "progress_percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "last_position_seconds" integer DEFAULT 0 NOT NULL,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_vault_lesson_position_check" CHECK (("last_position_seconds" >= 0)),
    CONSTRAINT "evo_vault_lesson_progress_percent_check" CHECK ((("progress_percent" >= (0)::numeric) AND ("progress_percent" <= (100)::numeric)))
);


ALTER TABLE "public"."evo_vault_lesson_progress" OWNER TO "postgres";

--
-- Name: evo_vault_lesson_resources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_lesson_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "resource_type" "text",
    "file_path" "text",
    "external_url" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_vault_resource_target_check" CHECK (("num_nonnulls"("file_path", "external_url") = 1))
);


ALTER TABLE "public"."evo_vault_lesson_resources" OWNER TO "postgres";

--
-- Name: evo_vault_product_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_product_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vault_product_id" "uuid" NOT NULL,
    "storage_bucket" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "alt_text" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_vault_product_images_sort_order_check" CHECK (("sort_order" >= 0))
);


ALTER TABLE "public"."evo_vault_product_images" OWNER TO "postgres";

--
-- Name: evo_vault_product_prices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_product_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vault_product_id" "uuid" NOT NULL,
    "currency" "bpchar" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evo_vault_product_prices_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "evo_vault_product_prices_currency_supported_check" CHECK (("currency" = ANY (ARRAY['USD'::"bpchar", 'EUR'::"bpchar", 'GBP'::"bpchar", 'INR'::"bpchar", 'CAD'::"bpchar", 'AUD'::"bpchar", 'NZD'::"bpchar", 'SGD'::"bpchar", 'AED'::"bpchar", 'JPY'::"bpchar"])))
);


ALTER TABLE "public"."evo_vault_product_prices" OWNER TO "postgres";

--
-- Name: TABLE "evo_vault_product_prices"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."evo_vault_product_prices" IS 'Merchant-defined Evo Vault storefront prices, not live FX conversion results. Each product may have one configured amount per supported currency.';


--
-- Name: COLUMN "evo_vault_product_prices"."vault_product_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."evo_vault_product_prices"."vault_product_id" IS 'Evo Vault product whose legacy price and currency columns remain in use during the staged migration.';


--
-- Name: COLUMN "evo_vault_product_prices"."currency"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."evo_vault_product_prices"."currency" IS 'Supported storefront currency for this merchant-defined price.';


--
-- Name: COLUMN "evo_vault_product_prices"."amount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."evo_vault_product_prices"."amount" IS 'Merchant-defined selling amount; no exchange-rate conversion is applied.';


--
-- Name: evo_vault_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "public"."vault_product_kind" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "short_description" "text",
    "product_mode" "public"."product_mode" DEFAULT 'digital'::"public"."product_mode" NOT NULL,
    "price" numeric(14,2) DEFAULT 0 NOT NULL,
    "currency" character(3) DEFAULT 'USD'::"bpchar" NOT NULL,
    "cover_image_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "seo_title" "text",
    "seo_description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    CONSTRAINT "evo_vault_products_currency_supported_check" CHECK (("currency" = ANY (ARRAY['USD'::"bpchar", 'EUR'::"bpchar", 'GBP'::"bpchar", 'INR'::"bpchar", 'CAD'::"bpchar", 'AUD'::"bpchar", 'NZD'::"bpchar", 'SGD'::"bpchar", 'AED'::"bpchar", 'JPY'::"bpchar"]))),
    CONSTRAINT "evo_vault_products_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."evo_vault_products" OWNER TO "postgres";

--
-- Name: evo_vault_wishlist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evo_vault_wishlist" (
    "user_id" "uuid" NOT NULL,
    "vault_product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."evo_vault_wishlist" OWNER TO "postgres";

--
-- Name: featured_content; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."featured_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "section_key" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "article_id" "uuid",
    "evo_tv_video_id" "uuid",
    "vault_product_id" "uuid",
    "store_product_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "featured_content_dates_check" CHECK ((("ends_at" IS NULL) OR ("starts_at" IS NULL) OR ("ends_at" > "starts_at"))),
    CONSTRAINT "featured_content_one_target" CHECK (("num_nonnulls"("article_id", "evo_tv_video_id", "vault_product_id", "store_product_id") = 1))
);


ALTER TABLE "public"."featured_content" OWNER TO "postgres";

--
-- Name: homepage_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."homepage_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section_key" "text" NOT NULL,
    "title" "text",
    "subtitle" "text",
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."homepage_sections" OWNER TO "postgres";

--
-- Name: media_assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."media_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "storage_bucket" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text",
    "mime_type" "text",
    "file_size" bigint,
    "kind" "public"."media_kind" DEFAULT 'other'::"public"."media_kind" NOT NULL,
    "alt_text" "text",
    "is_public" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "media_assets_file_size_check" CHECK ((("file_size" IS NULL) OR ("file_size" >= 0)))
);


ALTER TABLE "public"."media_assets" OWNER TO "postgres";

--
-- Name: newsletter_subscribers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."newsletter_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "user_id" "uuid",
    "is_subscribed" boolean DEFAULT true NOT NULL,
    "subscribed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unsubscribed_at" timestamp with time zone,
    "source" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "newsletter_email_check" CHECK ((POSITION(('@'::"text") IN ("email")) > 1))
);


ALTER TABLE "public"."newsletter_subscribers" OWNER TO "postgres";

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "public"."notification_type" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "action_url" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "source" "public"."commerce_source" NOT NULL,
    "vault_product_id" "uuid",
    "store_variant_id" "uuid",
    "product_name_snapshot" "text" NOT NULL,
    "sku_snapshot" "text",
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(14,2) NOT NULL,
    "discount_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_price" numeric(14,2) NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_items_price_check" CHECK ((("unit_price" >= (0)::numeric) AND ("discount_amount" >= (0)::numeric) AND ("total_price" >= (0)::numeric) AND ("discount_amount" <= (("quantity")::numeric * "unit_price")) AND ("total_price" = ((("quantity")::numeric * "unit_price") - "discount_amount")))),
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "order_items_source_target_check" CHECK (((("source" = 'evo_vault'::"public"."commerce_source") AND ("vault_product_id" IS NOT NULL) AND ("store_variant_id" IS NULL)) OR (("source" = 'store'::"public"."commerce_source") AND ("store_variant_id" IS NOT NULL) AND ("vault_product_id" IS NULL))))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";

--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "old_status" "public"."order_status",
    "new_status" "public"."order_status" NOT NULL,
    "changed_by" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_status_history" OWNER TO "postgres";

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "coupon_id" "uuid",
    "status" "public"."order_status" DEFAULT 'pending'::"public"."order_status" NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "subtotal" numeric(14,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "shipping_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "currency" character(3) DEFAULT 'USD'::"bpchar" NOT NULL,
    "address_id" "uuid",
    "shipping_name" "text",
    "shipping_phone" "text",
    "shipping_address_line1" "text",
    "shipping_address_line2" "text",
    "shipping_landmark" "text",
    "shipping_city" "text",
    "shipping_state" "text",
    "shipping_postal_code" "text",
    "shipping_country" "text",
    "notes" "text",
    "placed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checkout_expires_at" timestamp with time zone,
    "checkout_expired_at" timestamp with time zone,
    CONSTRAINT "orders_amounts_nonnegative" CHECK ((("subtotal" >= (0)::numeric) AND ("discount_amount" >= (0)::numeric) AND ("shipping_amount" >= (0)::numeric) AND ("tax_amount" >= (0)::numeric) AND ("total_amount" >= (0)::numeric))),
    CONSTRAINT "orders_currency_supported_check" CHECK (("currency" = ANY (ARRAY['USD'::"bpchar", 'EUR'::"bpchar", 'GBP'::"bpchar", 'INR'::"bpchar", 'CAD'::"bpchar", 'AUD'::"bpchar", 'NZD'::"bpchar", 'SGD'::"bpchar", 'AED'::"bpchar", 'JPY'::"bpchar"]))),
    CONSTRAINT "orders_total_math" CHECK (("total_amount" = ((("subtotal" - "discount_amount") + "shipping_amount") + "tax_amount")))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";

--
-- Name: payment_refunds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."payment_refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "provider" "public"."payment_provider" NOT NULL,
    "provider_refund_id" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" NOT NULL,
    "status" "text" NOT NULL,
    "provider_created_at" timestamp with time zone,
    "processed_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_refunds_amount_positive_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payment_refunds_currency_check" CHECK (("currency" = ANY (ARRAY['USD'::"text", 'EUR'::"text", 'GBP'::"text", 'INR'::"text", 'CAD'::"text", 'AUD'::"text", 'NZD'::"text", 'SGD'::"text", 'AED'::"text", 'JPY'::"text"]))),
    CONSTRAINT "payment_refunds_provider_refund_id_check" CHECK (("provider_refund_id" ~ '^rfnd_[A-Za-z0-9]{8,64}$'::"text")),
    CONSTRAINT "payment_refunds_status_check" CHECK (("status" = 'processed'::"text"))
);


ALTER TABLE "public"."payment_refunds" OWNER TO "postgres";

--
-- Name: TABLE "payment_refunds"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."payment_refunds" IS 'Normalized immutable-identity ledger of successful provider refunds; not a refund initiation surface.';


--
-- Name: payment_webhook_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."payment_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "public"."payment_provider" NOT NULL,
    "provider_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "processing_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processing_status" "text" DEFAULT 'received'::"text" NOT NULL,
    "provider_order_id" "text",
    "provider_payment_id" "text",
    "payment_id" "uuid",
    "order_id" "uuid",
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "last_attempted_at" timestamp with time zone,
    "payload_sha256" "text",
    "safe_error_code" "text",
    "provider_refund_id" "text",
    CONSTRAINT "payment_webhook_events_attempt_count_check" CHECK (("attempt_count" >= 0)),
    CONSTRAINT "payment_webhook_events_event_type_check" CHECK (("btrim"("event_type") <> ''::"text")),
    CONSTRAINT "payment_webhook_events_payload_sha256_check" CHECK ((("payload_sha256" IS NULL) OR ("payload_sha256" ~ '^[a-f0-9]{64}$'::"text"))),
    CONSTRAINT "payment_webhook_events_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['received'::"text", 'processing'::"text", 'processed'::"text", 'failed'::"text", 'ignored'::"text"]))),
    CONSTRAINT "payment_webhook_events_provider_event_id_check" CHECK (("btrim"("provider_event_id") <> ''::"text")),
    CONSTRAINT "payment_webhook_events_provider_order_id_check" CHECK ((("provider_order_id" IS NULL) OR ("provider_order_id" ~ '^order_[A-Za-z0-9]{8,64}$'::"text"))),
    CONSTRAINT "payment_webhook_events_provider_payment_id_check" CHECK ((("provider_payment_id" IS NULL) OR ("provider_payment_id" ~ '^pay_[A-Za-z0-9]{8,64}$'::"text"))),
    CONSTRAINT "payment_webhook_events_provider_refund_id_check" CHECK ((("provider_refund_id" IS NULL) OR ("provider_refund_id" ~ '^rfnd_[A-Za-z0-9]{8,64}$'::"text"))),
    CONSTRAINT "payment_webhook_events_safe_error_code_check" CHECK ((("safe_error_code" IS NULL) OR ("safe_error_code" ~ '^[a-z][a-z0-9_]{0,63}$'::"text")))
);


ALTER TABLE "public"."payment_webhook_events" OWNER TO "postgres";

--
-- Name: TABLE "payment_webhook_events"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."payment_webhook_events" IS 'Durable payment-provider webhook event ledger.';


--
-- Name: COLUMN "payment_webhook_events"."payload"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."payment_webhook_events"."payload" IS 'Preserves the received provider event for reconciliation and debugging.';


--
-- Name: COLUMN "payment_webhook_events"."provider_refund_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."payment_webhook_events"."provider_refund_id" IS 'Operational correlation only; provider and provider_refund_id on payment_refunds are business idempotency authority.';


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "provider" "public"."payment_provider" DEFAULT 'razorpay'::"public"."payment_provider" NOT NULL,
    "provider_order_id" "text",
    "provider_payment_id" "text",
    "amount" numeric(14,2) NOT NULL,
    "currency" character(3) DEFAULT 'USD'::"bpchar" NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "method" "text",
    "failure_code" "text",
    "failure_message" "text",
    "paid_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "refunded_amount" numeric DEFAULT 0 NOT NULL,
    CONSTRAINT "payments_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payments_currency_supported_check" CHECK (("currency" = ANY (ARRAY['USD'::"bpchar", 'EUR'::"bpchar", 'GBP'::"bpchar", 'INR'::"bpchar", 'CAD'::"bpchar", 'AUD'::"bpchar", 'NZD'::"bpchar", 'SGD'::"bpchar", 'AED'::"bpchar", 'JPY'::"bpchar"]))),
    CONSTRAINT "payments_refunded_amount_nonnegative_check" CHECK (("refunded_amount" >= (0)::numeric)),
    CONSTRAINT "payments_refunded_amount_not_overpaid_check" CHECK (("refunded_amount" <= "amount"))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "display_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "status" "public"."user_status" DEFAULT 'active'::"public"."user_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_username_length" CHECK ((("username" IS NULL) OR (("char_length"("username") >= 3) AND ("char_length"("username") <= 50))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";

--
-- Name: seo_metadata; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."seo_metadata" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "description" "text",
    "keywords" "text"[],
    "canonical_url" "text",
    "og_title" "text",
    "og_description" "text",
    "og_image_url" "text",
    "robots" "text",
    "article_id" "uuid",
    "category_id" "uuid",
    "evo_tv_video_id" "uuid",
    "vault_product_id" "uuid",
    "store_product_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "seo_metadata_one_target" CHECK (("num_nonnulls"("article_id", "category_id", "evo_tv_video_id", "vault_product_id", "store_product_id") = 1))
);


ALTER TABLE "public"."seo_metadata" OWNER TO "postgres";

--
-- Name: shipments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."shipments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "status" "public"."shipment_status" DEFAULT 'pending'::"public"."shipment_status" NOT NULL,
    "carrier" "text",
    "tracking_number" "text",
    "tracking_url" "text",
    "shipped_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "returned_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shipments" OWNER TO "postgres";

--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."site_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT false NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_settings" OWNER TO "postgres";

--
-- Name: user_consents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "consent_type" "text" NOT NULL,
    "version" "text" NOT NULL,
    "granted" boolean NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."user_consents" OWNER TO "postgres";

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";

--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");


--
-- Name: challenge_participants challenge_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_pkey" PRIMARY KEY ("challenge_id", "user_id");


--
-- Name: challenges challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");


--
-- Name: challenges challenges_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_slug_key" UNIQUE ("slug");


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");


--
-- Name: content_reports content_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");


--
-- Name: coupon_redemptions coupon_redemptions_coupon_id_user_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coupon_redemptions"
    ADD CONSTRAINT "coupon_redemptions_coupon_id_user_id_order_id_key" UNIQUE ("coupon_id", "user_id", "order_id");


--
-- Name: coupon_redemptions coupon_redemptions_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coupon_redemptions"
    ADD CONSTRAINT "coupon_redemptions_order_id_key" UNIQUE ("order_id");


--
-- Name: coupon_redemptions coupon_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coupon_redemptions"
    ADD CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id");


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_code_key" UNIQUE ("code");


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");


--
-- Name: currency_exchange_rates currency_exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."currency_exchange_rates"
    ADD CONSTRAINT "currency_exchange_rates_pkey" PRIMARY KEY ("base_currency", "quote_currency");


--
-- Name: digital_access digital_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."digital_access"
    ADD CONSTRAINT "digital_access_pkey" PRIMARY KEY ("id");


--
-- Name: digital_download_logs digital_download_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."digital_download_logs"
    ADD CONSTRAINT "digital_download_logs_pkey" PRIMARY KEY ("id");


--
-- Name: evo_circle_discussion_bookmarks evo_circle_discussion_bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussion_bookmarks"
    ADD CONSTRAINT "evo_circle_discussion_bookmarks_pkey" PRIMARY KEY ("user_id", "discussion_id");


--
-- Name: evo_circle_discussion_likes evo_circle_discussion_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussion_likes"
    ADD CONSTRAINT "evo_circle_discussion_likes_pkey" PRIMARY KEY ("user_id", "discussion_id");


--
-- Name: evo_circle_discussion_views evo_circle_discussion_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussion_views"
    ADD CONSTRAINT "evo_circle_discussion_views_pkey" PRIMARY KEY ("id");


--
-- Name: evo_circle_discussions evo_circle_discussions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussions"
    ADD CONSTRAINT "evo_circle_discussions_pkey" PRIMARY KEY ("id");


--
-- Name: evo_circle_discussions evo_circle_discussions_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussions"
    ADD CONSTRAINT "evo_circle_discussions_slug_key" UNIQUE ("slug");


--
-- Name: evo_circle_replies evo_circle_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_replies"
    ADD CONSTRAINT "evo_circle_replies_pkey" PRIMARY KEY ("id");


--
-- Name: evo_circle_reply_likes evo_circle_reply_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_reply_likes"
    ADD CONSTRAINT "evo_circle_reply_likes_pkey" PRIMARY KEY ("user_id", "reply_id");


--
-- Name: evo_circle_topics evo_circle_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_topics"
    ADD CONSTRAINT "evo_circle_topics_pkey" PRIMARY KEY ("id");


--
-- Name: evo_circle_topics evo_circle_topics_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_topics"
    ADD CONSTRAINT "evo_circle_topics_slug_key" UNIQUE ("slug");


--
-- Name: evo_daily_article_blocks evo_daily_article_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_article_blocks"
    ADD CONSTRAINT "evo_daily_article_blocks_pkey" PRIMARY KEY ("id");


--
-- Name: evo_daily_article_tags evo_daily_article_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_article_tags"
    ADD CONSTRAINT "evo_daily_article_tags_pkey" PRIMARY KEY ("article_id", "tag_id");


--
-- Name: evo_daily_articles evo_daily_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_articles"
    ADD CONSTRAINT "evo_daily_articles_pkey" PRIMARY KEY ("id");


--
-- Name: evo_daily_articles evo_daily_articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_articles"
    ADD CONSTRAINT "evo_daily_articles_slug_key" UNIQUE ("slug");


--
-- Name: evo_daily_bookmarks evo_daily_bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_bookmarks"
    ADD CONSTRAINT "evo_daily_bookmarks_pkey" PRIMARY KEY ("user_id", "article_id");


--
-- Name: evo_daily_categories evo_daily_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_categories"
    ADD CONSTRAINT "evo_daily_categories_pkey" PRIMARY KEY ("id");


--
-- Name: evo_daily_categories evo_daily_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_categories"
    ADD CONSTRAINT "evo_daily_categories_slug_key" UNIQUE ("slug");


--
-- Name: evo_daily_likes evo_daily_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_likes"
    ADD CONSTRAINT "evo_daily_likes_pkey" PRIMARY KEY ("user_id", "article_id");


--
-- Name: evo_daily_tags evo_daily_tags_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_tags"
    ADD CONSTRAINT "evo_daily_tags_name_key" UNIQUE ("name");


--
-- Name: evo_daily_tags evo_daily_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_tags"
    ADD CONSTRAINT "evo_daily_tags_pkey" PRIMARY KEY ("id");


--
-- Name: evo_daily_tags evo_daily_tags_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_tags"
    ADD CONSTRAINT "evo_daily_tags_slug_key" UNIQUE ("slug");


--
-- Name: evo_daily_views evo_daily_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_views"
    ADD CONSTRAINT "evo_daily_views_pkey" PRIMARY KEY ("id");


--
-- Name: evo_store_categories evo_store_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_categories"
    ADD CONSTRAINT "evo_store_categories_pkey" PRIMARY KEY ("id");


--
-- Name: evo_store_categories evo_store_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_categories"
    ADD CONSTRAINT "evo_store_categories_slug_key" UNIQUE ("slug");


--
-- Name: evo_store_inventory_movements evo_store_inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_inventory_movements"
    ADD CONSTRAINT "evo_store_inventory_movements_pkey" PRIMARY KEY ("id");


--
-- Name: evo_store_inventory evo_store_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_inventory"
    ADD CONSTRAINT "evo_store_inventory_pkey" PRIMARY KEY ("variant_id");


--
-- Name: evo_store_products evo_store_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_products"
    ADD CONSTRAINT "evo_store_products_pkey" PRIMARY KEY ("id");


--
-- Name: evo_store_products evo_store_products_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_products"
    ADD CONSTRAINT "evo_store_products_slug_key" UNIQUE ("slug");


--
-- Name: evo_store_variants evo_store_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_variants"
    ADD CONSTRAINT "evo_store_variants_pkey" PRIMARY KEY ("id");


--
-- Name: evo_store_variants evo_store_variants_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_variants"
    ADD CONSTRAINT "evo_store_variants_sku_key" UNIQUE ("sku");


--
-- Name: evo_store_wishlist evo_store_wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_wishlist"
    ADD CONSTRAINT "evo_store_wishlist_pkey" PRIMARY KEY ("user_id", "store_product_id");


--
-- Name: evo_tv_series evo_tv_series_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_series"
    ADD CONSTRAINT "evo_tv_series_pkey" PRIMARY KEY ("id");


--
-- Name: evo_tv_series evo_tv_series_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_series"
    ADD CONSTRAINT "evo_tv_series_slug_key" UNIQUE ("slug");


--
-- Name: evo_tv_video_bookmarks evo_tv_video_bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_video_bookmarks"
    ADD CONSTRAINT "evo_tv_video_bookmarks_pkey" PRIMARY KEY ("user_id", "video_id");


--
-- Name: evo_tv_video_likes evo_tv_video_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_video_likes"
    ADD CONSTRAINT "evo_tv_video_likes_pkey" PRIMARY KEY ("user_id", "video_id");


--
-- Name: evo_tv_video_views evo_tv_video_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_video_views"
    ADD CONSTRAINT "evo_tv_video_views_pkey" PRIMARY KEY ("id");


--
-- Name: evo_tv_videos evo_tv_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_videos"
    ADD CONSTRAINT "evo_tv_videos_pkey" PRIMARY KEY ("id");


--
-- Name: evo_tv_videos evo_tv_videos_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_videos"
    ADD CONSTRAINT "evo_tv_videos_slug_key" UNIQUE ("slug");


--
-- Name: evo_tv_videos evo_tv_videos_youtube_video_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_videos"
    ADD CONSTRAINT "evo_tv_videos_youtube_video_id_key" UNIQUE ("youtube_video_id");


--
-- Name: evo_vault_book_assets evo_vault_book_assets_file_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_book_assets"
    ADD CONSTRAINT "evo_vault_book_assets_file_path_key" UNIQUE ("file_path");


--
-- Name: evo_vault_book_assets evo_vault_book_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_book_assets"
    ADD CONSTRAINT "evo_vault_book_assets_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_book_pdf_uploads evo_vault_book_pdf_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_book_pdf_uploads"
    ADD CONSTRAINT "evo_vault_book_pdf_uploads_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_book_pdf_uploads evo_vault_book_pdf_uploads_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_book_pdf_uploads"
    ADD CONSTRAINT "evo_vault_book_pdf_uploads_storage_path_key" UNIQUE ("storage_path");


--
-- Name: evo_vault_books evo_vault_books_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_books"
    ADD CONSTRAINT "evo_vault_books_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_books evo_vault_books_vault_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_books"
    ADD CONSTRAINT "evo_vault_books_vault_product_id_key" UNIQUE ("vault_product_id");


--
-- Name: evo_vault_categories evo_vault_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_categories"
    ADD CONSTRAINT "evo_vault_categories_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_categories evo_vault_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_categories"
    ADD CONSTRAINT "evo_vault_categories_slug_key" UNIQUE ("slug");


--
-- Name: evo_vault_certificates evo_vault_certificates_certificate_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_certificates"
    ADD CONSTRAINT "evo_vault_certificates_certificate_number_key" UNIQUE ("certificate_number");


--
-- Name: evo_vault_certificates evo_vault_certificates_enrollment_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_certificates"
    ADD CONSTRAINT "evo_vault_certificates_enrollment_id_key" UNIQUE ("enrollment_id");


--
-- Name: evo_vault_certificates evo_vault_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_certificates"
    ADD CONSTRAINT "evo_vault_certificates_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_course_lessons evo_vault_course_lessons_module_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_course_lessons"
    ADD CONSTRAINT "evo_vault_course_lessons_module_id_slug_key" UNIQUE ("module_id", "slug");


--
-- Name: evo_vault_course_lessons evo_vault_course_lessons_module_id_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_course_lessons"
    ADD CONSTRAINT "evo_vault_course_lessons_module_id_sort_order_key" UNIQUE ("module_id", "sort_order");


--
-- Name: evo_vault_course_lessons evo_vault_course_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_course_lessons"
    ADD CONSTRAINT "evo_vault_course_lessons_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_course_modules evo_vault_course_modules_course_id_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_course_modules"
    ADD CONSTRAINT "evo_vault_course_modules_course_id_sort_order_key" UNIQUE ("course_id", "sort_order");


--
-- Name: evo_vault_course_modules evo_vault_course_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_course_modules"
    ADD CONSTRAINT "evo_vault_course_modules_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_courses evo_vault_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_courses"
    ADD CONSTRAINT "evo_vault_courses_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_courses evo_vault_courses_vault_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_courses"
    ADD CONSTRAINT "evo_vault_courses_vault_product_id_key" UNIQUE ("vault_product_id");


--
-- Name: evo_vault_enrollments evo_vault_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_enrollments"
    ADD CONSTRAINT "evo_vault_enrollments_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_enrollments evo_vault_enrollments_user_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_enrollments"
    ADD CONSTRAINT "evo_vault_enrollments_user_id_course_id_key" UNIQUE ("user_id", "course_id");


--
-- Name: evo_vault_lesson_progress evo_vault_lesson_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_lesson_progress"
    ADD CONSTRAINT "evo_vault_lesson_progress_pkey" PRIMARY KEY ("user_id", "lesson_id");


--
-- Name: evo_vault_lesson_resources evo_vault_lesson_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_lesson_resources"
    ADD CONSTRAINT "evo_vault_lesson_resources_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_product_images evo_vault_product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_product_images"
    ADD CONSTRAINT "evo_vault_product_images_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_product_images evo_vault_product_images_storage_object_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_product_images"
    ADD CONSTRAINT "evo_vault_product_images_storage_object_key" UNIQUE ("storage_bucket", "storage_path");


--
-- Name: evo_vault_product_prices evo_vault_product_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_product_prices"
    ADD CONSTRAINT "evo_vault_product_prices_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_product_prices evo_vault_product_prices_product_currency_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_product_prices"
    ADD CONSTRAINT "evo_vault_product_prices_product_currency_key" UNIQUE ("vault_product_id", "currency");


--
-- Name: evo_vault_products evo_vault_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_products"
    ADD CONSTRAINT "evo_vault_products_pkey" PRIMARY KEY ("id");


--
-- Name: evo_vault_products evo_vault_products_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_products"
    ADD CONSTRAINT "evo_vault_products_slug_key" UNIQUE ("slug");


--
-- Name: evo_vault_wishlist evo_vault_wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_wishlist"
    ADD CONSTRAINT "evo_vault_wishlist_pkey" PRIMARY KEY ("user_id", "vault_product_id");


--
-- Name: featured_content featured_content_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."featured_content"
    ADD CONSTRAINT "featured_content_pkey" PRIMARY KEY ("id");


--
-- Name: homepage_sections homepage_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."homepage_sections"
    ADD CONSTRAINT "homepage_sections_pkey" PRIMARY KEY ("id");


--
-- Name: homepage_sections homepage_sections_section_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."homepage_sections"
    ADD CONSTRAINT "homepage_sections_section_key_key" UNIQUE ("section_key");


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id");


--
-- Name: media_assets media_assets_storage_bucket_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_storage_bucket_storage_path_key" UNIQUE ("storage_bucket", "storage_path");


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");


--
-- Name: payment_refunds payment_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_refunds"
    ADD CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id");


--
-- Name: payment_refunds payment_refunds_provider_refund_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_refunds"
    ADD CONSTRAINT "payment_refunds_provider_refund_key" UNIQUE ("provider", "provider_refund_id");


--
-- Name: payment_webhook_events payment_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_webhook_events"
    ADD CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id");


--
-- Name: payment_webhook_events payment_webhook_events_provider_event_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_webhook_events"
    ADD CONSTRAINT "payment_webhook_events_provider_event_key" UNIQUE ("provider", "provider_event_id");


--
-- Name: CONSTRAINT "payment_webhook_events_provider_event_key" ON "payment_webhook_events"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON CONSTRAINT "payment_webhook_events_provider_event_key" ON "public"."payment_webhook_events" IS 'Provider and provider event ID uniqueness provides webhook replay and idempotency protection.';


--
-- Name: payments payments_order_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_provider_key" UNIQUE ("order_id", "provider");


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");


--
-- Name: payments payments_provider_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_provider_order_id_key" UNIQUE ("provider_order_id");


--
-- Name: payments payments_provider_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_provider_payment_id_key" UNIQUE ("provider_payment_id");


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_code_key" UNIQUE ("code");


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_code_key" UNIQUE ("code");


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");


--
-- Name: seo_metadata seo_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."seo_metadata"
    ADD CONSTRAINT "seo_metadata_pkey" PRIMARY KEY ("id");


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_pkey" PRIMARY KEY ("id");


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id");


--
-- Name: site_settings site_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_setting_key_key" UNIQUE ("setting_key");


--
-- Name: user_consents user_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id");


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id");


--
-- Name: addresses_one_default_per_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "addresses_one_default_per_user" ON "public"."addresses" USING "btree" ("user_id") WHERE ("is_default" = true);


--
-- Name: addresses_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "addresses_user_idx" ON "public"."addresses" USING "btree" ("user_id");


--
-- Name: audit_logs_actor_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_actor_idx" ON "public"."audit_logs" USING "btree" ("actor_id", "created_at" DESC);


--
-- Name: audit_logs_entity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_entity_idx" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id", "created_at" DESC);


--
-- Name: audit_logs_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_time_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);


--
-- Name: content_reports_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "content_reports_status_idx" ON "public"."content_reports" USING "btree" ("status", "created_at" DESC);


--
-- Name: content_reports_unique_article_reporter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "content_reports_unique_article_reporter" ON "public"."content_reports" USING "btree" ("reporter_id", "article_id") WHERE (("content_type" = 'article'::"public"."report_content_type") AND ("article_id" IS NOT NULL));


--
-- Name: content_reports_unique_discussion_reporter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "content_reports_unique_discussion_reporter" ON "public"."content_reports" USING "btree" ("reporter_id", "discussion_id") WHERE (("content_type" = 'discussion'::"public"."report_content_type") AND ("discussion_id" IS NOT NULL));


--
-- Name: content_reports_unique_reply_reporter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "content_reports_unique_reply_reporter" ON "public"."content_reports" USING "btree" ("reporter_id", "reply_id") WHERE (("content_type" = 'reply'::"public"."report_content_type") AND ("reply_id" IS NOT NULL));


--
-- Name: content_reports_unique_tv_reporter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "content_reports_unique_tv_reporter" ON "public"."content_reports" USING "btree" ("reporter_id", "evo_tv_video_id") WHERE (("content_type" = 'evo_tv_video'::"public"."report_content_type") AND ("evo_tv_video_id" IS NOT NULL));


--
-- Name: coupons_code_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "coupons_code_lower_idx" ON "public"."coupons" USING "btree" ("lower"("code"));


--
-- Name: digital_access_store_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "digital_access_store_uidx" ON "public"."digital_access" USING "btree" ("user_id", "store_variant_id") WHERE ("store_variant_id" IS NOT NULL);


--
-- Name: digital_access_vault_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "digital_access_vault_uidx" ON "public"."digital_access" USING "btree" ("user_id", "vault_product_id") WHERE ("vault_product_id" IS NOT NULL);


--
-- Name: digital_download_logs_asset_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "digital_download_logs_asset_id_idx" ON "public"."digital_download_logs" USING "btree" ("asset_id") WHERE ("asset_id" IS NOT NULL);


--
-- Name: digital_download_logs_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "digital_download_logs_user_idx" ON "public"."digital_download_logs" USING "btree" ("user_id", "downloaded_at" DESC);


--
-- Name: evo_circle_discussion_views_discussion_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_circle_discussion_views_discussion_time_idx" ON "public"."evo_circle_discussion_views" USING "btree" ("discussion_id", "viewed_at" DESC);


--
-- Name: evo_circle_discussions_author_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_circle_discussions_author_idx" ON "public"."evo_circle_discussions" USING "btree" ("author_id");


--
-- Name: evo_circle_discussions_topic_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_circle_discussions_topic_idx" ON "public"."evo_circle_discussions" USING "btree" ("topic_id", "status", "created_at" DESC);


--
-- Name: evo_circle_replies_discussion_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_circle_replies_discussion_idx" ON "public"."evo_circle_replies" USING "btree" ("discussion_id", "created_at");


--
-- Name: evo_circle_replies_parent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_circle_replies_parent_idx" ON "public"."evo_circle_replies" USING "btree" ("parent_reply_id");


--
-- Name: evo_daily_article_blocks_article_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_daily_article_blocks_article_idx" ON "public"."evo_daily_article_blocks" USING "btree" ("article_id", "position_after_paragraph", "sort_order");


--
-- Name: evo_daily_article_blocks_store_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_daily_article_blocks_store_idx" ON "public"."evo_daily_article_blocks" USING "btree" ("store_product_id") WHERE ("store_product_id" IS NOT NULL);


--
-- Name: evo_daily_article_blocks_tv_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_daily_article_blocks_tv_idx" ON "public"."evo_daily_article_blocks" USING "btree" ("evo_tv_video_id") WHERE ("evo_tv_video_id" IS NOT NULL);


--
-- Name: evo_daily_article_blocks_vault_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_daily_article_blocks_vault_idx" ON "public"."evo_daily_article_blocks" USING "btree" ("vault_product_id") WHERE ("vault_product_id" IS NOT NULL);


--
-- Name: evo_daily_article_tags_tag_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_daily_article_tags_tag_idx" ON "public"."evo_daily_article_tags" USING "btree" ("tag_id");


--
-- Name: evo_daily_articles_author_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_daily_articles_author_idx" ON "public"."evo_daily_articles" USING "btree" ("author_id");


--
-- Name: evo_daily_articles_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_daily_articles_category_idx" ON "public"."evo_daily_articles" USING "btree" ("category_id");


--
-- Name: evo_daily_articles_featured_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_daily_articles_featured_idx" ON "public"."evo_daily_articles" USING "btree" ("is_featured") WHERE ("is_featured" = true);


--
-- Name: evo_daily_articles_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_daily_articles_status_idx" ON "public"."evo_daily_articles" USING "btree" ("status", "published_at" DESC);


--
-- Name: evo_daily_categories_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_daily_categories_active_idx" ON "public"."evo_daily_categories" USING "btree" ("is_active", "sort_order");


--
-- Name: evo_daily_views_article_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_daily_views_article_time_idx" ON "public"."evo_daily_views" USING "btree" ("article_id", "viewed_at" DESC);


--
-- Name: evo_store_variants_product_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_store_variants_product_idx" ON "public"."evo_store_variants" USING "btree" ("product_id", "sort_order");


--
-- Name: evo_tv_videos_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_tv_videos_active_idx" ON "public"."evo_tv_videos" USING "btree" ("active", "sort_order");


--
-- Name: evo_tv_videos_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_tv_videos_category_idx" ON "public"."evo_tv_videos" USING "btree" ("category_id");


--
-- Name: evo_tv_videos_published_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_tv_videos_published_idx" ON "public"."evo_tv_videos" USING "btree" ("published_at" DESC);


--
-- Name: evo_tv_videos_series_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_tv_videos_series_idx" ON "public"."evo_tv_videos" USING "btree" ("series_id");


--
-- Name: evo_tv_views_video_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_tv_views_video_time_idx" ON "public"."evo_tv_video_views" USING "btree" ("video_id", "viewed_at" DESC);


--
-- Name: evo_vault_book_assets_listing_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_vault_book_assets_listing_idx" ON "public"."evo_vault_book_assets" USING "btree" ("vault_product_id", "is_active", "sort_order", "created_at");


--
-- Name: evo_vault_book_assets_one_active_primary_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "evo_vault_book_assets_one_active_primary_idx" ON "public"."evo_vault_book_assets" USING "btree" ("vault_product_id") WHERE (("is_primary" = true) AND ("is_active" = true));


--
-- Name: evo_vault_enrollments_course_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_vault_enrollments_course_idx" ON "public"."evo_vault_enrollments" USING "btree" ("course_id");


--
-- Name: evo_vault_enrollments_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_vault_enrollments_user_idx" ON "public"."evo_vault_enrollments" USING "btree" ("user_id");


--
-- Name: evo_vault_product_images_product_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_vault_product_images_product_order_idx" ON "public"."evo_vault_product_images" USING "btree" ("vault_product_id", "sort_order", "created_at", "id");


--
-- Name: evo_vault_products_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_vault_products_active_idx" ON "public"."evo_vault_products" USING "btree" ("is_active", "sort_order");


--
-- Name: evo_vault_products_category_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_vault_products_category_id_idx" ON "public"."evo_vault_products" USING "btree" ("category_id");


--
-- Name: evo_vault_products_kind_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "evo_vault_products_kind_idx" ON "public"."evo_vault_products" USING "btree" ("kind");


--
-- Name: featured_content_section_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "featured_content_section_idx" ON "public"."featured_content" USING "btree" ("section_key", "is_active", "sort_order");


--
-- Name: media_assets_owner_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "media_assets_owner_idx" ON "public"."media_assets" USING "btree" ("owner_id");


--
-- Name: media_assets_public_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "media_assets_public_idx" ON "public"."media_assets" USING "btree" ("is_public") WHERE ("is_public" = true);


--
-- Name: newsletter_email_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "newsletter_email_lower_idx" ON "public"."newsletter_subscribers" USING "btree" ("lower"("email"));


--
-- Name: notifications_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "notifications_user_idx" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);


--
-- Name: order_items_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "order_items_order_idx" ON "public"."order_items" USING "btree" ("order_id");


--
-- Name: order_items_store_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "order_items_store_idx" ON "public"."order_items" USING "btree" ("store_variant_id");


--
-- Name: order_items_vault_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "order_items_vault_idx" ON "public"."order_items" USING "btree" ("vault_product_id");


--
-- Name: order_status_history_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "order_status_history_order_idx" ON "public"."order_status_history" USING "btree" ("order_id", "created_at" DESC);


--
-- Name: orders_expired_pending_checkout_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "orders_expired_pending_checkout_idx" ON "public"."orders" USING "btree" ("checkout_expires_at", "id") WHERE (("status" = 'pending'::"public"."order_status") AND ("payment_status" = 'pending'::"public"."payment_status") AND ("checkout_expires_at" IS NOT NULL));


--
-- Name: orders_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "orders_status_idx" ON "public"."orders" USING "btree" ("status", "created_at" DESC);


--
-- Name: orders_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "orders_user_idx" ON "public"."orders" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: payment_refunds_payment_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "payment_refunds_payment_id_idx" ON "public"."payment_refunds" USING "btree" ("payment_id");


--
-- Name: payment_webhook_events_retryable_received_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "payment_webhook_events_retryable_received_at_idx" ON "public"."payment_webhook_events" USING "btree" ("received_at") WHERE (("processing_status" = ANY (ARRAY['received'::"text", 'processing'::"text", 'failed'::"text"])) AND ("processed_at" IS NULL));


--
-- Name: payments_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "payments_order_idx" ON "public"."payments" USING "btree" ("order_id");


--
-- Name: payments_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "payments_status_idx" ON "public"."payments" USING "btree" ("status", "created_at" DESC);


--
-- Name: profiles_username_lower_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "profiles_username_lower_uidx" ON "public"."profiles" USING "btree" ("lower"("username")) WHERE ("username" IS NOT NULL);


--
-- Name: shipments_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "shipments_order_idx" ON "public"."shipments" USING "btree" ("order_id");


--
-- Name: user_roles_assigned_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "user_roles_assigned_by_idx" ON "public"."user_roles" USING "btree" ("assigned_by");


--
-- Name: user_roles_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "user_roles_role_idx" ON "public"."user_roles" USING "btree" ("role_id");


--
-- Name: addresses addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "addresses_updated_at" BEFORE UPDATE ON "public"."addresses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: challenges challenges_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "challenges_updated_at" BEFORE UPDATE ON "public"."challenges" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: contact_messages contact_messages_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "contact_messages_updated_at" BEFORE UPDATE ON "public"."contact_messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: content_reports content_reports_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "content_reports_updated_at" BEFORE UPDATE ON "public"."content_reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: coupons coupons_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "coupons_updated_at" BEFORE UPDATE ON "public"."coupons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: currency_exchange_rates currency_exchange_rates_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "currency_exchange_rates_set_updated_at" BEFORE UPDATE ON "public"."currency_exchange_rates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: digital_access digital_access_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "digital_access_updated_at" BEFORE UPDATE ON "public"."digital_access" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_vault_book_assets enforce_evo_vault_book_asset_publication_readiness; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "enforce_evo_vault_book_asset_publication_readiness" BEFORE DELETE OR UPDATE OF "is_active", "mime_type", "file_size" ON "public"."evo_vault_book_assets" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_evo_vault_book_asset_publication_readiness"();


--
-- Name: evo_vault_products enforce_evo_vault_product_publication_readiness; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "enforce_evo_vault_product_publication_readiness" BEFORE UPDATE OF "kind", "is_active", "product_mode" ON "public"."evo_vault_products" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_evo_vault_product_publication_readiness"();


--
-- Name: evo_circle_discussions evo_circle_discussions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_circle_discussions_updated_at" BEFORE UPDATE ON "public"."evo_circle_discussions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_circle_replies evo_circle_replies_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_circle_replies_updated_at" BEFORE UPDATE ON "public"."evo_circle_replies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_circle_replies evo_circle_reply_notification; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_circle_reply_notification" AFTER INSERT ON "public"."evo_circle_replies" FOR EACH ROW EXECUTE FUNCTION "private"."notify_evo_circle_reply"();


--
-- Name: evo_circle_topics evo_circle_topics_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_circle_topics_updated_at" BEFORE UPDATE ON "public"."evo_circle_topics" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_daily_article_blocks evo_daily_article_blocks_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_daily_article_blocks_updated_at" BEFORE UPDATE ON "public"."evo_daily_article_blocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_daily_articles evo_daily_articles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_daily_articles_updated_at" BEFORE UPDATE ON "public"."evo_daily_articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_daily_categories evo_daily_categories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_daily_categories_updated_at" BEFORE UPDATE ON "public"."evo_daily_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_store_categories evo_store_categories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_store_categories_updated_at" BEFORE UPDATE ON "public"."evo_store_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_store_inventory evo_store_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_store_inventory_updated_at" BEFORE UPDATE ON "public"."evo_store_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_store_products evo_store_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_store_products_updated_at" BEFORE UPDATE ON "public"."evo_store_products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_store_variants evo_store_variants_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_store_variants_updated_at" BEFORE UPDATE ON "public"."evo_store_variants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_tv_series evo_tv_series_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_tv_series_updated_at" BEFORE UPDATE ON "public"."evo_tv_series" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_tv_videos evo_tv_videos_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_tv_videos_updated_at" BEFORE UPDATE ON "public"."evo_tv_videos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_vault_books evo_vault_books_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_vault_books_updated_at" BEFORE UPDATE ON "public"."evo_vault_books" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_vault_course_lessons evo_vault_course_lessons_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_vault_course_lessons_updated_at" BEFORE UPDATE ON "public"."evo_vault_course_lessons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_vault_course_modules evo_vault_course_modules_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_vault_course_modules_updated_at" BEFORE UPDATE ON "public"."evo_vault_course_modules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_vault_courses evo_vault_courses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_vault_courses_updated_at" BEFORE UPDATE ON "public"."evo_vault_courses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_vault_lesson_progress evo_vault_lesson_progress_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_vault_lesson_progress_updated_at" BEFORE UPDATE ON "public"."evo_vault_lesson_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_vault_product_prices evo_vault_product_prices_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_vault_product_prices_updated_at" BEFORE UPDATE ON "public"."evo_vault_product_prices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_vault_products evo_vault_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "evo_vault_products_updated_at" BEFORE UPDATE ON "public"."evo_vault_products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: homepage_sections homepage_sections_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "homepage_sections_updated_at" BEFORE UPDATE ON "public"."homepage_sections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: media_assets media_assets_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "media_assets_updated_at" BEFORE UPDATE ON "public"."media_assets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: orders orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: payments payments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: profiles profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: seo_metadata seo_metadata_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "seo_metadata_updated_at" BEFORE UPDATE ON "public"."seo_metadata" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_vault_book_assets set_evo_vault_book_assets_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "set_evo_vault_book_assets_updated_at" BEFORE UPDATE ON "public"."evo_vault_book_assets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_vault_categories set_evo_vault_categories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "set_evo_vault_categories_updated_at" BEFORE UPDATE ON "public"."evo_vault_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: evo_vault_product_images set_evo_vault_product_images_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "set_evo_vault_product_images_updated_at" BEFORE UPDATE ON "public"."evo_vault_product_images" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: payment_refunds set_payment_refunds_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "set_payment_refunds_updated_at" BEFORE UPDATE ON "public"."payment_refunds" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: payment_webhook_events set_payment_webhook_events_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "set_payment_webhook_events_updated_at" BEFORE UPDATE ON "public"."payment_webhook_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: shipments shipments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "shipments_updated_at" BEFORE UPDATE ON "public"."shipments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: site_settings site_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "site_settings_updated_at" BEFORE UPDATE ON "public"."site_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: challenge_participants challenge_participants_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;


--
-- Name: challenge_participants challenge_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: challenges challenges_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: contact_messages contact_messages_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: contact_messages contact_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: content_reports content_reports_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."evo_daily_articles"("id") ON DELETE CASCADE;


--
-- Name: content_reports content_reports_discussion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."evo_circle_discussions"("id") ON DELETE CASCADE;


--
-- Name: content_reports content_reports_evo_tv_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_evo_tv_video_id_fkey" FOREIGN KEY ("evo_tv_video_id") REFERENCES "public"."evo_tv_videos"("id") ON DELETE CASCADE;


--
-- Name: content_reports content_reports_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "public"."evo_circle_replies"("id") ON DELETE CASCADE;


--
-- Name: content_reports content_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: content_reports content_reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: coupon_redemptions coupon_redemptions_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coupon_redemptions"
    ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE RESTRICT;


--
-- Name: coupon_redemptions coupon_redemptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coupon_redemptions"
    ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;


--
-- Name: coupon_redemptions coupon_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coupon_redemptions"
    ADD CONSTRAINT "coupon_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


--
-- Name: coupons coupons_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: digital_access digital_access_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."digital_access"
    ADD CONSTRAINT "digital_access_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE SET NULL;


--
-- Name: digital_access digital_access_store_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."digital_access"
    ADD CONSTRAINT "digital_access_store_variant_id_fkey" FOREIGN KEY ("store_variant_id") REFERENCES "public"."evo_store_variants"("id") ON DELETE CASCADE;


--
-- Name: digital_access digital_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."digital_access"
    ADD CONSTRAINT "digital_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: digital_access digital_access_vault_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."digital_access"
    ADD CONSTRAINT "digital_access_vault_product_id_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE CASCADE;


--
-- Name: digital_download_logs digital_download_logs_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."digital_download_logs"
    ADD CONSTRAINT "digital_download_logs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."evo_vault_book_assets"("id") ON DELETE SET NULL;


--
-- Name: digital_download_logs digital_download_logs_digital_access_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."digital_download_logs"
    ADD CONSTRAINT "digital_download_logs_digital_access_id_fkey" FOREIGN KEY ("digital_access_id") REFERENCES "public"."digital_access"("id") ON DELETE CASCADE;


--
-- Name: digital_download_logs digital_download_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."digital_download_logs"
    ADD CONSTRAINT "digital_download_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_circle_discussion_bookmarks evo_circle_discussion_bookmarks_discussion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussion_bookmarks"
    ADD CONSTRAINT "evo_circle_discussion_bookmarks_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."evo_circle_discussions"("id") ON DELETE CASCADE;


--
-- Name: evo_circle_discussion_bookmarks evo_circle_discussion_bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussion_bookmarks"
    ADD CONSTRAINT "evo_circle_discussion_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_circle_discussion_likes evo_circle_discussion_likes_discussion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussion_likes"
    ADD CONSTRAINT "evo_circle_discussion_likes_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."evo_circle_discussions"("id") ON DELETE CASCADE;


--
-- Name: evo_circle_discussion_likes evo_circle_discussion_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussion_likes"
    ADD CONSTRAINT "evo_circle_discussion_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_circle_discussion_views evo_circle_discussion_views_discussion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussion_views"
    ADD CONSTRAINT "evo_circle_discussion_views_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."evo_circle_discussions"("id") ON DELETE CASCADE;


--
-- Name: evo_circle_discussion_views evo_circle_discussion_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussion_views"
    ADD CONSTRAINT "evo_circle_discussion_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: evo_circle_discussions evo_circle_discussions_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussions"
    ADD CONSTRAINT "evo_circle_discussions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: evo_circle_discussions evo_circle_discussions_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_discussions"
    ADD CONSTRAINT "evo_circle_discussions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."evo_circle_topics"("id") ON DELETE SET NULL;


--
-- Name: evo_circle_replies evo_circle_replies_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_replies"
    ADD CONSTRAINT "evo_circle_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: evo_circle_replies evo_circle_replies_discussion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_replies"
    ADD CONSTRAINT "evo_circle_replies_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."evo_circle_discussions"("id") ON DELETE CASCADE;


--
-- Name: evo_circle_replies evo_circle_replies_parent_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_replies"
    ADD CONSTRAINT "evo_circle_replies_parent_reply_id_fkey" FOREIGN KEY ("parent_reply_id") REFERENCES "public"."evo_circle_replies"("id") ON DELETE CASCADE;


--
-- Name: evo_circle_reply_likes evo_circle_reply_likes_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_reply_likes"
    ADD CONSTRAINT "evo_circle_reply_likes_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "public"."evo_circle_replies"("id") ON DELETE CASCADE;


--
-- Name: evo_circle_reply_likes evo_circle_reply_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_circle_reply_likes"
    ADD CONSTRAINT "evo_circle_reply_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_daily_article_blocks evo_daily_article_blocks_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_article_blocks"
    ADD CONSTRAINT "evo_daily_article_blocks_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."evo_daily_articles"("id") ON DELETE CASCADE;


--
-- Name: evo_daily_article_blocks evo_daily_article_blocks_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_article_blocks"
    ADD CONSTRAINT "evo_daily_article_blocks_store_fkey" FOREIGN KEY ("store_product_id") REFERENCES "public"."evo_store_products"("id") ON DELETE SET NULL;


--
-- Name: evo_daily_article_blocks evo_daily_article_blocks_tv_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_article_blocks"
    ADD CONSTRAINT "evo_daily_article_blocks_tv_fkey" FOREIGN KEY ("evo_tv_video_id") REFERENCES "public"."evo_tv_videos"("id") ON DELETE SET NULL;


--
-- Name: evo_daily_article_blocks evo_daily_article_blocks_vault_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_article_blocks"
    ADD CONSTRAINT "evo_daily_article_blocks_vault_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE SET NULL;


--
-- Name: evo_daily_article_tags evo_daily_article_tags_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_article_tags"
    ADD CONSTRAINT "evo_daily_article_tags_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."evo_daily_articles"("id") ON DELETE CASCADE;


--
-- Name: evo_daily_article_tags evo_daily_article_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_article_tags"
    ADD CONSTRAINT "evo_daily_article_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."evo_daily_tags"("id") ON DELETE CASCADE;


--
-- Name: evo_daily_articles evo_daily_articles_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_articles"
    ADD CONSTRAINT "evo_daily_articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: evo_daily_articles evo_daily_articles_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_articles"
    ADD CONSTRAINT "evo_daily_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."evo_daily_categories"("id") ON DELETE SET NULL;


--
-- Name: evo_daily_bookmarks evo_daily_bookmarks_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_bookmarks"
    ADD CONSTRAINT "evo_daily_bookmarks_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."evo_daily_articles"("id") ON DELETE CASCADE;


--
-- Name: evo_daily_bookmarks evo_daily_bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_bookmarks"
    ADD CONSTRAINT "evo_daily_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_daily_likes evo_daily_likes_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_likes"
    ADD CONSTRAINT "evo_daily_likes_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."evo_daily_articles"("id") ON DELETE CASCADE;


--
-- Name: evo_daily_likes evo_daily_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_likes"
    ADD CONSTRAINT "evo_daily_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_daily_views evo_daily_views_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_views"
    ADD CONSTRAINT "evo_daily_views_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."evo_daily_articles"("id") ON DELETE CASCADE;


--
-- Name: evo_daily_views evo_daily_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_daily_views"
    ADD CONSTRAINT "evo_daily_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: evo_store_inventory_movements evo_store_inventory_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_inventory_movements"
    ADD CONSTRAINT "evo_store_inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: evo_store_inventory_movements evo_store_inventory_movements_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_inventory_movements"
    ADD CONSTRAINT "evo_store_inventory_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."evo_store_variants"("id") ON DELETE CASCADE;


--
-- Name: evo_store_inventory evo_store_inventory_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_inventory"
    ADD CONSTRAINT "evo_store_inventory_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."evo_store_variants"("id") ON DELETE CASCADE;


--
-- Name: evo_store_products evo_store_products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_products"
    ADD CONSTRAINT "evo_store_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."evo_store_categories"("id") ON DELETE SET NULL;


--
-- Name: evo_store_variants evo_store_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_variants"
    ADD CONSTRAINT "evo_store_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."evo_store_products"("id") ON DELETE CASCADE;


--
-- Name: evo_store_wishlist evo_store_wishlist_store_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_wishlist"
    ADD CONSTRAINT "evo_store_wishlist_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "public"."evo_store_products"("id") ON DELETE CASCADE;


--
-- Name: evo_store_wishlist evo_store_wishlist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_store_wishlist"
    ADD CONSTRAINT "evo_store_wishlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_tv_video_bookmarks evo_tv_video_bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_video_bookmarks"
    ADD CONSTRAINT "evo_tv_video_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_tv_video_bookmarks evo_tv_video_bookmarks_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_video_bookmarks"
    ADD CONSTRAINT "evo_tv_video_bookmarks_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."evo_tv_videos"("id") ON DELETE CASCADE;


--
-- Name: evo_tv_video_likes evo_tv_video_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_video_likes"
    ADD CONSTRAINT "evo_tv_video_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_tv_video_likes evo_tv_video_likes_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_video_likes"
    ADD CONSTRAINT "evo_tv_video_likes_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."evo_tv_videos"("id") ON DELETE CASCADE;


--
-- Name: evo_tv_video_views evo_tv_video_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_video_views"
    ADD CONSTRAINT "evo_tv_video_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: evo_tv_video_views evo_tv_video_views_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_video_views"
    ADD CONSTRAINT "evo_tv_video_views_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."evo_tv_videos"("id") ON DELETE CASCADE;


--
-- Name: evo_tv_videos evo_tv_videos_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_videos"
    ADD CONSTRAINT "evo_tv_videos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."evo_daily_categories"("id") ON DELETE SET NULL;


--
-- Name: evo_tv_videos evo_tv_videos_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_tv_videos"
    ADD CONSTRAINT "evo_tv_videos_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."evo_tv_series"("id") ON DELETE SET NULL;


--
-- Name: evo_vault_book_assets evo_vault_book_assets_book_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_book_assets"
    ADD CONSTRAINT "evo_vault_book_assets_book_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_books"("vault_product_id") ON DELETE CASCADE;


--
-- Name: evo_vault_book_assets evo_vault_book_assets_vault_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_book_assets"
    ADD CONSTRAINT "evo_vault_book_assets_vault_product_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_book_pdf_uploads evo_vault_book_pdf_uploads_target_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_book_pdf_uploads"
    ADD CONSTRAINT "evo_vault_book_pdf_uploads_target_asset_id_fkey" FOREIGN KEY ("target_asset_id") REFERENCES "public"."evo_vault_book_assets"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_book_pdf_uploads evo_vault_book_pdf_uploads_vault_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_book_pdf_uploads"
    ADD CONSTRAINT "evo_vault_book_pdf_uploads_vault_product_id_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_books evo_vault_books_vault_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_books"
    ADD CONSTRAINT "evo_vault_books_vault_product_id_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_certificates evo_vault_certificates_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_certificates"
    ADD CONSTRAINT "evo_vault_certificates_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."evo_vault_enrollments"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_course_lessons evo_vault_course_lessons_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_course_lessons"
    ADD CONSTRAINT "evo_vault_course_lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."evo_vault_course_modules"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_course_modules evo_vault_course_modules_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_course_modules"
    ADD CONSTRAINT "evo_vault_course_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."evo_vault_courses"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_courses evo_vault_courses_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_courses"
    ADD CONSTRAINT "evo_vault_courses_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: evo_vault_courses evo_vault_courses_vault_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_courses"
    ADD CONSTRAINT "evo_vault_courses_vault_product_id_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_enrollments evo_vault_enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_enrollments"
    ADD CONSTRAINT "evo_vault_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."evo_vault_courses"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_enrollments evo_vault_enrollments_order_item_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_enrollments"
    ADD CONSTRAINT "evo_vault_enrollments_order_item_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE SET NULL;


--
-- Name: evo_vault_enrollments evo_vault_enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_enrollments"
    ADD CONSTRAINT "evo_vault_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_lesson_progress evo_vault_lesson_progress_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_lesson_progress"
    ADD CONSTRAINT "evo_vault_lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."evo_vault_course_lessons"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_lesson_progress evo_vault_lesson_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_lesson_progress"
    ADD CONSTRAINT "evo_vault_lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_lesson_resources evo_vault_lesson_resources_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_lesson_resources"
    ADD CONSTRAINT "evo_vault_lesson_resources_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."evo_vault_course_lessons"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_product_images evo_vault_product_images_vault_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_product_images"
    ADD CONSTRAINT "evo_vault_product_images_vault_product_id_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_product_prices evo_vault_product_prices_vault_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_product_prices"
    ADD CONSTRAINT "evo_vault_product_prices_vault_product_id_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_products evo_vault_products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_products"
    ADD CONSTRAINT "evo_vault_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."evo_vault_categories"("id") ON DELETE RESTRICT;


--
-- Name: evo_vault_wishlist evo_vault_wishlist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_wishlist"
    ADD CONSTRAINT "evo_vault_wishlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_wishlist evo_vault_wishlist_vault_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evo_vault_wishlist"
    ADD CONSTRAINT "evo_vault_wishlist_vault_product_id_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE CASCADE;


--
-- Name: featured_content featured_content_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."featured_content"
    ADD CONSTRAINT "featured_content_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."evo_daily_articles"("id") ON DELETE CASCADE;


--
-- Name: featured_content featured_content_evo_tv_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."featured_content"
    ADD CONSTRAINT "featured_content_evo_tv_video_id_fkey" FOREIGN KEY ("evo_tv_video_id") REFERENCES "public"."evo_tv_videos"("id") ON DELETE CASCADE;


--
-- Name: featured_content featured_content_store_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."featured_content"
    ADD CONSTRAINT "featured_content_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "public"."evo_store_products"("id") ON DELETE CASCADE;


--
-- Name: featured_content featured_content_vault_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."featured_content"
    ADD CONSTRAINT "featured_content_vault_product_id_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE CASCADE;


--
-- Name: media_assets media_assets_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: newsletter_subscribers newsletter_subscribers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;


--
-- Name: order_items order_items_store_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_store_variant_id_fkey" FOREIGN KEY ("store_variant_id") REFERENCES "public"."evo_store_variants"("id") ON DELETE RESTRICT;


--
-- Name: order_items order_items_vault_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_vault_product_id_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE RESTRICT;


--
-- Name: order_status_history order_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;


--
-- Name: orders orders_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE SET NULL;


--
-- Name: orders orders_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


--
-- Name: payment_refunds payment_refunds_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_refunds"
    ADD CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");


--
-- Name: payment_webhook_events payment_webhook_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_webhook_events"
    ADD CONSTRAINT "payment_webhook_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");


--
-- Name: payment_webhook_events payment_webhook_events_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_webhook_events"
    ADD CONSTRAINT "payment_webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;


--
-- Name: seo_metadata seo_metadata_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."seo_metadata"
    ADD CONSTRAINT "seo_metadata_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."evo_daily_articles"("id") ON DELETE CASCADE;


--
-- Name: seo_metadata seo_metadata_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."seo_metadata"
    ADD CONSTRAINT "seo_metadata_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."evo_daily_categories"("id") ON DELETE CASCADE;


--
-- Name: seo_metadata seo_metadata_evo_tv_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."seo_metadata"
    ADD CONSTRAINT "seo_metadata_evo_tv_video_id_fkey" FOREIGN KEY ("evo_tv_video_id") REFERENCES "public"."evo_tv_videos"("id") ON DELETE CASCADE;


--
-- Name: seo_metadata seo_metadata_store_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."seo_metadata"
    ADD CONSTRAINT "seo_metadata_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "public"."evo_store_products"("id") ON DELETE CASCADE;


--
-- Name: seo_metadata seo_metadata_vault_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."seo_metadata"
    ADD CONSTRAINT "seo_metadata_vault_product_id_fkey" FOREIGN KEY ("vault_product_id") REFERENCES "public"."evo_vault_products"("id") ON DELETE CASCADE;


--
-- Name: shipments shipments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;


--
-- Name: site_settings site_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: user_consents user_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: evo_vault_categories Public can read active Vault categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read active Vault categories" ON "public"."evo_vault_categories" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));


--
-- Name: evo_vault_product_images Public can read active Vault product images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read active Vault product images" ON "public"."evo_vault_product_images" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."evo_vault_products" "p"
  WHERE (("p"."id" = "evo_vault_product_images"."vault_product_id") AND ("p"."is_active" = true)))));


--
-- Name: evo_daily_article_blocks Public can read published article blocks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read published article blocks" ON "public"."evo_daily_article_blocks" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."evo_daily_articles" "a"
  WHERE (("a"."id" = "evo_daily_article_blocks"."article_id") AND ("a"."status" = 'published'::"public"."article_status") AND ("a"."published_at" IS NOT NULL) AND ("a"."published_at" <= "now"()))))));


--
-- Name: evo_vault_product_images Staff can delete Vault product images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can delete Vault product images" ON "public"."evo_vault_product_images" FOR DELETE TO "authenticated" USING ("private"."is_staff"());


--
-- Name: evo_vault_product_images Staff can insert Vault product images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can insert Vault product images" ON "public"."evo_vault_product_images" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_staff"());


--
-- Name: payment_refunds Staff can inspect payment refunds; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can inspect payment refunds" ON "public"."payment_refunds" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: payment_webhook_events Staff can inspect payment webhook events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can inspect payment webhook events" ON "public"."payment_webhook_events" FOR SELECT TO "authenticated" USING ("private"."is_staff"());


--
-- Name: evo_vault_categories Staff can manage Vault categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can manage Vault categories" ON "public"."evo_vault_categories" TO "authenticated" USING ("private"."is_staff"()) WITH CHECK ("private"."is_staff"());


--
-- Name: evo_daily_article_blocks Staff can manage article blocks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can manage article blocks" ON "public"."evo_daily_article_blocks" TO "authenticated" USING ("private"."is_staff"()) WITH CHECK ("private"."is_staff"());


--
-- Name: evo_vault_product_images Staff can read all Vault product images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can read all Vault product images" ON "public"."evo_vault_product_images" FOR SELECT TO "authenticated" USING ("private"."is_staff"());


--
-- Name: evo_vault_product_images Staff can update Vault product images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can update Vault product images" ON "public"."evo_vault_product_images" FOR UPDATE TO "authenticated" USING ("private"."is_staff"()) WITH CHECK ("private"."is_staff"());


--
-- Name: evo_vault_book_pdf_uploads Staff manage Vault book PDF upload intents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff manage Vault book PDF upload intents" ON "public"."evo_vault_book_pdf_uploads" TO "authenticated" USING ("private"."is_staff"()) WITH CHECK ("private"."is_staff"());


--
-- Name: addresses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;

--
-- Name: addresses addresses_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "addresses_own_delete" ON "public"."addresses" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: addresses addresses_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "addresses_own_insert" ON "public"."addresses" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: addresses addresses_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "addresses_own_read" ON "public"."addresses" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: addresses addresses_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "addresses_own_update" ON "public"."addresses" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_staff_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "audit_logs_staff_read" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: challenge_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."challenge_participants" ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_participants challenge_participants_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "challenge_participants_own_delete" ON "public"."challenge_participants" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: challenge_participants challenge_participants_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "challenge_participants_own_insert" ON "public"."challenge_participants" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: challenge_participants challenge_participants_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "challenge_participants_own_read" ON "public"."challenge_participants" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: challenge_participants challenge_participants_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "challenge_participants_own_update" ON "public"."challenge_participants" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: challenges; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."challenges" ENABLE ROW LEVEL SECURITY;

--
-- Name: challenges challenges_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "challenges_public_read" ON "public"."challenges" FOR SELECT TO "authenticated", "anon" USING (("status" = ANY (ARRAY['active'::"public"."challenge_status", 'completed'::"public"."challenge_status"])));


--
-- Name: challenges challenges_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "challenges_staff_manage" ON "public"."challenges" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: user_consents consents_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "consents_own_insert" ON "public"."user_consents" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: user_consents consents_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "consents_own_read" ON "public"."user_consents" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: user_consents consents_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "consents_own_update" ON "public"."user_consents" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: contact_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_messages contact_public_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "contact_public_insert" ON "public"."contact_messages" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);


--
-- Name: contact_messages contact_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "contact_staff_manage" ON "public"."contact_messages" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: content_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."content_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: content_reports content_reports_member_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "content_reports_member_insert" ON "public"."content_reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: content_reports content_reports_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "content_reports_own_read" ON "public"."content_reports" FOR SELECT TO "authenticated" USING ((("reporter_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: content_reports content_reports_staff_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "content_reports_staff_update" ON "public"."content_reports" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: coupon_redemptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."coupon_redemptions" ENABLE ROW LEVEL SECURITY;

--
-- Name: coupon_redemptions coupon_redemptions_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coupon_redemptions_own_read" ON "public"."coupon_redemptions" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons coupons_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coupons_staff_manage" ON "public"."coupons" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: currency_exchange_rates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."currency_exchange_rates" ENABLE ROW LEVEL SECURITY;

--
-- Name: digital_access; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."digital_access" ENABLE ROW LEVEL SECURITY;

--
-- Name: digital_access digital_access_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "digital_access_own_read" ON "public"."digital_access" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: digital_access digital_access_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "digital_access_staff_manage" ON "public"."digital_access" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: digital_download_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."digital_download_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: digital_download_logs digital_downloads_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "digital_downloads_own_read" ON "public"."digital_download_logs" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: evo_circle_discussion_bookmarks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_circle_discussion_bookmarks" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_circle_discussion_bookmarks evo_circle_discussion_bookmarks_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_discussion_bookmarks_own_delete" ON "public"."evo_circle_discussion_bookmarks" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_circle_discussion_bookmarks evo_circle_discussion_bookmarks_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_discussion_bookmarks_own_insert" ON "public"."evo_circle_discussion_bookmarks" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_circle_discussion_bookmarks evo_circle_discussion_bookmarks_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_discussion_bookmarks_own_select" ON "public"."evo_circle_discussion_bookmarks" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_circle_discussion_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_circle_discussion_likes" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_circle_discussion_likes evo_circle_discussion_likes_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_discussion_likes_delete" ON "public"."evo_circle_discussion_likes" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_circle_discussion_likes evo_circle_discussion_likes_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_discussion_likes_insert" ON "public"."evo_circle_discussion_likes" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."evo_circle_discussions" "discussions"
  WHERE (("discussions"."id" = "evo_circle_discussion_likes"."discussion_id") AND ("discussions"."status" = 'published'::"public"."circle_discussion_status"))))));


--
-- Name: evo_circle_discussion_likes evo_circle_discussion_likes_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_discussion_likes_own" ON "public"."evo_circle_discussion_likes" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_circle_discussion_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_circle_discussion_views" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_circle_discussion_views evo_circle_discussion_views_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_discussion_views_insert" ON "public"."evo_circle_discussion_views" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("user_id" IS NULL) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));


--
-- Name: evo_circle_discussions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_circle_discussions" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_circle_discussions evo_circle_discussions_member_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_discussions_member_insert" ON "public"."evo_circle_discussions" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'published'::"public"."circle_discussion_status") AND ("pinned" = false) AND ("locked" = false) AND ("topic_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."evo_circle_topics" "topics"
  WHERE (("topics"."id" = "evo_circle_discussions"."topic_id") AND ("topics"."is_active" = true))))));


--
-- Name: evo_circle_discussions evo_circle_discussions_owner_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_discussions_owner_delete" ON "public"."evo_circle_discussions" FOR DELETE TO "authenticated" USING ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: evo_circle_discussions evo_circle_discussions_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_discussions_public_read" ON "public"."evo_circle_discussions" FOR SELECT TO "authenticated", "anon" USING (("status" = 'published'::"public"."circle_discussion_status"));


--
-- Name: evo_circle_discussions evo_circle_discussions_staff_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_discussions_staff_update" ON "public"."evo_circle_discussions" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_circle_replies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_circle_replies" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_circle_replies evo_circle_replies_member_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_replies_member_insert" ON "public"."evo_circle_replies" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'published'::"public"."circle_reply_status") AND (EXISTS ( SELECT 1
   FROM "public"."evo_circle_discussions" "d"
  WHERE (("d"."id" = "evo_circle_replies"."discussion_id") AND ("d"."status" = 'published'::"public"."circle_discussion_status") AND ("d"."locked" = false)))) AND (("parent_reply_id" IS NULL) OR "private"."is_valid_circle_parent_reply"("parent_reply_id", "discussion_id"))));


--
-- Name: evo_circle_replies evo_circle_replies_owner_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_replies_owner_delete" ON "public"."evo_circle_replies" FOR DELETE TO "authenticated" USING ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: evo_circle_replies evo_circle_replies_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_replies_public_read" ON "public"."evo_circle_replies" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'published'::"public"."circle_reply_status") AND (EXISTS ( SELECT 1
   FROM "public"."evo_circle_discussions" "discussions"
  WHERE (("discussions"."id" = "evo_circle_replies"."discussion_id") AND ("discussions"."status" = 'published'::"public"."circle_discussion_status"))))));


--
-- Name: evo_circle_replies evo_circle_replies_staff_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_replies_staff_read" ON "public"."evo_circle_replies" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_circle_replies evo_circle_replies_staff_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_replies_staff_update" ON "public"."evo_circle_replies" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_circle_reply_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_circle_reply_likes" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_circle_reply_likes evo_circle_reply_likes_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_reply_likes_delete" ON "public"."evo_circle_reply_likes" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_circle_reply_likes evo_circle_reply_likes_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_reply_likes_insert" ON "public"."evo_circle_reply_likes" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM ("public"."evo_circle_replies" "replies"
     JOIN "public"."evo_circle_discussions" "discussions" ON (("discussions"."id" = "replies"."discussion_id")))
  WHERE (("replies"."id" = "evo_circle_reply_likes"."reply_id") AND ("replies"."status" = 'published'::"public"."circle_reply_status") AND ("discussions"."status" = 'published'::"public"."circle_discussion_status"))))));


--
-- Name: evo_circle_reply_likes evo_circle_reply_likes_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_reply_likes_own" ON "public"."evo_circle_reply_likes" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_circle_topics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_circle_topics" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_circle_topics evo_circle_topics_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_topics_public_read" ON "public"."evo_circle_topics" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));


--
-- Name: evo_circle_topics evo_circle_topics_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_circle_topics_staff_manage" ON "public"."evo_circle_topics" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_daily_article_blocks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_daily_article_blocks" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_daily_article_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_daily_article_tags" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_daily_article_tags evo_daily_article_tags_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_article_tags_public_read" ON "public"."evo_daily_article_tags" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."evo_daily_articles" "a"
  WHERE (("a"."id" = "evo_daily_article_tags"."article_id") AND ("a"."status" = 'published'::"public"."article_status") AND ("a"."published_at" IS NOT NULL) AND ("a"."published_at" <= "now"())))));


--
-- Name: evo_daily_article_tags evo_daily_article_tags_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_article_tags_staff_manage" ON "public"."evo_daily_article_tags" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_daily_articles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_daily_articles" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_daily_articles evo_daily_articles_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_articles_public_read" ON "public"."evo_daily_articles" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'published'::"public"."article_status") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"())));


--
-- Name: evo_daily_articles evo_daily_articles_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_articles_staff_manage" ON "public"."evo_daily_articles" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_daily_bookmarks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_daily_bookmarks" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_daily_bookmarks evo_daily_bookmarks_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_bookmarks_own_delete" ON "public"."evo_daily_bookmarks" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_daily_bookmarks evo_daily_bookmarks_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_bookmarks_own_insert" ON "public"."evo_daily_bookmarks" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_daily_bookmarks evo_daily_bookmarks_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_bookmarks_own_select" ON "public"."evo_daily_bookmarks" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_daily_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_daily_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_daily_categories evo_daily_categories_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_categories_public_read" ON "public"."evo_daily_categories" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));


--
-- Name: evo_daily_categories evo_daily_categories_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_categories_staff_manage" ON "public"."evo_daily_categories" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_daily_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_daily_likes" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_daily_likes evo_daily_likes_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_likes_own_delete" ON "public"."evo_daily_likes" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_daily_likes evo_daily_likes_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_likes_own_insert" ON "public"."evo_daily_likes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_daily_likes evo_daily_likes_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_likes_own_select" ON "public"."evo_daily_likes" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_daily_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_daily_tags" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_daily_tags evo_daily_tags_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_tags_public_read" ON "public"."evo_daily_tags" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: evo_daily_tags evo_daily_tags_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_tags_staff_manage" ON "public"."evo_daily_tags" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_daily_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_daily_views" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_daily_views evo_daily_views_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_daily_views_insert" ON "public"."evo_daily_views" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("user_id" IS NULL) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));


--
-- Name: evo_store_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_store_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_store_categories evo_store_categories_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_store_categories_public_read" ON "public"."evo_store_categories" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));


--
-- Name: evo_store_categories evo_store_categories_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_store_categories_staff_manage" ON "public"."evo_store_categories" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_store_inventory; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_store_inventory" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_store_inventory_movements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_store_inventory_movements" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_store_inventory_movements evo_store_inventory_movements_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_store_inventory_movements_staff" ON "public"."evo_store_inventory_movements" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_store_inventory evo_store_inventory_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_store_inventory_staff" ON "public"."evo_store_inventory" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_store_products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_store_products" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_store_products evo_store_products_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_store_products_public_read" ON "public"."evo_store_products" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));


--
-- Name: evo_store_products evo_store_products_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_store_products_staff_manage" ON "public"."evo_store_products" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_store_variants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_store_variants" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_store_variants evo_store_variants_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_store_variants_public_read" ON "public"."evo_store_variants" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."evo_store_products" "p"
  WHERE (("p"."id" = "evo_store_variants"."product_id") AND ("p"."is_active" = true))))));


--
-- Name: evo_store_variants evo_store_variants_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_store_variants_staff_manage" ON "public"."evo_store_variants" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_store_wishlist; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_store_wishlist" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_store_wishlist evo_store_wishlist_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_store_wishlist_own" ON "public"."evo_store_wishlist" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_tv_video_bookmarks evo_tv_bookmarks_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_tv_bookmarks_own_delete" ON "public"."evo_tv_video_bookmarks" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_tv_video_bookmarks evo_tv_bookmarks_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_tv_bookmarks_own_insert" ON "public"."evo_tv_video_bookmarks" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_tv_video_bookmarks evo_tv_bookmarks_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_tv_bookmarks_own_select" ON "public"."evo_tv_video_bookmarks" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_tv_video_likes evo_tv_likes_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_tv_likes_own_delete" ON "public"."evo_tv_video_likes" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_tv_video_likes evo_tv_likes_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_tv_likes_own_insert" ON "public"."evo_tv_video_likes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_tv_video_likes evo_tv_likes_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_tv_likes_own_select" ON "public"."evo_tv_video_likes" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_tv_series; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_tv_series" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_tv_series evo_tv_series_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_tv_series_public_read" ON "public"."evo_tv_series" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));


--
-- Name: evo_tv_series evo_tv_series_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_tv_series_staff_manage" ON "public"."evo_tv_series" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_tv_video_bookmarks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_tv_video_bookmarks" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_tv_video_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_tv_video_likes" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_tv_video_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_tv_video_views" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_tv_videos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_tv_videos" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_tv_videos evo_tv_videos_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_tv_videos_public_read" ON "public"."evo_tv_videos" FOR SELECT TO "authenticated", "anon" USING ((("active" = true) AND (("published_at" IS NULL) OR ("published_at" <= "now"()))));


--
-- Name: evo_tv_videos evo_tv_videos_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_tv_videos_staff_manage" ON "public"."evo_tv_videos" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_tv_video_views evo_tv_views_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_tv_views_insert" ON "public"."evo_tv_video_views" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("user_id" IS NULL) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));


--
-- Name: evo_vault_book_assets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_book_assets" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_book_pdf_uploads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_book_pdf_uploads" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_books; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_books" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_books evo_vault_books_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_books_public_read" ON "public"."evo_vault_books" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."evo_vault_products" "p"
  WHERE (("p"."id" = "evo_vault_books"."vault_product_id") AND ("p"."is_active" = true)))));


--
-- Name: evo_vault_books evo_vault_books_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_books_staff_manage" ON "public"."evo_vault_books" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_vault_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_certificates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_certificates" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_certificates evo_vault_certificates_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_certificates_own_read" ON "public"."evo_vault_certificates" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."evo_vault_enrollments" "e"
  WHERE (("e"."id" = "evo_vault_certificates"."enrollment_id") AND ("e"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: evo_vault_certificates evo_vault_certificates_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_certificates_staff_manage" ON "public"."evo_vault_certificates" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_vault_course_lessons; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_course_lessons" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_course_modules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_course_modules" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_courses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_courses" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_courses evo_vault_courses_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_courses_public_read" ON "public"."evo_vault_courses" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."evo_vault_products" "p"
  WHERE (("p"."id" = "evo_vault_courses"."vault_product_id") AND ("p"."is_active" = true)))));


--
-- Name: evo_vault_courses evo_vault_courses_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_courses_staff_manage" ON "public"."evo_vault_courses" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_vault_enrollments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_enrollments" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_enrollments evo_vault_enrollments_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_enrollments_own_read" ON "public"."evo_vault_enrollments" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: evo_vault_enrollments evo_vault_enrollments_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_enrollments_staff_manage" ON "public"."evo_vault_enrollments" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_vault_lesson_progress; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_lesson_progress" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_lesson_resources; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_lesson_resources" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_course_lessons evo_vault_lessons_enrolled; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_lessons_enrolled" ON "public"."evo_vault_course_lessons" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."evo_vault_course_modules" "cm"
     JOIN "public"."evo_vault_courses" "c" ON (("c"."id" = "cm"."course_id")))
  WHERE (("cm"."id" = "evo_vault_course_lessons"."module_id") AND "private"."user_has_course_access"("c"."id")))));


--
-- Name: evo_vault_course_lessons evo_vault_lessons_preview; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_lessons_preview" ON "public"."evo_vault_course_lessons" FOR SELECT TO "authenticated", "anon" USING ((("is_free_preview" = true) AND (EXISTS ( SELECT 1
   FROM (("public"."evo_vault_course_modules" "cm"
     JOIN "public"."evo_vault_courses" "c" ON (("c"."id" = "cm"."course_id")))
     JOIN "public"."evo_vault_products" "p" ON (("p"."id" = "c"."vault_product_id")))
  WHERE (("cm"."id" = "evo_vault_course_lessons"."module_id") AND ("p"."is_active" = true))))));


--
-- Name: evo_vault_course_lessons evo_vault_lessons_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_lessons_staff_manage" ON "public"."evo_vault_course_lessons" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_vault_course_modules evo_vault_modules_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_modules_public_read" ON "public"."evo_vault_course_modules" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."evo_vault_courses" "c"
     JOIN "public"."evo_vault_products" "p" ON (("p"."id" = "c"."vault_product_id")))
  WHERE (("c"."id" = "evo_vault_course_modules"."course_id") AND ("p"."is_active" = true)))));


--
-- Name: evo_vault_course_modules evo_vault_modules_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_modules_staff_manage" ON "public"."evo_vault_course_modules" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_vault_product_images; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_product_images" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_product_prices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_product_prices" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_product_prices evo_vault_product_prices_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_product_prices_public_read" ON "public"."evo_vault_product_prices" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."evo_vault_products"
  WHERE (("evo_vault_products"."id" = "evo_vault_product_prices"."vault_product_id") AND ("evo_vault_products"."is_active" = true))))));


--
-- Name: evo_vault_product_prices evo_vault_product_prices_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_product_prices_staff_manage" ON "public"."evo_vault_product_prices" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_vault_products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_products" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_products evo_vault_products_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_products_public_read" ON "public"."evo_vault_products" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));


--
-- Name: evo_vault_products evo_vault_products_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_products_staff_manage" ON "public"."evo_vault_products" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_vault_lesson_progress evo_vault_progress_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_progress_own" ON "public"."evo_vault_lesson_progress" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: evo_vault_lesson_resources evo_vault_resources_enrolled; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_resources_enrolled" ON "public"."evo_vault_lesson_resources" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."evo_vault_course_lessons" "l"
     JOIN "public"."evo_vault_course_modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."evo_vault_courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "evo_vault_lesson_resources"."lesson_id") AND "private"."user_has_course_access"("c"."id")))));


--
-- Name: evo_vault_lesson_resources evo_vault_resources_preview; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_resources_preview" ON "public"."evo_vault_lesson_resources" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM ((("public"."evo_vault_course_lessons" "l"
     JOIN "public"."evo_vault_course_modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."evo_vault_courses" "c" ON (("c"."id" = "m"."course_id")))
     JOIN "public"."evo_vault_products" "p" ON (("p"."id" = "c"."vault_product_id")))
  WHERE (("l"."id" = "evo_vault_lesson_resources"."lesson_id") AND ("l"."is_free_preview" = true) AND ("p"."is_active" = true)))));


--
-- Name: evo_vault_lesson_resources evo_vault_resources_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_resources_staff_manage" ON "public"."evo_vault_lesson_resources" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: evo_vault_wishlist; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evo_vault_wishlist" ENABLE ROW LEVEL SECURITY;

--
-- Name: evo_vault_wishlist evo_vault_wishlist_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evo_vault_wishlist_own" ON "public"."evo_vault_wishlist" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: featured_content; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."featured_content" ENABLE ROW LEVEL SECURITY;

--
-- Name: featured_content featured_content_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "featured_content_public_read" ON "public"."featured_content" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (("starts_at" IS NULL) OR ("starts_at" <= "now"())) AND (("ends_at" IS NULL) OR ("ends_at" > "now"()))));


--
-- Name: featured_content featured_content_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "featured_content_staff_manage" ON "public"."featured_content" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: homepage_sections homepage_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "homepage_public_read" ON "public"."homepage_sections" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));


--
-- Name: homepage_sections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."homepage_sections" ENABLE ROW LEVEL SECURITY;

--
-- Name: homepage_sections homepage_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "homepage_staff_manage" ON "public"."homepage_sections" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: media_assets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."media_assets" ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscribers newsletter_public_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "newsletter_public_insert" ON "public"."newsletter_subscribers" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);


--
-- Name: newsletter_subscribers newsletter_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "newsletter_staff_manage" ON "public"."newsletter_subscribers" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: newsletter_subscribers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notifications_own_read" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: notifications notifications_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notifications_own_update" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: order_status_history order_history_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "order_history_own_read" ON "public"."order_status_history" FOR SELECT TO "authenticated" USING (("private"."user_owns_order"("order_id") OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "order_items_own_read" ON "public"."order_items" FOR SELECT TO "authenticated" USING (("private"."user_owns_order"("order_id") OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: order_status_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."order_status_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "orders_own_read" ON "public"."orders" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: orders orders_staff_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "orders_staff_update" ON "public"."orders" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: payment_refunds; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."payment_refunds" ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_webhook_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."payment_webhook_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;

--
-- Name: payments payments_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payments_own_read" ON "public"."payments" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "payments"."order_id") AND ("o"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: payments payments_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "payments_staff_manage" ON "public"."payments" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions permissions_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "permissions_admin_manage" ON "public"."permissions" TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));


--
-- Name: permissions permissions_authenticated_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "permissions_authenticated_read" ON "public"."permissions" FOR SELECT TO "authenticated" USING (true);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_public_read" ON "public"."profiles" FOR SELECT TO "authenticated", "anon" USING (("status" = 'active'::"public"."user_status"));


--
-- Name: profiles profiles_self_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_self_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: profiles profiles_self_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_self_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: profiles profiles_staff_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_staff_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions role_permissions_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "role_permissions_admin_manage" ON "public"."role_permissions" TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));


--
-- Name: role_permissions role_permissions_authenticated_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "role_permissions_authenticated_read" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (true);


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "roles_admin_manage" ON "public"."roles" TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));


--
-- Name: roles roles_authenticated_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "roles_authenticated_read" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);


--
-- Name: seo_metadata; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."seo_metadata" ENABLE ROW LEVEL SECURITY;

--
-- Name: seo_metadata seo_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "seo_public_read" ON "public"."seo_metadata" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: seo_metadata seo_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "seo_staff_manage" ON "public"."seo_metadata" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: shipments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."shipments" ENABLE ROW LEVEL SECURITY;

--
-- Name: shipments shipments_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "shipments_own_read" ON "public"."shipments" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "shipments"."order_id") AND ("o"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: shipments shipments_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "shipments_staff_manage" ON "public"."shipments" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings site_settings_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "site_settings_public_read" ON "public"."site_settings" FOR SELECT TO "authenticated", "anon" USING (("is_public" = true));


--
-- Name: site_settings site_settings_staff_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "site_settings_staff_manage" ON "public"."site_settings" TO "authenticated" USING (( SELECT "private"."is_staff"() AS "is_staff")) WITH CHECK (( SELECT "private"."is_staff"() AS "is_staff"));


--
-- Name: user_consents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_consents" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_roles_admin_manage" ON "public"."user_roles" TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));


--
-- Name: user_roles user_roles_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_roles_own_read" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_staff"() AS "is_staff")));


--
-- Name: SCHEMA "private"; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA "private" TO "authenticated";


--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "handle_new_user"(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION "private"."handle_new_user"() FROM PUBLIC;


--
-- Name: FUNCTION "is_admin"(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION "private"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_admin"() TO "authenticated";


--
-- Name: FUNCTION "is_staff"(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION "private"."is_staff"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_staff"() TO "authenticated";


--
-- Name: FUNCTION "is_valid_circle_parent_reply"("parent_uuid" "uuid", "discussion_uuid" "uuid"); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION "private"."is_valid_circle_parent_reply"("parent_uuid" "uuid", "discussion_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_valid_circle_parent_reply"("parent_uuid" "uuid", "discussion_uuid" "uuid") TO "authenticated";


--
-- Name: FUNCTION "notify_evo_circle_reply"(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION "private"."notify_evo_circle_reply"() FROM PUBLIC;


--
-- Name: FUNCTION "user_has_course_access"("p_course_id" "uuid"); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION "private"."user_has_course_access"("p_course_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."user_has_course_access"("p_course_id" "uuid") TO "authenticated";


--
-- Name: FUNCTION "user_owns_order"("p_order_id" "uuid"); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION "private"."user_owns_order"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."user_owns_order"("p_order_id" "uuid") TO "authenticated";


--
-- Name: FUNCTION "attach_razorpay_order"("p_payment_id" "uuid", "p_provider_order_id" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."attach_razorpay_order"("p_payment_id" "uuid", "p_provider_order_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."attach_razorpay_order"("p_payment_id" "uuid", "p_provider_order_id" "text") TO "authenticated";


--
-- Name: FUNCTION "begin_razorpay_refund_webhook_event"("p_provider_event_id" "text", "p_payload" "jsonb", "p_payload_sha256" "text", "p_provider_payment_id" "text", "p_provider_refund_id" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."begin_razorpay_refund_webhook_event"("p_provider_event_id" "text", "p_payload" "jsonb", "p_payload_sha256" "text", "p_provider_payment_id" "text", "p_provider_refund_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."begin_razorpay_refund_webhook_event"("p_provider_event_id" "text", "p_payload" "jsonb", "p_payload_sha256" "text", "p_provider_payment_id" "text", "p_provider_refund_id" "text") TO "service_role";


--
-- Name: FUNCTION "begin_razorpay_webhook_event"("p_provider_event_id" "text", "p_event_type" "text", "p_payload" "jsonb", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."begin_razorpay_webhook_event"("p_provider_event_id" "text", "p_event_type" "text", "p_payload" "jsonb", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."begin_razorpay_webhook_event"("p_provider_event_id" "text", "p_event_type" "text", "p_payload" "jsonb", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text") TO "service_role";


--
-- Name: FUNCTION "confirm_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."confirm_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text") TO "authenticated";


--
-- Name: FUNCTION "create_pending_evo_vault_order"("p_vault_product_id" "uuid", "p_requested_currency" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."create_pending_evo_vault_order"("p_vault_product_id" "uuid", "p_requested_currency" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_pending_evo_vault_order"("p_vault_product_id" "uuid", "p_requested_currency" "text") TO "authenticated";


--
-- Name: FUNCTION "enforce_evo_vault_book_asset_publication_readiness"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."enforce_evo_vault_book_asset_publication_readiness"() FROM PUBLIC;


--
-- Name: FUNCTION "enforce_evo_vault_product_publication_readiness"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."enforce_evo_vault_product_publication_readiness"() FROM PUBLIC;


--
-- Name: FUNCTION "evo_vault_book_has_deliverable_pdf"("p_product_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."evo_vault_book_has_deliverable_pdf"("p_product_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."evo_vault_book_has_deliverable_pdf"("p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."evo_vault_book_has_deliverable_pdf"("p_product_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "expire_pending_evo_vault_checkouts"("p_batch_size" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."expire_pending_evo_vault_checkouts"("p_batch_size" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_pending_evo_vault_checkouts"("p_batch_size" integer) TO "service_role";


--
-- Name: FUNCTION "fail_razorpay_webhook_event"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_safe_error_code" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."fail_razorpay_webhook_event"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_safe_error_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fail_razorpay_webhook_event"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_safe_error_code" "text") TO "service_role";


--
-- Name: FUNCTION "finalize_evo_vault_book_asset_upload"("p_product_id" "uuid", "p_asset_id" "uuid", "p_title" "text", "p_file_path" "text", "p_file_size" bigint, "p_expected_file_path" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."finalize_evo_vault_book_asset_upload"("p_product_id" "uuid", "p_asset_id" "uuid", "p_title" "text", "p_file_path" "text", "p_file_size" bigint, "p_expected_file_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_evo_vault_book_asset_upload"("p_product_id" "uuid", "p_asset_id" "uuid", "p_title" "text", "p_file_path" "text", "p_file_size" bigint, "p_expected_file_path" "text") TO "service_role";


--
-- Name: FUNCTION "fulfill_confirmed_evo_vault_order"("p_order_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."fulfill_confirmed_evo_vault_order"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fulfill_confirmed_evo_vault_order"("p_order_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "get_evo_circle_discussion_like_count"("discussion_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_evo_circle_discussion_like_count"("discussion_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_evo_circle_discussion_like_count"("discussion_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_evo_circle_discussion_like_count"("discussion_uuid" "uuid") TO "authenticated";


--
-- Name: FUNCTION "get_evo_circle_discussion_view_count"("discussion_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_evo_circle_discussion_view_count"("discussion_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_evo_circle_discussion_view_count"("discussion_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_evo_circle_discussion_view_count"("discussion_uuid" "uuid") TO "authenticated";


--
-- Name: FUNCTION "get_evo_circle_reply_like_count"("reply_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_evo_circle_reply_like_count"("reply_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_evo_circle_reply_like_count"("reply_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_evo_circle_reply_like_count"("reply_uuid" "uuid") TO "authenticated";


--
-- Name: FUNCTION "get_evo_daily_article_like_count"("article_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_evo_daily_article_like_count"("article_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_evo_daily_article_like_count"("article_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_evo_daily_article_like_count"("article_uuid" "uuid") TO "authenticated";


--
-- Name: FUNCTION "get_evo_daily_article_view_count"("article_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_evo_daily_article_view_count"("article_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_evo_daily_article_view_count"("article_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_evo_daily_article_view_count"("article_uuid" "uuid") TO "authenticated";


--
-- Name: FUNCTION "get_evo_tv_video_like_count"("video_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_evo_tv_video_like_count"("video_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_evo_tv_video_like_count"("video_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_evo_tv_video_like_count"("video_uuid" "uuid") TO "authenticated";


--
-- Name: FUNCTION "get_evo_tv_video_view_count"("video_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_evo_tv_video_view_count"("video_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_evo_tv_video_view_count"("video_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_evo_tv_video_view_count"("video_uuid" "uuid") TO "authenticated";


--
-- Name: FUNCTION "ignore_razorpay_webhook_event"("p_provider_event_id" "text", "p_event_type" "text", "p_payload" "jsonb", "p_payload_sha256" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."ignore_razorpay_webhook_event"("p_provider_event_id" "text", "p_event_type" "text", "p_payload" "jsonb", "p_payload_sha256" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ignore_razorpay_webhook_event"("p_provider_event_id" "text", "p_event_type" "text", "p_payload" "jsonb", "p_payload_sha256" "text") TO "service_role";


--
-- Name: FUNCTION "mutate_evo_vault_book_asset"("p_product_id" "uuid", "p_asset_id" "uuid", "p_operation" "text", "p_title" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."mutate_evo_vault_book_asset"("p_product_id" "uuid", "p_asset_id" "uuid", "p_operation" "text", "p_title" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mutate_evo_vault_book_asset"("p_product_id" "uuid", "p_asset_id" "uuid", "p_operation" "text", "p_title" "text") TO "service_role";


--
-- Name: FUNCTION "normalize_evo_vault_book_assets"("p_product_id" "uuid", "p_preferred_primary_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."normalize_evo_vault_book_assets"("p_product_id" "uuid", "p_preferred_primary_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_evo_vault_book_assets"("p_product_id" "uuid", "p_preferred_primary_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "reconcile_captured_razorpay_payment"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."reconcile_captured_razorpay_payment"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reconcile_captured_razorpay_payment"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text") TO "service_role";


--
-- Name: FUNCTION "reconcile_processed_razorpay_refund"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_refund_id" "text", "p_provider_payment_id" "text", "p_refund_amount" bigint, "p_provider_currency" "text", "p_provider_created_at" timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."reconcile_processed_razorpay_refund"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_refund_id" "text", "p_provider_payment_id" "text", "p_refund_amount" bigint, "p_provider_currency" "text", "p_provider_created_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reconcile_processed_razorpay_refund"("p_provider_event_id" "text", "p_payload_sha256" "text", "p_provider_refund_id" "text", "p_provider_payment_id" "text", "p_refund_amount" bigint, "p_provider_currency" "text", "p_provider_created_at" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "record_evo_circle_discussion_view"("discussion_slug" "text", "viewer_session_id" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."record_evo_circle_discussion_view"("discussion_slug" "text", "viewer_session_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_evo_circle_discussion_view"("discussion_slug" "text", "viewer_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_evo_circle_discussion_view"("discussion_slug" "text", "viewer_session_id" "text") TO "authenticated";


--
-- Name: FUNCTION "record_evo_daily_article_view"("article_slug" "text", "viewer_session_id" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."record_evo_daily_article_view"("article_slug" "text", "viewer_session_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_evo_daily_article_view"("article_slug" "text", "viewer_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_evo_daily_article_view"("article_slug" "text", "viewer_session_id" "text") TO "authenticated";


--
-- Name: FUNCTION "record_evo_tv_video_view"("video_slug" "text", "viewer_session_id" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."record_evo_tv_video_view"("video_slug" "text", "viewer_session_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_evo_tv_video_view"("video_slug" "text", "viewer_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_evo_tv_video_view"("video_slug" "text", "viewer_session_id" "text") TO "authenticated";


--
-- Name: FUNCTION "recover_expired_captured_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."recover_expired_captured_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recover_expired_captured_razorpay_payment"("p_payment_id" "uuid", "p_provider_order_id" "text", "p_provider_payment_id" "text", "p_provider_amount" bigint, "p_provider_currency" "text") TO "service_role";


--
-- Name: FUNCTION "replace_usd_currency_exchange_rates"("p_provider" "text", "p_fetched_at" timestamp with time zone, "p_rates" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."replace_usd_currency_exchange_rates"("p_provider" "text", "p_fetched_at" timestamp with time zone, "p_rates" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_usd_currency_exchange_rates"("p_provider" "text", "p_fetched_at" timestamp with time zone, "p_rates" "jsonb") TO "service_role";


--
-- Name: FUNCTION "reserve_razorpay_payment"("p_order_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."reserve_razorpay_payment"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_razorpay_payment"("p_order_id" "uuid") TO "authenticated";


--
-- Name: FUNCTION "save_evo_vault_product"("p_product_id" "uuid", "p_parent" "jsonb", "p_subtype" "jsonb", "p_prices" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."save_evo_vault_product"("p_product_id" "uuid", "p_parent" "jsonb", "p_subtype" "jsonb", "p_prices" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_evo_vault_product"("p_product_id" "uuid", "p_parent" "jsonb", "p_subtype" "jsonb", "p_prices" "jsonb") TO "authenticated";


--
-- Name: FUNCTION "set_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;


--
-- Name: TABLE "addresses"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addresses" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."addresses" TO "authenticated";


--
-- Name: TABLE "audit_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_logs" TO "service_role";


--
-- Name: TABLE "challenge_participants"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."challenge_participants" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."challenge_participants" TO "authenticated";


--
-- Name: TABLE "challenges"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."challenges" TO "service_role";
GRANT SELECT ON TABLE "public"."challenges" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."challenges" TO "authenticated";


--
-- Name: TABLE "contact_messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."contact_messages" TO "service_role";
GRANT INSERT ON TABLE "public"."contact_messages" TO "anon";
GRANT INSERT ON TABLE "public"."contact_messages" TO "authenticated";


--
-- Name: TABLE "content_reports"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."content_reports" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."content_reports" TO "authenticated";


--
-- Name: TABLE "coupon_redemptions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."coupon_redemptions" TO "service_role";
GRANT SELECT ON TABLE "public"."coupon_redemptions" TO "authenticated";


--
-- Name: TABLE "coupons"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."coupons" TO "service_role";


--
-- Name: TABLE "currency_exchange_rates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."currency_exchange_rates" TO "service_role";


--
-- Name: TABLE "digital_access"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."digital_access" TO "service_role";
GRANT SELECT ON TABLE "public"."digital_access" TO "authenticated";


--
-- Name: TABLE "digital_download_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."digital_download_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."digital_download_logs" TO "authenticated";


--
-- Name: TABLE "evo_circle_discussion_bookmarks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_circle_discussion_bookmarks" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."evo_circle_discussion_bookmarks" TO "authenticated";


--
-- Name: TABLE "evo_circle_discussion_likes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_circle_discussion_likes" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."evo_circle_discussion_likes" TO "authenticated";


--
-- Name: TABLE "evo_circle_discussion_views"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_circle_discussion_views" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."evo_circle_discussion_views" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."evo_circle_discussion_views" TO "authenticated";


--
-- Name: TABLE "evo_circle_discussions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_circle_discussions" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_circle_discussions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_circle_discussions" TO "authenticated";


--
-- Name: TABLE "evo_circle_replies"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_circle_replies" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_circle_replies" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_circle_replies" TO "authenticated";


--
-- Name: TABLE "evo_circle_reply_likes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_circle_reply_likes" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."evo_circle_reply_likes" TO "authenticated";


--
-- Name: TABLE "evo_circle_topics"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_circle_topics" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_circle_topics" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_circle_topics" TO "authenticated";


--
-- Name: TABLE "evo_daily_article_blocks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_daily_article_blocks" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_daily_article_blocks" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_daily_article_blocks" TO "authenticated";


--
-- Name: TABLE "evo_daily_article_tags"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_daily_article_tags" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_daily_article_tags" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_daily_article_tags" TO "authenticated";


--
-- Name: TABLE "evo_daily_articles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_daily_articles" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_daily_articles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_daily_articles" TO "authenticated";


--
-- Name: TABLE "evo_daily_bookmarks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_daily_bookmarks" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."evo_daily_bookmarks" TO "authenticated";


--
-- Name: TABLE "evo_daily_categories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_daily_categories" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_daily_categories" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_daily_categories" TO "authenticated";


--
-- Name: TABLE "evo_daily_likes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_daily_likes" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."evo_daily_likes" TO "authenticated";


--
-- Name: TABLE "evo_daily_tags"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_daily_tags" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_daily_tags" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_daily_tags" TO "authenticated";


--
-- Name: TABLE "evo_daily_views"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_daily_views" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."evo_daily_views" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."evo_daily_views" TO "authenticated";


--
-- Name: TABLE "evo_store_categories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_store_categories" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_store_categories" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_store_categories" TO "authenticated";


--
-- Name: TABLE "evo_store_inventory"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_store_inventory" TO "service_role";


--
-- Name: TABLE "evo_store_inventory_movements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_store_inventory_movements" TO "service_role";


--
-- Name: TABLE "evo_store_products"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_store_products" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_store_products" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_store_products" TO "authenticated";


--
-- Name: TABLE "evo_store_variants"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_store_variants" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_store_variants" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_store_variants" TO "authenticated";


--
-- Name: TABLE "evo_store_wishlist"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_store_wishlist" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."evo_store_wishlist" TO "authenticated";


--
-- Name: TABLE "evo_tv_series"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_tv_series" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_tv_series" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_tv_series" TO "authenticated";


--
-- Name: TABLE "evo_tv_video_bookmarks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_tv_video_bookmarks" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."evo_tv_video_bookmarks" TO "authenticated";


--
-- Name: TABLE "evo_tv_video_likes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_tv_video_likes" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."evo_tv_video_likes" TO "authenticated";


--
-- Name: TABLE "evo_tv_video_views"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_tv_video_views" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."evo_tv_video_views" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."evo_tv_video_views" TO "authenticated";


--
-- Name: TABLE "evo_tv_videos"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_tv_videos" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_tv_videos" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_tv_videos" TO "authenticated";


--
-- Name: TABLE "evo_vault_book_assets"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."evo_vault_book_assets" TO "service_role";


--
-- Name: TABLE "evo_vault_book_pdf_uploads"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_book_pdf_uploads" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_vault_book_pdf_uploads" TO "authenticated";


--
-- Name: TABLE "evo_vault_books"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."evo_vault_books" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_vault_books" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_vault_books" TO "authenticated";


--
-- Name: TABLE "evo_vault_categories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_categories" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_vault_categories" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_vault_categories" TO "authenticated";


--
-- Name: TABLE "evo_vault_certificates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_certificates" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_vault_certificates" TO "authenticated";


--
-- Name: TABLE "evo_vault_course_lessons"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_course_lessons" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_vault_course_lessons" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_vault_course_lessons" TO "authenticated";


--
-- Name: TABLE "evo_vault_course_modules"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_course_modules" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_vault_course_modules" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_vault_course_modules" TO "authenticated";


--
-- Name: TABLE "evo_vault_courses"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_courses" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_vault_courses" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_vault_courses" TO "authenticated";


--
-- Name: TABLE "evo_vault_enrollments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_enrollments" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_vault_enrollments" TO "authenticated";


--
-- Name: TABLE "evo_vault_lesson_progress"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_lesson_progress" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_vault_lesson_progress" TO "authenticated";


--
-- Name: TABLE "evo_vault_lesson_resources"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_lesson_resources" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_vault_lesson_resources" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_vault_lesson_resources" TO "authenticated";


--
-- Name: TABLE "evo_vault_product_images"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_product_images" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_vault_product_images" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_vault_product_images" TO "authenticated";


--
-- Name: TABLE "evo_vault_product_prices"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_product_prices" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_vault_product_prices" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_vault_product_prices" TO "authenticated";


--
-- Name: TABLE "evo_vault_products"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_products" TO "service_role";
GRANT SELECT ON TABLE "public"."evo_vault_products" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evo_vault_products" TO "authenticated";


--
-- Name: TABLE "evo_vault_wishlist"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."evo_vault_wishlist" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."evo_vault_wishlist" TO "authenticated";


--
-- Name: TABLE "featured_content"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."featured_content" TO "service_role";
GRANT SELECT ON TABLE "public"."featured_content" TO "anon";
GRANT SELECT ON TABLE "public"."featured_content" TO "authenticated";


--
-- Name: TABLE "homepage_sections"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."homepage_sections" TO "service_role";


--
-- Name: TABLE "media_assets"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."media_assets" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."media_assets" TO "authenticated";


--
-- Name: TABLE "newsletter_subscribers"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."newsletter_subscribers" TO "service_role";
GRANT INSERT ON TABLE "public"."newsletter_subscribers" TO "anon";
GRANT INSERT ON TABLE "public"."newsletter_subscribers" TO "authenticated";


--
-- Name: TABLE "notifications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notifications" TO "service_role";
GRANT SELECT,UPDATE ON TABLE "public"."notifications" TO "authenticated";


--
-- Name: TABLE "order_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."order_items" TO "service_role";
GRANT SELECT ON TABLE "public"."order_items" TO "authenticated";


--
-- Name: TABLE "order_status_history"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."order_status_history" TO "service_role";
GRANT SELECT ON TABLE "public"."order_status_history" TO "authenticated";


--
-- Name: TABLE "orders"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."orders" TO "service_role";
GRANT SELECT ON TABLE "public"."orders" TO "authenticated";


--
-- Name: TABLE "payment_refunds"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payment_refunds" TO "service_role";
GRANT SELECT ON TABLE "public"."payment_refunds" TO "authenticated";


--
-- Name: TABLE "payment_webhook_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payment_webhook_events" TO "service_role";
GRANT SELECT ON TABLE "public"."payment_webhook_events" TO "authenticated";


--
-- Name: TABLE "payments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "service_role";
GRANT SELECT ON TABLE "public"."payments" TO "authenticated";


--
-- Name: TABLE "permissions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."permissions" TO "service_role";
GRANT SELECT ON TABLE "public"."permissions" TO "authenticated";


--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."profiles" TO "authenticated";


--
-- Name: TABLE "role_permissions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_permissions" TO "service_role";
GRANT SELECT ON TABLE "public"."role_permissions" TO "authenticated";


--
-- Name: TABLE "roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles" TO "service_role";
GRANT SELECT ON TABLE "public"."roles" TO "authenticated";


--
-- Name: TABLE "seo_metadata"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."seo_metadata" TO "service_role";
GRANT SELECT ON TABLE "public"."seo_metadata" TO "anon";
GRANT SELECT ON TABLE "public"."seo_metadata" TO "authenticated";


--
-- Name: TABLE "shipments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shipments" TO "service_role";
GRANT SELECT ON TABLE "public"."shipments" TO "authenticated";


--
-- Name: TABLE "site_settings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."site_settings" TO "service_role";


--
-- Name: TABLE "user_consents"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_consents" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_consents" TO "authenticated";


--
-- Name: TABLE "user_roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT ON TABLE "public"."user_roles" TO "authenticated";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

-- \unrestrict PUnDrAc9k1A951XfDHw6hmPXRgZzchwX74Ur19YtD4oAFKGkcm3XqkyshvDwDEc

