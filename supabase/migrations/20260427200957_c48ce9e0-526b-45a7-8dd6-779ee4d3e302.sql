
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'supervisor', 'ministry_leader', 'volunteer');
CREATE TYPE public.event_type AS ENUM ('culto', 'ensaio', 'evento_especial', 'reuniao');
CREATE TYPE public.confirmation_status AS ENUM ('pending', 'confirmed', 'declined', 'substitution_requested');
CREATE TYPE public.substitution_status AS ENUM ('open', 'accepted', 'rejected', 'cancelled');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- =========================================
-- CHURCHES
-- =========================================
CREATE TABLE public.churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- PROFILES (1:1 com auth.users)
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_church ON public.profiles(church_id);

-- =========================================
-- USER ROLES (separada para evitar privilege escalation)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, church_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_church ON public.user_roles(church_id);

-- =========================================
-- SECURITY DEFINER HELPERS
-- =========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_church_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT church_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_member_of_church(_church_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND church_id = _church_id
  );
$$;

-- =========================================
-- MINISTRIES
-- =========================================
CREATE TABLE public.ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  leader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ministries_church ON public.ministries(church_id);

CREATE TABLE public.ministry_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ministry_roles_ministry ON public.ministry_roles(ministry_id);

-- Helper: usuário é líder de um ministério?
CREATE OR REPLACE FUNCTION public.is_leader_of_ministry(_user_id UUID, _ministry_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ministries WHERE id = _ministry_id AND leader_id = _user_id
  );
$$;

-- =========================================
-- VOLUNTEERS
-- =========================================
CREATE TABLE public.volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  unavailable_weekdays INTEGER[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_volunteers_church ON public.volunteers(church_id);
CREATE INDEX idx_volunteers_user ON public.volunteers(user_id);

CREATE TABLE public.volunteer_ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID NOT NULL REFERENCES public.volunteers(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  ministry_role_id UUID REFERENCES public.ministry_roles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (volunteer_id, ministry_id, ministry_role_id)
);
CREATE INDEX idx_vm_volunteer ON public.volunteer_ministries(volunteer_id);
CREATE INDEX idx_vm_ministry ON public.volunteer_ministries(ministry_id);

-- =========================================
-- EVENTS
-- =========================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type public.event_type NOT NULL DEFAULT 'culto',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_church_date ON public.events(church_id, starts_at);

-- =========================================
-- SCHEDULES & ASSIGNMENTS
-- =========================================
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, ministry_id)
);
CREATE INDEX idx_schedules_church ON public.schedules(church_id);
CREATE INDEX idx_schedules_event ON public.schedules(event_id);

CREATE TABLE public.schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES public.volunteers(id) ON DELETE CASCADE,
  ministry_role_id UUID REFERENCES public.ministry_roles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, volunteer_id, ministry_role_id)
);
CREATE INDEX idx_sa_schedule ON public.schedule_assignments(schedule_id);
CREATE INDEX idx_sa_volunteer ON public.schedule_assignments(volunteer_id);

-- =========================================
-- CONFIRMATIONS
-- =========================================
CREATE TABLE public.confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.schedule_assignments(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES public.volunteers(id) ON DELETE CASCADE,
  status public.confirmation_status NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id)
);
CREATE INDEX idx_confirmations_volunteer ON public.confirmations(volunteer_id);

