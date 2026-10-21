-- Administrative storage and reviewer resurrection fences.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE private.user_data_state (
  user_id uuid PRIMARY KEY, generation bigint NOT NULL DEFAULT 0 CHECK(generation>=0), revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','deleting','deleted')),
  progress_coverage text NOT NULL DEFAULT 'complete' CHECK(progress_coverage IN ('complete','partial')),
  incomplete_attempt_count integer NOT NULL DEFAULT 0 CHECK(incomplete_attempt_count>=0)
);
INSERT INTO private.user_data_state(user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;
CREATE TABLE private.admin_memberships(user_id uuid PRIMARY KEY, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE private.admin_sessions(
  id uuid PRIMARY KEY, session_hash text NOT NULL UNIQUE, admin_id uuid NOT NULL,
  access_token_encrypted text NOT NULL, csrf_hash text NOT NULL, expires_at timestamptz NOT NULL,
  reauthenticated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.admin_throttle(key text PRIMARY KEY, failures integer NOT NULL, window_start timestamptz NOT NULL);
CREATE TABLE private.admin_selections(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL, session_id uuid NOT NULL, user_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('ids','matching','reset')), query jsonb NOT NULL DEFAULT '{}', ids uuid[] NOT NULL,
  generation bigint NOT NULL, revision bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes', consumed boolean NOT NULL DEFAULT false
);
CREATE TABLE private.admin_operations(
  id uuid PRIMARY KEY, actor_id uuid NOT NULL, session_id uuid NOT NULL, user_id uuid NOT NULL, action text NOT NULL,
  fingerprint text NOT NULL, status text NOT NULL, result jsonb, deleted_count integer NOT NULL DEFAULT 0,
  lease_until timestamptz, lease_actor_id uuid, attempts integer NOT NULL DEFAULT 0, error_code text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.admin_audit(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, target_id uuid, operation_id uuid,
  action text NOT NULL, status text NOT NULL, count integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_created ON private.admin_audit(created_at DESC,id);
CREATE TABLE private.attempt_tombstones(user_id uuid NOT NULL,attempt_id uuid NOT NULL,deleted_at timestamptz NOT NULL DEFAULT now(),operation_id uuid NOT NULL,PRIMARY KEY(user_id,attempt_id));
ALTER TABLE public.exam_attempts ADD COLUMN generation bigint;
UPDATE public.exam_attempts SET generation=0;
ALTER TABLE public.exam_attempts ALTER COLUMN generation SET NOT NULL;
ALTER TABLE public.active_sessions ADD COLUMN generation bigint;
UPDATE public.active_sessions SET generation=0;
ALTER TABLE public.active_sessions ALTER COLUMN generation SET NOT NULL;
-- Replace the historical noncascading FK after preserving every row.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='public.user_progress'::regclass AND contype='f' LOOP
    EXECUTE format('ALTER TABLE public.user_progress DROP CONSTRAINT %I',r.conname);
  END LOOP;
END $$;
ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE FUNCTION private.state_json(p_user_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('generation',s.generation,'revision',s.revision,'status',s.status,'progressCoverage',s.progress_coverage,'incompleteAttemptCount',s.incomplete_attempt_count)
  FROM private.user_data_state s WHERE s.user_id=p_user_id
$$;
CREATE FUNCTION private.live_user(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users u JOIN private.user_data_state s ON s.user_id=u.id WHERE u.id=p_user_id AND s.status='active')
$$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO private.user_data_state(user_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  IF NOT private.live_user(NEW.id) THEN RAISE EXCEPTION 'ACCOUNT_DISABLED' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.profiles(id,email,display_name,avatar_url)
  VALUES(NEW.id,coalesce(NEW.email,''),coalesce(NEW.raw_user_meta_data->>'full_name',NEW.raw_user_meta_data->>'name','User'),NEW.raw_user_meta_data->>'avatar_url') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Cover signups that committed between the initial seed and installing the trigger.
INSERT INTO private.user_data_state(user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;
CREATE FUNCTION private.guard_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM private.user_data_state WHERE user_id=NEW.user_id FOR UPDATE;
  IF NEW.active AND NOT private.live_user(NEW.user_id) THEN RAISE EXCEPTION 'ACCOUNT_DISABLED'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_admin_membership BEFORE INSERT OR UPDATE ON private.admin_memberships FOR EACH ROW EXECUTE FUNCTION private.guard_membership();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('exam_attempts','user_progress','active_sessions','profiles') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,r.tablename);
  END LOOP;
END $$;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles,public.exam_attempts,public.user_progress,public.active_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.profiles,public.exam_attempts,public.user_progress,public.active_sessions TO authenticated;
GRANT UPDATE(display_name,avatar_url,updated_at) ON public.profiles TO authenticated;
CREATE POLICY owner_live ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid() AND private.live_user(id));
CREATE POLICY owner_live_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid() AND private.live_user(id)) WITH CHECK(id=auth.uid() AND private.live_user(id));
CREATE POLICY owner_live ON public.exam_attempts FOR SELECT TO authenticated USING(user_id=auth.uid() AND private.live_user(user_id));
CREATE POLICY owner_live ON public.user_progress FOR SELECT TO authenticated USING(user_id=auth.uid() AND private.live_user(user_id));
CREATE POLICY owner_live ON public.active_sessions FOR SELECT TO authenticated USING(user_id=auth.uid() AND private.live_user(user_id));

CREATE FUNCTION private.incomplete_attempt_count(p_user_id uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT count(*)::integer FROM public.exam_attempts a WHERE a.user_id=p_user_id AND NOT (
    CASE WHEN jsonb_typeof(a.questions)='array' THEN jsonb_array_length(a.questions)=a.total AND a.total>0 ELSE false END
    AND jsonb_typeof(a.user_answers)='object'
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.questions)='array' THEN a.questions ELSE '[]'::jsonb END) q WHERE jsonb_typeof(q) IS DISTINCT FROM 'object' OR jsonb_typeof(q->'id') IS DISTINCT FROM 'string' OR q->>'id'='' OR jsonb_typeof(q->'correct_answer') IS DISTINCT FROM 'string')
    AND (SELECT count(DISTINCT q->>'id') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.questions)='array' THEN a.questions ELSE '[]'::jsonb END) q)=a.total
  ) IS TRUE
