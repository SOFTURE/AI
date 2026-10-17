-- A stable surface for an app's own SQL (recipient selection, reports), so it never re-implements the entitlement
-- state machine over billing.entitlements: these functions answer what getEntitlement answers, and a change to the
-- package's rules or tables keeps their names and columns. The trial of an account without a row depends on the
-- app's configuration (trial.days, trial.startsAt, the time zone), which the database does not know, so it is passed
-- in; getEntitlementStatesSql in @softure-ai/billing/server fills it from softure.config.ts. Every name is
-- qualified, because a function runs with its caller's search_path.
-- Rollback: DROP FUNCTION billing.entitlement_state(uuid, timestamptz, integer, text, date);
--   DROP FUNCTION billing.entitlement_states(timestamptz, integer, text, date);
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 12;

-- Where every account stands at as_of, one row per account in auth.users:
--   status            trial, paid or read_only;
--   ends_at           when the trial or dated paid access ends; NULL for lifetime access and when read-only;
--   read_only_since   when write access ended; NULL unless read-only;
--   read_only_reason  trial_ended or paid_ended; NULL unless read-only;
--   trial_ends_at, paid_until, is_lifetime  the record the state comes from (stored, or the derived trial);
--   is_stored         whether the account has a row in billing.entitlements.
-- Access covers instants before its end, so at the end itself the account is read-only. Not STRICT, so the
-- planner inlines it and a filter on user_id reads one account.
CREATE FUNCTION entitlement_states(as_of timestamptz, trial_days integer, time_zone text, trial_starts_on date DEFAULT NULL)
  RETURNS TABLE (
    user_id uuid,
    status text,
    ends_at timestamptz,
    read_only_since timestamptz,
    read_only_reason text,
    trial_ends_at timestamptz,
    paid_until timestamptz,
    is_lifetime boolean,
    is_stored boolean
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
    r.is_stored
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
      ELSE 'read_only'
    END AS status
  ) s
$$;

-- Where one account stands at as_of: the columns of entitlement_states without user_id, in one row, or none when no
-- account has this id.
CREATE FUNCTION entitlement_state(user_id uuid, as_of timestamptz, trial_days integer, time_zone text, trial_starts_on date DEFAULT NULL)
  RETURNS TABLE (
    status text,
    ends_at timestamptz,
    read_only_since timestamptz,
    read_only_reason text,
    trial_ends_at timestamptz,
    paid_until timestamptz,
    is_lifetime boolean,
    is_stored boolean
  )
  LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT s.status, s.ends_at, s.read_only_since, s.read_only_reason, s.trial_ends_at, s.paid_until, s.is_lifetime, s.is_stored
  FROM billing.entitlement_states(entitlement_state.as_of, entitlement_state.trial_days, entitlement_state.time_zone,
    entitlement_state.trial_starts_on) s
  WHERE s.user_id = entitlement_state.user_id
$$;