-- =========================================
-- SUBSTITUTIONS
-- =========================================
CREATE TABLE public.substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.schedule_assignments(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.volunteers(id) ON DELETE CASCADE,
  substitute_id UUID REFERENCES public.volunteers(id) ON DELETE SET NULL,
  reason TEXT,
  status public.substitution_status NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subs_church ON public.substitutions(church_id);
CREATE INDEX idx_subs_assignment ON public.substitutions(assignment_id);

-- =========================================
-- ABSENCES
-- =========================================
CREATE TABLE public.absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES public.volunteers(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_absences_volunteer ON public.absences(volunteer_id);

-- =========================================
-- CONFLICT RULES (1 por igreja)
-- =========================================
CREATE TABLE public.conflict_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL UNIQUE REFERENCES public.churches(id) ON DELETE CASCADE,
  block_same_time BOOLEAN NOT NULL DEFAULT TRUE,
  warn_same_day BOOLEAN NOT NULL DEFAULT TRUE,
  warn_frequency BOOLEAN NOT NULL DEFAULT TRUE,
  max_assignments_per_month INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- INVITATIONS
-- =========================================
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  ministry_id UUID REFERENCES public.ministries(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_church ON public.invitations(church_id);

-- =========================================
-- AUDIT LOGS
-- =========================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_church ON public.audit_logs(church_id);

-- =========================================
-- TRIGGER: updated_at
-- =========================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER t_churches_upd BEFORE UPDATE ON public.churches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_ministries_upd BEFORE UPDATE ON public.ministries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_volunteers_upd BEFORE UPDATE ON public.volunteers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_events_upd BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_schedules_upd BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_confirmations_upd BEFORE UPDATE ON public.confirmations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_subs_upd BEFORE UPDATE ON public.substitutions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_conflict_upd BEFORE UPDATE ON public.conflict_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- handle_new_user: cria profile + church (signup) ou aceita convite
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_church_id UUID;
  v_full_name TEXT;
  v_church_name TEXT;
  v_invite RECORD;
  v_token TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_church_name := NEW.raw_user_meta_data->>'church_name';
  v_token := NEW.raw_user_meta_data->>'invitation_token';

  IF v_token IS NOT NULL THEN
    SELECT * INTO v_invite FROM public.invitations
    WHERE token = v_token AND status = 'pending' AND expires_at > now()
    LIMIT 1;

    IF v_invite.id IS NOT NULL AND lower(v_invite.email) = lower(NEW.email) THEN
      v_church_id := v_invite.church_id;
      INSERT INTO public.profiles (id, church_id, full_name, email)
      VALUES (NEW.id, v_church_id, v_full_name, NEW.email);
      INSERT INTO public.user_roles (user_id, church_id, role)
      VALUES (NEW.id, v_church_id, v_invite.role);
      UPDATE public.invitations SET status = 'accepted', accepted_at = now() WHERE id = v_invite.id;

      -- Se for voluntário, cria entrada em volunteers
      IF v_invite.role = 'volunteer' THEN
        INSERT INTO public.volunteers (church_id, user_id, full_name, email)
        VALUES (v_church_id, NEW.id, v_full_name, NEW.email);
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  IF v_church_name IS NOT NULL THEN
    INSERT INTO public.churches (name, city)
    VALUES (v_church_name, NEW.raw_user_meta_data->>'church_city')
    RETURNING id INTO v_church_id;

    INSERT INTO public.profiles (id, church_id, full_name, email)
    VALUES (NEW.id, v_church_id, v_full_name, NEW.email);

    INSERT INTO public.user_roles (user_id, church_id, role)
    VALUES (NEW.id, v_church_id, 'super_admin');

    INSERT INTO public.conflict_rules (church_id) VALUES (v_church_id);
  ELSE
    -- Profile sem igreja (caso raro)
    INSERT INTO public.profiles (id, full_name, email) VALUES (NEW.id, v_full_name, NEW.email);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- ENABLE RLS
-- =========================================
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ministry_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================================
-- RLS POLICIES
-- =========================================

-- CHURCHES
CREATE POLICY "members can view own church" ON public.churches
  FOR SELECT TO authenticated USING (id = public.current_church_id());
CREATE POLICY "super admins can update church" ON public.churches
  FOR UPDATE TO authenticated USING (id = public.current_church_id() AND public.has_role(auth.uid(), 'super_admin'));

-- PROFILES
CREATE POLICY "users can view profiles in their church" ON public.profiles
  FOR SELECT TO authenticated USING (church_id = public.current_church_id() OR id = auth.uid());
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- USER_ROLES
CREATE POLICY "view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor']::public.app_role[])));
CREATE POLICY "super admin manages roles" ON public.user_roles
  FOR ALL TO authenticated USING (church_id = public.current_church_id() AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (church_id = public.current_church_id() AND public.has_role(auth.uid(), 'super_admin'));

-- MINISTRIES
CREATE POLICY "view ministries in church" ON public.ministries
  FOR SELECT TO authenticated USING (church_id = public.current_church_id());
CREATE POLICY "admins manage ministries" ON public.ministries
  FOR ALL TO authenticated USING (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor']::public.app_role[]))
  WITH CHECK (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor']::public.app_role[]));

-- MINISTRY ROLES
CREATE POLICY "view ministry roles" ON public.ministry_roles
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ministry_id AND m.church_id = public.current_church_id()));
CREATE POLICY "manage ministry roles" ON public.ministry_roles
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ministry_id AND m.church_id = public.current_church_id() AND (public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor']::public.app_role[]) OR m.leader_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ministry_id AND m.church_id = public.current_church_id() AND (public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor']::public.app_role[]) OR m.leader_id = auth.uid())));