$$;
UPDATE private.user_data_state s SET incomplete_attempt_count=private.incomplete_attempt_count(s.user_id),progress_coverage=CASE WHEN private.incomplete_attempt_count(s.user_id)>0 THEN 'partial' ELSE 'complete' END;
CREATE FUNCTION private.rebuild_user_progress(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_seen text[]; v_wrong text[]; v_incomplete integer;
BEGIN
  WITH outcomes AS (
    SELECT q.value->>'id' question_id, (a.user_answers->>((q.ordinality-1)::text)) IS NOT DISTINCT FROM q.value->>'correct_answer' correct,
      row_number() OVER(PARTITION BY q.value->>'id' ORDER BY a.completed_at DESC,a.id DESC) n
    FROM public.exam_attempts a CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(a.questions)='array' THEN a.questions ELSE '[]'::jsonb END) WITH ORDINALITY q(value,ordinality)
    WHERE a.user_id=p_user_id AND jsonb_typeof(q.value)='object' AND jsonb_typeof(q.value->'id')='string' AND q.value->>'id'<>'' AND jsonb_typeof(q.value->'correct_answer')='string'
  ) SELECT coalesce(array_agg(question_id ORDER BY question_id),'{}'::text[]),coalesce(array_agg(question_id ORDER BY question_id) FILTER(WHERE NOT correct),'{}'::text[]) INTO v_seen,v_wrong FROM outcomes WHERE n=1;
  v_incomplete:=private.incomplete_attempt_count(p_user_id);
  INSERT INTO public.user_progress(user_id,seen_questions,wrong_questions,updated_at) VALUES(p_user_id,v_seen,v_wrong,now())
  ON CONFLICT(user_id) DO UPDATE SET seen_questions=excluded.seen_questions,wrong_questions=excluded.wrong_questions,updated_at=excluded.updated_at;
  UPDATE private.user_data_state SET progress_coverage=CASE WHEN v_incomplete>0 THEN 'partial' ELSE 'complete' END,incomplete_attempt_count=v_incomplete WHERE user_id=p_user_id;
END $$;

CREATE FUNCTION private.lock_reviewer(p_generation bigint DEFAULT NULL,p_check_generation boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_state private.user_data_state;
BEGIN
  SELECT * INTO v_state FROM private.user_data_state WHERE user_id=v_user FOR UPDATE;
  IF NOT FOUND OR v_state.status<>'active' OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_user) THEN RAISE EXCEPTION 'ACCOUNT_DISABLED'; END IF;
  IF p_check_generation AND (p_generation IS NULL OR p_generation<>v_state.generation) THEN RAISE EXCEPTION 'STALE_GENERATION'; END IF;
  RETURN v_user;
END $$;
CREATE FUNCTION public.reviewer_data_state() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid; BEGIN v_user:=private.lock_reviewer(NULL,false); RETURN private.state_json(v_user); END $$;

CREATE FUNCTION public.save_attempt(p_attempt jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid; v_id uuid; v_old public.exam_attempts; v_total integer; v_score integer; v_completed timestamptz; v_session uuid; v_q jsonb; v_answers jsonb;
BEGIN
  IF octet_length(p_attempt::text)>5242880 THEN RAISE EXCEPTION 'INVALID_ATTEMPT'; END IF;
  v_user:=private.lock_reviewer((p_attempt->>'generation')::bigint);
  IF p_attempt->>'user_id' IS DISTINCT FROM v_user::text THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  v_id:=(p_attempt->>'id')::uuid;
  IF v_id IS NULL THEN RAISE EXCEPTION 'INVALID_ATTEMPT'; END IF;
  IF EXISTS(SELECT 1 FROM private.attempt_tombstones WHERE user_id=v_user AND attempt_id=v_id) THEN RAISE EXCEPTION 'ATTEMPT_DELETED'; END IF;
  SELECT * INTO v_old FROM public.exam_attempts WHERE id=v_id;
  IF FOUND THEN
    IF v_old.user_id=v_user AND v_old.generation=(p_attempt->>'generation')::bigint AND v_old.score=(p_attempt->>'score')::integer AND v_old.total=(p_attempt->>'total')::integer
      AND v_old.category=p_attempt->>'category' AND v_old.mode=p_attempt->>'mode' AND v_old.level IS NOT DISTINCT FROM p_attempt->>'level'
      AND v_old.completed_at=(p_attempt->>'completed_at')::timestamptz AND v_old.questions IS NOT DISTINCT FROM p_attempt->'questions' AND v_old.user_answers IS NOT DISTINCT FROM p_attempt->'user_answers'
    THEN RETURN jsonb_build_object('id',v_id,'state',private.state_json(v_user)); ELSE RAISE EXCEPTION 'ID_CONFLICT'; END IF;
  END IF;
  v_total:=(p_attempt->>'total')::integer;v_score:=(p_attempt->>'score')::integer;v_completed:=(p_attempt->>'completed_at')::timestamptz;
  v_q:=p_attempt->'questions';v_answers:=p_attempt->'user_answers';
  IF v_total IS NULL OR v_total<1 OR v_total>2000 OR v_score IS NULL OR v_score<0 OR v_score>v_total OR v_completed IS NULL OR NOT isfinite(v_completed)
    OR jsonb_typeof(v_q) IS DISTINCT FROM 'array' OR jsonb_typeof(v_answers) IS DISTINCT FROM 'object'
    OR p_attempt->>'mode' IS NULL OR p_attempt->>'mode' NOT IN ('practice','mock') OR p_attempt->>'level' IS NULL OR p_attempt->>'level' NOT IN ('professional','subprofessional')
    OR jsonb_typeof(p_attempt->'category') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'INVALID_ATTEMPT'; END IF;
  IF jsonb_array_length(v_q)<>v_total OR (SELECT count(DISTINCT q->>'id') FROM jsonb_array_elements(v_q) q)<>v_total THEN RAISE EXCEPTION 'INVALID_ATTEMPT'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_q) q WHERE
    jsonb_typeof(q) IS DISTINCT FROM 'object' OR jsonb_typeof(q->'id') IS DISTINCT FROM 'string' OR q->>'id'=''
    OR jsonb_typeof(q->'question') IS DISTINCT FROM 'string' OR q->>'question'='' OR jsonb_typeof(q->'category') IS DISTINCT FROM 'string' OR q->>'category'=''
    OR jsonb_typeof(q->'correct_answer') IS DISTINCT FROM 'string' OR jsonb_typeof(q->'choices') IS DISTINCT FROM 'array'
    OR CASE WHEN jsonb_typeof(q->'choices')='array' THEN jsonb_array_length(q->'choices')<>4 ELSE true END
    OR NOT (q->'choices' @> jsonb_build_array(q->'correct_answer'))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(q->'choices')='array' THEN q->'choices' ELSE '[]'::jsonb END) c WHERE jsonb_typeof(c)<>'string')
    OR (SELECT count(DISTINCT c) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(q->'choices')='array' THEN q->'choices' ELSE '[]'::jsonb END) c)<>4
  ) THEN RAISE EXCEPTION 'INVALID_ATTEMPT'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(v_answers) x WHERE x.key !~ '^(0|[1-9][0-9]*)$' OR length(x.key)>4 OR jsonb_typeof(x.value)<>'string'
    OR CASE WHEN x.key ~ '^(0|[1-9][0-9]*)$' AND length(x.key)<=4 THEN x.key::integer>=v_total OR NOT(coalesce(v_q->(x.key::integer)->'choices','[]'::jsonb) @> jsonb_build_array(x.value)) ELSE true END
  ) THEN RAISE EXCEPTION 'INVALID_ATTEMPT'; END IF;
  INSERT INTO public.exam_attempts(id,user_id,score,total,category,mode,level,completed_at,questions,user_answers,generation)
  VALUES(v_id,v_user,v_score,v_total,p_attempt->>'category',p_attempt->>'mode',p_attempt->>'level',v_completed,v_q,v_answers,(p_attempt->>'generation')::bigint);
  PERFORM private.rebuild_user_progress(v_user);
  IF p_attempt->>'active_session_id' IS NOT NULL THEN
    v_session:=(p_attempt->>'active_session_id')::uuid;
    DELETE FROM public.active_sessions WHERE user_id=v_user AND generation=(p_attempt->>'generation')::bigint AND session_data->>'sessionId'=v_session::text;
  END IF;
  UPDATE private.user_data_state SET revision=revision+1 WHERE user_id=v_user;
  RETURN jsonb_build_object('id',v_id,'state',private.state_json(v_user));
