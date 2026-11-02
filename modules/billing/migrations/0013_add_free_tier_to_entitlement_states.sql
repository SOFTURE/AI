-- The free tier (billing({ free })) in the SQL surface of migration 0012: both functions take a last parameter
-- has_free_tier (default false, so a call written for 0012 answers as before) and, when it is true, an account whose
-- trial and paid access ended is 'free' instead of 'read_only'. Two columns are appended, so the existing ones keep
-- their names and order. getEntitlementStatesSql in @softure-ai/billing/server passes whether softure.config.ts
-- declares free. A function's parameters and result columns can only change by dropping it; a view of the app that
-- selects from these functions blocks the drop, so drop the view first and re-create it after migrating.
-- Rollback: DROP FUNCTION billing.entitlement_state(uuid, timestamptz, integer, text, date, boolean);
--   DROP FUNCTION billing.entitlement_states(timestamptz, integer, text, date, boolean);
--   re-run the CREATE FUNCTION statements of 0012_create_entitlement_state_functions.sql; then
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 13;

DROP FUNCTION billing.entitlement_state(uuid, timestamptz, integer, text, date);
DROP FUNCTION billing.entitlement_states(timestamptz, integer, text, date);

-- Where every account stands at as_of, one row per account in auth.users:
--   status            trial, paid, free or read_only (free only when has_free_tier);
--   ends_at           when the trial or dated paid access ends; NULL for lifetime access, the free tier and read-only;
--   read_only_since   when write access ended; NULL unless read-only;
--   read_only_reason  trial_ended or paid_ended; NULL unless read-only;
--   trial_ends_at, paid_until, is_lifetime  the record the state comes from (stored, or the derived trial);
--   is_stored         whether the account has a row in billing.entitlements;
--   free_since        when the trial or paid access ended; NULL unless free;
--   free_reason       trial_ended or paid_ended; NULL unless free.
-- Access covers instants before its end, so at the end itself the account falls back. Not STRICT, so the planner
-- inlines it and a filter on user_id reads one account.
CREATE FUNCTION entitlement_states(as_of timestamptz, trial_days integer, time_zone text, trial_starts_on date DEFAULT NULL,
    has_free_tier boolean DEFAULT false)
  RETURNS TABLE (
    user_id uuid,
    status text,
    ends_at timestamptz,
    read_only_since timestamptz,
    read_only_reason text,
    trial_ends_at timestamptz,
    paid_until timestamptz,
    is_lifetime boolean,
    is_stored boolean,
    free_since timestamptz,
    free_reason text
  )
  LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT
    r.user_id,
    s.status,
    CASE s.status WHEN 'trial' THEN r.trial_ends_at WHEN 'paid' THEN CASE WHEN r.is_lifetime THEN NULL ELSE r.paid_until END END,
    CASE WHEN s.status = 'read_only' THEN greatest(r.trial_ends_at, r.paid_until) END,
    CASE WHEN s.status = 'read_only' THEN CASE WHEN r.paid_until > r.trial_ends_at THEN 'paid_ended' ELSE 'trial_ended' END END,
    r.trial_ends_at,
    r.paid_until,
    r.is_lifetime,
    r.is_stored,
    CASE WHEN s.status = 'free' THEN greatest(r.trial_ends_at, r.paid_until) END,
    CASE WHEN s.status = 'free' THEN CASE WHEN r.paid_until > r.trial_ends_at THEN 'paid_ended' ELSE 'trial_ended' END END
  FROM (
    SELECT
      u.id AS user_id,
      -- The derived trial: trial_days local days from the day the account was created, or from trial_starts_on
      -- when later (greatest() skips NULL), ending at the start of a local day. Where midnight is skipped by a
      -- DST change, AT TIME ZONE reads 00:00 with the offset before it, which is the first instant of the day.
      coalesce(
        e.trial_ends_at,
        (greatest((u.created_at AT TIME ZONE entitlement_states.time_zone)::date, entitlement_states.trial_starts_on)
          + entitlement_states.trial_days)::timestamp AT TIME ZONE entitlement_states.time_zone
      ) AS trial_ends_at,
      e.paid_until,
      coalesce(e.is_lifetime, false) AS is_lifetime,
      e.user_id IS NOT NULL AS is_stored
    FROM auth.users u
    LEFT JOIN billing.entitlements e ON e.user_id = u.id
  ) r
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN r.is_lifetime OR r.paid_until > entitlement_states.as_of THEN 'paid'
      WHEN r.trial_ends_at > entitlement_states.as_of THEN 'trial'
      WHEN entitlement_states.has_free_tier THEN 'free'
      ELSE 'read_only'
    END AS status
  ) s
$$;

-- Where one account stands at as_of: the columns of entitlement_states without user_id, in one row, or none when no
-- account has this id.
CREATE FUNCTION entitlement_state(user_id uuid, as_of timestamptz, trial_days integer, time_zone text, trial_starts_on date DEFAULT NULL,
    has_free_tier boolean DEFAULT false)
  RETURNS TABLE (
    status text,
    ends_at timestamptz,
    read_only_since timestamptz,
    read_only_reason text,
    trial_ends_at timestamptz,
    paid_until timestamptz,
    is_lifetime boolean,
    is_stored boolean,
    free_since timestamptz,
    free_reason text
  )
  LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT s.status, s.ends_at, s.read_only_since, s.read_only_reason, s.trial_ends_at, s.paid_until, s.is_lifetime, s.is_stored,
    s.free_since, s.free_reason
  FROM billing.entitlement_states(entitlement_state.as_of, entitlement_state.trial_days, entitlement_state.time_zone,
    entitlement_state.trial_starts_on, entitlement_state.has_free_tier) s
  WHERE s.user_id = entitlement_state.user_id
$$;