-- VOLUNTEERS
CREATE POLICY "view volunteers in church" ON public.volunteers
  FOR SELECT TO authenticated USING (church_id = public.current_church_id());
CREATE POLICY "manage volunteers" ON public.volunteers
  FOR ALL TO authenticated USING (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]))
  WITH CHECK (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]));

-- VOLUNTEER_MINISTRIES
CREATE POLICY "view volunteer ministries" ON public.volunteer_ministries
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = volunteer_id AND v.church_id = public.current_church_id()));
CREATE POLICY "manage volunteer ministries" ON public.volunteer_ministries
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = volunteer_id AND v.church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = volunteer_id AND v.church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[])));

-- EVENTS
CREATE POLICY "view events in church" ON public.events
  FOR SELECT TO authenticated USING (church_id = public.current_church_id());
CREATE POLICY "manage events" ON public.events
  FOR ALL TO authenticated USING (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]))
  WITH CHECK (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]));

-- SCHEDULES
CREATE POLICY "view schedules in church" ON public.schedules
  FOR SELECT TO authenticated USING (church_id = public.current_church_id());
CREATE POLICY "manage schedules" ON public.schedules
  FOR ALL TO authenticated USING (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]))
  WITH CHECK (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]));

-- SCHEDULE_ASSIGNMENTS
CREATE POLICY "view assignments in church" ON public.schedule_assignments
  FOR SELECT TO authenticated USING (church_id = public.current_church_id());
CREATE POLICY "manage assignments" ON public.schedule_assignments
  FOR ALL TO authenticated USING (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]))
  WITH CHECK (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]));

-- CONFIRMATIONS
CREATE POLICY "view confirmations" ON public.confirmations
  FOR SELECT TO authenticated USING (
    church_id = public.current_church_id() AND (
      public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[])
      OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = volunteer_id AND v.user_id = auth.uid())
    )
  );
CREATE POLICY "leaders insert confirmations" ON public.confirmations
  FOR INSERT TO authenticated WITH CHECK (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]));
CREATE POLICY "update own or as leader" ON public.confirmations
  FOR UPDATE TO authenticated USING (
    church_id = public.current_church_id() AND (
      public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[])
      OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = volunteer_id AND v.user_id = auth.uid())
    )
  );

-- SUBSTITUTIONS
CREATE POLICY "view subs in church" ON public.substitutions
  FOR SELECT TO authenticated USING (church_id = public.current_church_id());
CREATE POLICY "volunteers and leaders create subs" ON public.substitutions
  FOR INSERT TO authenticated WITH CHECK (
    church_id = public.current_church_id() AND (
      public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[])
      OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = requested_by AND v.user_id = auth.uid())
    )
  );
CREATE POLICY "leaders update subs" ON public.substitutions
  FOR UPDATE TO authenticated USING (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]));

-- ABSENCES
CREATE POLICY "view absences in church" ON public.absences
  FOR SELECT TO authenticated USING (church_id = public.current_church_id());
CREATE POLICY "manage absences" ON public.absences
  FOR ALL TO authenticated USING (
    church_id = public.current_church_id() AND (
      public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[])
      OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = volunteer_id AND v.user_id = auth.uid())
    )
  )
  WITH CHECK (
    church_id = public.current_church_id() AND (
      public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[])
      OR EXISTS (SELECT 1 FROM public.volunteers v WHERE v.id = volunteer_id AND v.user_id = auth.uid())
    )
  );

-- CONFLICT RULES
CREATE POLICY "view conflict rules" ON public.conflict_rules
  FOR SELECT TO authenticated USING (church_id = public.current_church_id());
CREATE POLICY "super admin manages conflict rules" ON public.conflict_rules
  FOR ALL TO authenticated USING (church_id = public.current_church_id() AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (church_id = public.current_church_id() AND public.has_role(auth.uid(), 'super_admin'));

-- INVITATIONS
CREATE POLICY "view invitations in church" ON public.invitations
  FOR SELECT TO authenticated USING (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]));
CREATE POLICY "create invitations" ON public.invitations
  FOR INSERT TO authenticated WITH CHECK (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor','ministry_leader']::public.app_role[]));
CREATE POLICY "update invitations" ON public.invitations
  FOR UPDATE TO authenticated USING (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor']::public.app_role[]));

-- AUDIT LOGS
CREATE POLICY "view logs in church" ON public.audit_logs
  FOR SELECT TO authenticated USING (church_id = public.current_church_id() AND public.has_any_role(auth.uid(), ARRAY['super_admin','supervisor']::public.app_role[]));
CREATE POLICY "insert logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (church_id = public.current_church_id());