END $$;

CREATE FUNCTION public.save_active_session(p_session jsonb,p_generation bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_id uuid;BEGIN
  IF octet_length(p_session::text)>5242880 OR jsonb_typeof(p_session) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_SESSION';END IF;
  v_user:=private.lock_reviewer(p_generation);v_id:=(p_session->>'sessionId')::uuid;
  IF v_id IS NULL OR p_session->>'ownerId' IS DISTINCT FROM v_user::text OR (p_session->>'generation')::bigint IS DISTINCT FROM p_generation THEN RAISE EXCEPTION 'INVALID_SESSION';END IF;
  IF EXISTS(SELECT 1 FROM public.active_sessions WHERE user_id=v_user AND generation=p_generation AND session_data=p_session) THEN RETURN private.state_json(v_user);END IF;
  INSERT INTO public.active_sessions(user_id,session_data,generation,updated_at) VALUES(v_user,p_session,p_generation,now()) ON CONFLICT(user_id) DO UPDATE SET session_data=excluded.session_data,generation=excluded.generation,updated_at=excluded.updated_at;
  UPDATE private.user_data_state SET revision=revision+1 WHERE user_id=v_user;
  RETURN private.state_json(v_user);
END $$;
CREATE FUNCTION public.delete_active_session(p_session_id uuid,p_generation bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;BEGIN
  v_user:=private.lock_reviewer(p_generation);
  DELETE FROM public.active_sessions WHERE user_id=v_user AND generation=p_generation AND session_data->>'sessionId'=p_session_id::text;
  IF FOUND THEN UPDATE private.user_data_state SET revision=revision+1 WHERE user_id=v_user;END IF;
  RETURN private.state_json(v_user);
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.live_user(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user(),public.reviewer_data_state(),public.save_attempt(jsonb),public.save_active_session(jsonb,bigint),public.delete_active_session(uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reviewer_data_state(),public.save_attempt(jsonb),public.save_active_session(jsonb,bigint),public.delete_active_session(uuid,bigint) TO authenticated;

ALTER TABLE private.admin_operations ADD COLUMN lease_token uuid, ADD COLUMN lease_session_id uuid;
CREATE FUNCTION private.guard_admin(p_actor uuid,p_session uuid,p_reauth boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session private.admin_sessions;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  PERFORM 1 FROM private.admin_memberships WHERE user_id=p_actor AND active FOR SHARE;
  IF NOT FOUND OR NOT private.live_user(p_actor) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  SELECT * INTO v_session FROM private.admin_sessions WHERE id=p_session AND admin_id=p_actor AND expires_at>now() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  IF p_reauth AND (v_session.reauthenticated_at IS NULL OR v_session.reauthenticated_at<now()-interval '5 minutes' OR v_session.reauthenticated_at>now()) THEN RAISE EXCEPTION 'REAUTH_REQUIRED';END IF;
END $$;
CREATE FUNCTION private.lock_target(p_actor uuid,p_target uuid,p_active boolean DEFAULT true) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state private.user_data_state;
BEGIN
  SELECT * INTO v_state FROM private.user_data_state WHERE user_id=p_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_DISABLED';END IF;
  IF p_actor=p_target OR EXISTS(SELECT 1 FROM private.admin_memberships WHERE user_id=p_target AND active) THEN RAISE EXCEPTION 'PROTECTED_TARGET';END IF;
  IF p_active AND (v_state.status<>'active' OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_target)) THEN RAISE EXCEPTION 'ACCOUNT_DISABLED';END IF;
END $$;
CREATE FUNCTION private.selection_json(p_selection private.admin_selections) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT jsonb_build_object('selectionId',p_selection.id,'userId',p_selection.user_id,'ids',to_jsonb(p_selection.ids),'count',cardinality(p_selection.ids),'expiresAt',p_selection.expires_at,'generation',p_selection.generation,'revision',p_selection.revision)
$$;
CREATE FUNCTION private.validate_selection(p_selection_id uuid,p_actor uuid,p_session uuid,p_user uuid) RETURNS private.admin_selections LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v private.admin_selections;v_state private.user_data_state;
BEGIN
  SELECT * INTO v FROM private.admin_selections WHERE id=p_selection_id FOR UPDATE;
  IF NOT FOUND OR v.actor_id<>p_actor OR v.session_id<>p_session OR v.user_id<>p_user OR v.expires_at<=now() OR v.consumed THEN RAISE EXCEPTION 'SELECTION_STALE';END IF;
  SELECT * INTO v_state FROM private.user_data_state WHERE user_id=p_user;
  IF v_state.status<>'active' OR v_state.generation<>v.generation OR v_state.revision<>v.revision OR
    (SELECT count(*) FROM public.exam_attempts WHERE user_id=p_user AND id=ANY(v.ids))<>cardinality(v.ids) THEN RAISE EXCEPTION 'SELECTION_STALE';END IF;
  RETURN v;
END $$;
CREATE FUNCTION private.filtered_attempts(p_user uuid,p_filter jsonb) RETURNS SETOF public.exam_attempts LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_sort text:=coalesce(p_filter->>'sort','completed_at');v_direction text:=coalesce(p_filter->>'direction','desc');v_search text:=coalesce(p_filter->>'search','');
BEGIN
  IF length(v_search)>200 OR v_sort NOT IN ('completed_at','percentage','category') OR v_direction NOT IN ('asc','desc')
    OR coalesce(p_filter->>'mode','all') NOT IN ('all','practice','mock') OR coalesce(p_filter->>'level','all') NOT IN ('all','professional','subprofessional')
    OR (p_filter->>'from' IS NOT NULL AND p_filter->>'from' !~ '^\d{4}-\d{2}-\d{2}$') OR (p_filter->>'to' IS NOT NULL AND p_filter->>'to' !~ '^\d{4}-\d{2}-\d{2}$') THEN RAISE EXCEPTION 'INVALID_FILTER';END IF;
  IF (p_filter->>'from')::date>(p_filter->>'to')::date THEN RAISE EXCEPTION 'INVALID_FILTER';END IF;
  RETURN QUERY SELECT a.* FROM public.exam_attempts a WHERE a.user_id=p_user
    AND (v_search='' OR position(lower(v_search) in lower(a.category))>0 OR a.id::text=v_search)
    AND (coalesce(p_filter->>'mode','all')='all' OR a.mode=p_filter->>'mode')
    AND (coalesce(p_filter->>'level','all')='all' OR a.level=p_filter->>'level')
    AND (nullif(p_filter->>'category','') IS NULL OR a.category=p_filter->>'category')
    AND (p_filter->>'from' IS NULL OR a.completed_at>=(p_filter->>'from')::date::timestamp AT TIME ZONE 'UTC')
    AND (p_filter->>'to' IS NULL OR a.completed_at<((p_filter->>'to')::date+1)::timestamp AT TIME ZONE 'UTC')
    ORDER BY
      CASE WHEN v_sort='completed_at' AND v_direction='asc' THEN a.completed_at END ASC,
      CASE WHEN v_sort='completed_at' AND v_direction='desc' THEN a.completed_at END DESC,
      CASE WHEN v_sort='percentage' AND v_direction='asc' THEN a.score::numeric/nullif(a.total,0) END ASC NULLS LAST,
      CASE WHEN v_sort='percentage' AND v_direction='desc' THEN a.score::numeric/nullif(a.total,0) END DESC NULLS LAST,
      CASE WHEN v_sort='category' AND v_direction='asc' THEN a.category END ASC,
      CASE WHEN v_sort='category' AND v_direction='desc' THEN a.category END DESC,a.id ASC;
END $$;
CREATE VIEW private.admin_users AS
  SELECT u.id,u.email,p.display_name,u.created_at,coalesce(a.exam_count,0) exam_count,a.last_completed_at,
    EXISTS(SELECT 1 FROM private.admin_memberships m WHERE m.user_id=u.id AND m.active) protected_admin,coalesce(s.status,'active') status
  FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id LEFT JOIN private.user_data_state s ON s.user_id=u.id
  LEFT JOIN LATERAL(SELECT count(*)::integer exam_count,max(completed_at) last_completed_at FROM public.exam_attempts WHERE user_id=u.id) a ON true;
CREATE FUNCTION private.user_json(p_user private.admin_users) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT jsonb_build_object('id',p_user.id,'email',p_user.email,'displayName',p_user.display_name,'createdAt',p_user.created_at,'examCount',p_user.exam_count,'lastCompletedAt',p_user.last_completed_at,'protectedAdmin',p_user.protected_admin,'status',p_user.status)
$$;

CREATE FUNCTION private.performance_summary(p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH attempts AS MATERIALIZED (
    SELECT a.*, EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.questions)='array' THEN a.questions ELSE '[]'::jsonb END) q
      WHERE jsonb_typeof(q->'id')='string' AND q->>'id'<>'' AND jsonb_typeof(q->'correct_answer')='string')
      AND jsonb_typeof(a.user_answers) IN ('object','array') usable_snapshot
    FROM public.exam_attempts a WHERE a.user_id=p_user
  ), contributions AS (
    SELECT a.completed_at,a.id,q.ordinality,CASE WHEN jsonb_typeof(q.value->'category')='string' THEN btrim(q.value->>'category') ELSE '' END category,
      CASE WHEN a.user_answers->>((q.ordinality-1)::text)=q.value->>'correct_answer' THEN 1 ELSE 0 END correct,1 total
    FROM attempts a CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(a.questions)='array' THEN a.questions ELSE '[]'::jsonb END) WITH ORDINALITY q(value,ordinality)
    WHERE a.usable_snapshot AND jsonb_typeof(q.value->'id')='string' AND q.value->>'id'<>'' AND jsonb_typeof(q.value->'correct_answer')='string'
    UNION ALL
    SELECT a.completed_at,a.id,0::bigint,btrim(a.category),a.score,a.total FROM attempts a
    WHERE NOT coalesce(a.usable_snapshot,false) AND a.score>=0 AND a.score<=a.total AND a.total>0
  ), ordered AS (
    SELECT c.*,row_number() OVER(ORDER BY c.completed_at DESC,c.id,c.ordinality) first_order FROM contributions c
    WHERE c.category<>'' AND lower(c.category) NOT IN ('all','all categories','mixed categories','general / mixed')
  ), categories AS (
    SELECT category,sum(correct) correct,sum(total) total,round(sum(correct)::numeric/sum(total)*100) percentage,min(first_order) first_order FROM ordered GROUP BY category
  ), percentages AS (
    SELECT score::numeric/total*100 percentage FROM attempts WHERE total>0 AND score>=0 AND score<=total
  ) SELECT jsonb_build_object(
    'examCount',(SELECT count(*) FROM attempts),
    'bestPercentage',coalesce((SELECT round(max(percentage)) FROM percentages),0),
    'averagePercentage',coalesce((SELECT round(avg(percentage)) FROM percentages),0),
    'categories',coalesce((SELECT jsonb_agg(jsonb_build_object('category',category,'totalCorrect',correct,'totalQuestions',total,'percentage',percentage) ORDER BY percentage DESC,first_order) FROM categories),'[]'::jsonb),
    'incompleteAttemptCount',private.incomplete_attempt_count(p_user)
  )
$$;

CREATE FUNCTION public.admin_console(p_action text,p_args jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_actor uuid;v_session uuid;v_user uuid;v_id uuid;v_selection private.admin_selections;v_operation private.admin_operations;v_data private.user_data_state;v_admin private.admin_sessions;v_user_row private.admin_users;
  v_ids uuid[];v_excluded uuid[];v_json jsonb;v_result jsonb;v_items jsonb;v_fingerprint text;v_email text;v_count integer;v_total integer;v_page integer;v_size integer;v_sort text;v_direction text;v_search text;v_status text;v_filter jsonb;v_throttle private.admin_throttle;v_lease uuid;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  IF jsonb_typeof(p_args) IS DISTINCT FROM 'object' OR octet_length(p_args::text)>1048576 THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
  IF p_action='auth_member' THEN
    SELECT u.email INTO v_email FROM auth.users u JOIN private.admin_memberships m ON m.user_id=u.id AND m.active WHERE u.id=(p_args->>'userId')::uuid AND private.live_user(u.id);
    RETURN jsonb_build_object('active',FOUND,'email',v_email);
  ELSIF p_action='auth_session_get' THEN
    SELECT * INTO v_admin FROM private.admin_sessions WHERE session_hash=p_args->>'hash' AND expires_at>now();
    IF NOT FOUND THEN RETURN 'null'::jsonb;END IF;
    RETURN jsonb_build_object('id',v_admin.id,'adminId',v_admin.admin_id,'accessTokenEncrypted',v_admin.access_token_encrypted,'csrfHash',v_admin.csrf_hash,'expiresAt',v_admin.expires_at,'reauthenticatedAt',v_admin.reauthenticated_at);
  ELSIF p_action='auth_session_put' THEN
    v_user:=(p_args->>'adminId')::uuid;
    IF NOT private.live_user(v_user) OR NOT EXISTS(SELECT 1 FROM private.admin_memberships WHERE user_id=v_user AND active) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
    IF (p_args->>'expiresAt')::timestamptz<=now() OR (p_args->>'expiresAt')::timestamptz>now()+interval '1 hour' OR (p_args->>'expiresAt') IS NULL OR (p_args->>'reauthenticatedAt')::timestamptz>now() THEN RAISE EXCEPTION 'INVALID_SESSION';END IF;
    IF EXISTS(SELECT 1 FROM private.admin_sessions WHERE id=(p_args->>'id')::uuid AND admin_id<>v_user) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
    INSERT INTO private.admin_sessions(id,session_hash,admin_id,access_token_encrypted,csrf_hash,expires_at,reauthenticated_at)
    VALUES((p_args->>'id')::uuid,p_args->>'hash',v_user,p_args->>'accessTokenEncrypted',p_args->>'csrfHash',(p_args->>'expiresAt')::timestamptz,(p_args->>'reauthenticatedAt')::timestamptz)
    ON CONFLICT(id) DO UPDATE SET session_hash=excluded.session_hash,access_token_encrypted=excluded.access_token_encrypted,csrf_hash=excluded.csrf_hash,expires_at=excluded.expires_at,reauthenticated_at=excluded.reauthenticated_at;
    RETURN '{}'::jsonb;
  ELSIF p_action='auth_session_delete' THEN
    DELETE FROM private.admin_sessions WHERE id=(p_args->>'id')::uuid;RETURN '{}'::jsonb;
  ELSIF p_action='auth_throttle' THEN
    IF p_args->>'key' !~ '^(email|ip):[0-9a-f]{64}$' THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
    INSERT INTO private.admin_throttle(key,failures,window_start) VALUES(p_args->>'key',0,now()) ON CONFLICT DO NOTHING;
    SELECT * INTO v_throttle FROM private.admin_throttle WHERE key=p_args->>'key' FOR UPDATE;
    IF v_throttle.window_start<=now()-interval '15 minutes' THEN v_throttle.failures:=0;v_throttle.window_start:=now();END IF;
    IF NOT coalesce((p_args->>'failed')::boolean,false) THEN
      IF v_throttle.failures>=5 THEN RETURN jsonb_build_object('allowed',false);END IF;
      v_throttle.failures:=v_throttle.failures+1;
    END IF;
    UPDATE private.admin_throttle SET failures=v_throttle.failures,window_start=v_throttle.window_start WHERE key=v_throttle.key;
    RETURN jsonb_build_object('allowed',true);
  ELSIF p_action='auth_audit' THEN
    IF p_args->>'action' NOT IN ('login_success','login_failure','logout','reauth_success','reauth_failure') OR p_args->>'status' NOT IN ('succeeded','failed') THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
    INSERT INTO private.admin_audit(actor_id,action,status) VALUES((p_args->>'adminId')::uuid,p_args->>'action',p_args->>'status');RETURN '{}'::jsonb;
  END IF;
  v_actor:=(p_args->>'actorId')::uuid;v_session:=(p_args->>'sessionId')::uuid;v_user:=(p_args->>'userId')::uuid;
  PERFORM private.guard_admin(v_actor,v_session,p_action IN ('delete_prepare','delete_claim'));
  v_page:=coalesce((p_args->>'page')::integer,1);v_size:=coalesce((p_args->>'pageSize')::integer,20);
  IF v_page<1 OR v_page>1000000 OR v_size NOT IN (20,50) THEN RAISE EXCEPTION 'INVALID_FILTER';END IF;
  IF p_action='failure_audit' THEN
    IF p_args->>'action' IS NULL OR p_args->>'action' NOT IN ('delete_attempts','reset','delete_account','delete_retry','selection') THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
    INSERT INTO private.admin_audit(actor_id,target_id,operation_id,action,status,count) VALUES(v_actor,v_user,(p_args->>'operationId')::uuid,p_args->>'action','failed',0);
    RETURN '{}'::jsonb;
  ELSIF p_action='overview' THEN
    RETURN jsonb_build_object('reviewerCount',(SELECT count(*) FROM private.admin_users WHERE NOT protected_admin),'examCount',(SELECT count(*) FROM public.exam_attempts),'pausedCount',(SELECT count(*) FROM public.active_sessions),'unresolvedDeletionCount',(SELECT count(*) FROM private.admin_operations WHERE action='delete_account' AND status<>'complete'));
  ELSIF p_action='users' THEN
    v_sort:=coalesce(p_args->>'sort','created_at');v_direction:=coalesce(p_args->>'direction','desc');v_search:=coalesce(p_args->>'search','');v_status:=coalesce(p_args->>'status','all');
    IF length(v_search)>200 OR v_sort NOT IN ('name','email','created_at','last_completed_at') OR v_direction NOT IN ('asc','desc') OR v_status NOT IN ('all','with-exams','without-exams','deletion-pending') THEN RAISE EXCEPTION 'INVALID_FILTER';END IF;
    SELECT count(*) INTO v_total FROM private.admin_users u WHERE (v_search='' OR position(lower(v_search) in lower(coalesce(u.display_name,'')||' '||coalesce(u.email,'')))>0) AND (v_status='all' OR v_status='with-exams' AND u.exam_count>0 OR v_status='without-exams' AND u.exam_count=0 OR v_status='deletion-pending' AND u.status='deleting');
    SELECT coalesce(jsonb_agg(private.user_json(r)),'[]'::jsonb) INTO v_items FROM (
      SELECT u.* FROM private.admin_users u WHERE (v_search='' OR position(lower(v_search) in lower(coalesce(u.display_name,'')||' '||coalesce(u.email,'')))>0) AND (v_status='all' OR v_status='with-exams' AND u.exam_count>0 OR v_status='without-exams' AND u.exam_count=0 OR v_status='deletion-pending' AND u.status='deleting')
      ORDER BY CASE WHEN v_sort='name' AND v_direction='asc' THEN lower(u.display_name) END ASC NULLS LAST,CASE WHEN v_sort='name' AND v_direction='desc' THEN lower(u.display_name) END DESC NULLS LAST,
        CASE WHEN v_sort='email' AND v_direction='asc' THEN lower(u.email) END ASC,CASE WHEN v_sort='email' AND v_direction='desc' THEN lower(u.email) END DESC,
        CASE WHEN v_sort='created_at' AND v_direction='asc' THEN u.created_at END ASC,CASE WHEN v_sort='created_at' AND v_direction='desc' THEN u.created_at END DESC,
        CASE WHEN v_sort='last_completed_at' AND v_direction='asc' THEN u.last_completed_at END ASC NULLS LAST,CASE WHEN v_sort='last_completed_at' AND v_direction='desc' THEN u.last_completed_at END DESC NULLS LAST,u.id
      LIMIT v_size OFFSET (v_page-1)*v_size
    ) r;
    RETURN jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pageSize',v_size);
  ELSIF p_action='user' THEN
    SELECT * INTO v_user_row FROM private.admin_users WHERE id=v_user;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
    RETURN private.user_json(v_user_row)||jsonb_build_object('state',private.state_json(v_user),'hasActiveSession',EXISTS(SELECT 1 FROM public.active_sessions WHERE user_id=v_user),'performance',private.performance_summary(v_user),'deletionOperation',(SELECT jsonb_build_object('operationId',id,'status',status,'deletedCount',deleted_count,'state',private.state_json(v_user)) FROM private.admin_operations WHERE user_id=v_user AND action='delete_account' ORDER BY created_at DESC LIMIT 1));
  ELSIF p_action='attempts' THEN
    v_filter:=coalesce(p_args->'filter','{}'::jsonb);v_page:=coalesce((v_filter->>'page')::integer,1);v_size:=coalesce((v_filter->>'pageSize')::integer,20);
    IF v_page<1 OR v_page>1000000 OR v_size NOT IN (20,50) THEN RAISE EXCEPTION 'INVALID_FILTER';END IF;
    SELECT count(*) INTO v_total FROM private.filtered_attempts(v_user,v_filter);
    SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO v_items FROM (SELECT * FROM private.filtered_attempts(v_user,v_filter) LIMIT v_size OFFSET (v_page-1)*v_size) r;
    RETURN jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pageSize',v_size);
  ELSIF p_action='audit' THEN
    IF p_args->>'action' IS NOT NULL AND p_args->>'action' NOT IN ('login_success','login_failure','logout','reauth_success','reauth_failure','delete_attempts','reset','delete_account','delete_retry','selection') THEN RAISE EXCEPTION 'INVALID_FILTER';END IF;
    IF p_args->>'status' IS NOT NULL AND p_args->>'status' NOT IN ('succeeded','failed','partial','pending','complete','prepared','app_data_removed','auth_delete_pending','auth_delete_failed') THEN RAISE EXCEPTION 'INVALID_FILTER';END IF;
    SELECT count(*) INTO v_total FROM private.admin_audit a WHERE (p_args->>'action' IS NULL OR a.action=p_args->>'action') AND (p_args->>'status' IS NULL OR a.status=p_args->>'status') AND (p_args->>'targetId' IS NULL OR a.target_id=(p_args->>'targetId')::uuid);
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'actorId',r.actor_id,'targetId',r.target_id,'operationId',r.operation_id,'action',r.action,'status',r.status,'count',r.count,'createdAt',r.created_at,'operationStatus',(SELECT status FROM private.admin_operations WHERE id=r.operation_id))),'[]'::jsonb) INTO v_items FROM (
      SELECT * FROM private.admin_audit a WHERE (p_args->>'action' IS NULL OR a.action=p_args->>'action') AND (p_args->>'status' IS NULL OR a.status=p_args->>'status') AND (p_args->>'targetId' IS NULL OR a.target_id=(p_args->>'targetId')::uuid) ORDER BY a.created_at DESC,a.id LIMIT v_size OFFSET (v_page-1)*v_size
    ) r;
    RETURN jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pageSize',v_size);
  ELSIF p_action IN ('selection','selection_get','exclude') THEN
    PERFORM private.lock_target(v_actor,v_user);
    IF p_args->>'selectionId' IS NOT NULL THEN
      v_selection:=private.validate_selection((p_args->>'selectionId')::uuid,v_actor,v_session,v_user);
      IF p_action<>'exclude' THEN RETURN private.selection_json(v_selection);END IF;
      SELECT coalesce(array_agg(DISTINCT value::uuid),'{}'::uuid[]) INTO v_excluded FROM jsonb_array_elements_text(p_args->'ids');
      IF NOT v_excluded<@v_selection.ids THEN RAISE EXCEPTION 'SELECTION_STALE';END IF;
      SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO v_ids FROM unnest(v_selection.ids) id WHERE NOT(id=ANY(v_excluded));
      v_filter:=v_selection.query;v_status:='ids';
    ELSE
      v_status:=p_args->>'kind';v_filter:=coalesce(p_args->'filter','{}'::jsonb);
      IF v_status IN ('matching','reset') THEN
        SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO v_ids FROM private.filtered_attempts(v_user,CASE WHEN v_status='reset' THEN '{}'::jsonb ELSE v_filter END);
      ELSIF v_status='ids' AND jsonb_typeof(p_args->'ids')='array' THEN
        SELECT coalesce(array_agg(DISTINCT value::uuid ORDER BY value::uuid),'{}'::uuid[]) INTO v_ids FROM jsonb_array_elements_text(p_args->'ids');
        IF (SELECT count(*) FROM public.exam_attempts WHERE user_id=v_user AND id=ANY(v_ids))<>cardinality(v_ids) THEN RAISE EXCEPTION 'SELECTION_STALE';END IF;
      ELSE RAISE EXCEPTION 'INVALID_REQUEST';END IF;
    END IF;
    SELECT * INTO v_data FROM private.user_data_state WHERE user_id=v_user;
    INSERT INTO private.admin_selections(actor_id,session_id,user_id,kind,query,ids,generation,revision) VALUES(v_actor,v_session,v_user,v_status,v_filter,v_ids,v_data.generation,v_data.revision) RETURNING * INTO v_selection;
    RETURN private.selection_json(v_selection);
  ELSIF p_action IN ('delete_attempts','reset','delete_prepare') THEN
    v_id:=(p_args->>'operationId')::uuid;
    IF v_id IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
    v_fingerprint:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'actor',v_actor,'session',v_session,'user',v_user,'selection',p_args->>'selectionId','email',p_args->>'typedEmail')::text,'UTF8')),'hex');
    -- A global operation lock also serializes conflicting reuse against a different target.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_id::text,0));
    SELECT * INTO v_operation FROM private.admin_operations WHERE id=v_id FOR UPDATE;
    IF FOUND THEN
      IF v_operation.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'ID_CONFLICT';END IF;
      RETURN v_operation.result;
    END IF;
    PERFORM private.lock_target(v_actor,v_user);
    IF p_action='delete_prepare' THEN
      SELECT email INTO v_email FROM auth.users WHERE id=v_user;
      IF p_args->>'typedEmail' IS DISTINCT FROM v_email OR v_email IS NULL THEN RAISE EXCEPTION 'EMAIL_MISMATCH';END IF;
      SELECT count(*) INTO v_count FROM public.exam_attempts WHERE user_id=v_user;
      INSERT INTO private.admin_operations(id,actor_id,session_id,user_id,action,fingerprint,status,deleted_count) VALUES(v_id,v_actor,v_session,v_user,'delete_account',v_fingerprint,'prepared',v_count);
      UPDATE private.user_data_state SET generation=generation+1,revision=revision+1,status='deleting',progress_coverage='complete',incomplete_attempt_count=0 WHERE user_id=v_user;
      DELETE FROM public.exam_attempts WHERE user_id=v_user;DELETE FROM public.active_sessions WHERE user_id=v_user;DELETE FROM public.user_progress WHERE user_id=v_user;DELETE FROM public.profiles WHERE id=v_user;
      v_status:='app_data_removed';
    ELSE
      v_selection:=private.validate_selection((p_args->>'selectionId')::uuid,v_actor,v_session,v_user);
      IF (p_action='reset') IS DISTINCT FROM (v_selection.kind='reset') OR (p_action='delete_attempts' AND cardinality(v_selection.ids)=0) THEN RAISE EXCEPTION 'SELECTION_STALE';END IF;
      v_count:=cardinality(v_selection.ids);
      INSERT INTO private.admin_operations(id,actor_id,session_id,user_id,action,fingerprint,status,deleted_count) VALUES(v_id,v_actor,v_session,v_user,p_action,v_fingerprint,'prepared',v_count);
      IF p_action='reset' THEN
        DELETE FROM public.exam_attempts WHERE user_id=v_user;DELETE FROM public.active_sessions WHERE user_id=v_user;DELETE FROM public.user_progress WHERE user_id=v_user;
        UPDATE private.user_data_state SET generation=generation+1 WHERE user_id=v_user;
      ELSE
        INSERT INTO private.attempt_tombstones(user_id,attempt_id,operation_id) SELECT v_user,id,v_id FROM unnest(v_selection.ids) id;
        DELETE FROM public.exam_attempts WHERE user_id=v_user AND id=ANY(v_selection.ids);
      END IF;
      PERFORM private.rebuild_user_progress(v_user);
      UPDATE private.user_data_state SET revision=revision+1 WHERE user_id=v_user;
      UPDATE private.admin_selections SET consumed=true WHERE id=v_selection.id;v_status:='succeeded';
    END IF;
    v_result:=jsonb_build_object('operationId',v_id,'userId',v_user,'status',v_status,'deletedCount',v_count,'state',private.state_json(v_user));
    UPDATE private.admin_operations SET status=v_status,result=v_result,updated_at=now() WHERE id=v_id;
    INSERT INTO private.admin_audit(actor_id,target_id,operation_id,action,status,count) VALUES(v_actor,v_user,v_id,CASE WHEN p_action='delete_prepare' THEN 'delete_account' ELSE p_action END,CASE WHEN p_action='delete_prepare' THEN 'partial' ELSE 'succeeded' END,v_count);
    RETURN v_result;
  ELSIF p_action IN ('delete_claim','delete_finish') THEN
    v_id:=(p_args->>'operationId')::uuid;
    SELECT * INTO v_operation FROM private.admin_operations WHERE id=v_id AND action='delete_account' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
    v_user:=v_operation.user_id;PERFORM private.lock_target(v_actor,v_user,false);
    IF v_operation.status='complete' THEN
      RETURN CASE WHEN p_action='delete_claim' THEN v_operation.result||jsonb_build_object('claimed',false) ELSE v_operation.result END;
    END IF;
    IF p_action='delete_claim' THEN
      IF v_operation.lease_until>now() THEN RETURN v_operation.result||jsonb_build_object('claimed',false);END IF;
      v_lease:=gen_random_uuid();v_status:='auth_delete_pending';
      UPDATE private.admin_operations SET status=v_status,lease_until=now()+interval '30 seconds',lease_actor_id=v_actor,lease_session_id=v_session,lease_token=v_lease,attempts=attempts+1,error_code=NULL,updated_at=now() WHERE id=v_id;
      v_result:=v_operation.result||jsonb_build_object('status',v_status);
      UPDATE private.admin_operations SET result=v_result WHERE id=v_id;
      INSERT INTO private.admin_audit(actor_id,target_id,operation_id,action,status,count) VALUES(v_actor,v_user,v_id,'delete_retry','pending',v_operation.deleted_count);
      RETURN v_result||jsonb_build_object('claimed',true,'leaseToken',v_lease);
    END IF;
    IF v_operation.lease_token IS DISTINCT FROM (p_args->>'leaseToken')::uuid OR v_operation.lease_token IS NULL OR v_operation.lease_actor_id IS DISTINCT FROM v_actor OR v_operation.lease_session_id IS DISTINCT FROM v_session THEN RAISE EXCEPTION 'LEASE_CONFLICT';END IF;
    IF p_args->>'outcome'='complete' THEN
      IF EXISTS(SELECT 1 FROM auth.users WHERE id=v_user) THEN RAISE EXCEPTION 'AUTH_STILL_EXISTS';END IF;
      DELETE FROM public.exam_attempts WHERE user_id=v_user;DELETE FROM public.active_sessions WHERE user_id=v_user;DELETE FROM public.user_progress WHERE user_id=v_user;DELETE FROM public.profiles WHERE id=v_user;
      UPDATE private.user_data_state SET status='deleted' WHERE user_id=v_user;v_status:='complete';
    ELSIF p_args->>'outcome'='failed' THEN v_status:='auth_delete_failed';
    ELSIF p_args->>'outcome'='pending' THEN v_status:='auth_delete_pending';
    ELSE RAISE EXCEPTION 'INVALID_REQUEST';END IF;
    v_result:=jsonb_build_object('operationId',v_id,'userId',v_user,'status',v_status,'deletedCount',v_operation.deleted_count,'state',private.state_json(v_user));
    UPDATE private.admin_operations SET status=v_status,result=v_result,lease_until=NULL,lease_token=NULL,lease_actor_id=NULL,lease_session_id=NULL,
      error_code=CASE WHEN p_args->>'errorCode' IN ('AUTH_DELETE_FAILED','AUTH_UNCERTAIN','AUTH_DEPENDENCY','AUTH_UNAVAILABLE') THEN p_args->>'errorCode' WHEN v_status<>'complete' THEN 'AUTH_DELETE_FAILED' ELSE NULL END,updated_at=now() WHERE id=v_id;
    INSERT INTO private.admin_audit(actor_id,target_id,operation_id,action,status,count) VALUES(v_actor,v_user,v_id,'delete_account',CASE WHEN v_status='complete' THEN 'succeeded' WHEN v_status='auth_delete_failed' THEN 'failed' ELSE 'pending' END,v_operation.deleted_count);
    RETURN v_result;
  END IF;
  RAISE EXCEPTION 'INVALID_ACTION';
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.live_user(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_console(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_console(text,jsonb) TO service_role;
