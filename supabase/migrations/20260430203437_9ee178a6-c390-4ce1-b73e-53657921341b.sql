-- 1. Enum for ministry-scoped roles
DO $$ BEGIN
  CREATE TYPE public.ministry_member_role AS ENUM ('leader', 'volunteer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add role column to volunteer_ministries
ALTER TABLE public.volunteer_ministries
  ADD COLUMN IF NOT EXISTS role public.ministry_member_role NOT NULL DEFAULT 'volunteer';

-- 3. Unique constraint to avoid duplicate volunteer-ministry links
DO $$ BEGIN
  ALTER TABLE public.volunteer_ministries
    ADD CONSTRAINT volunteer_ministries_volunteer_ministry_unique UNIQUE (volunteer_id, ministry_id);
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN duplicate_table THEN NULL;
END $$;

-- 4. Backfill: anyone whose user_id matches ministries.leader_id becomes 'leader'
UPDATE public.volunteer_ministries vm
   SET role = 'leader'
  FROM public.volunteers v, public.ministries m
 WHERE vm.volunteer_id = v.id
   AND vm.ministry_id = m.id
   AND v.user_id IS NOT NULL
   AND v.user_id = m.leader_id;

-- 5. Helper function: is this user a leader of this ministry?
CREATE OR REPLACE FUNCTION public.is_ministry_leader(_user_id uuid, _ministry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.volunteer_ministries vm
      JOIN public.volunteers v ON v.id = vm.volunteer_id
     WHERE vm.ministry_id = _ministry_id
       AND vm.role = 'leader'
       AND v.user_id = _user_id
  );
$$;

-- 6. Update RLS policies to use is_ministry_leader where ministry context exists

-- schedules: manage if super_admin/supervisor or leader of that ministry
DROP POLICY IF EXISTS "manage schedules" ON public.schedules;
CREATE POLICY "manage schedules" ON public.schedules
  FOR ALL TO authenticated
  USING (
    church_id = current_church_id() AND (
      has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'supervisor'::app_role])
      OR public.is_ministry_leader(auth.uid(), ministry_id)
      OR has_role(auth.uid(), 'ministry_leader'::app_role) -- legacy compat
    )
  )
  WITH CHECK (
    church_id = current_church_id() AND (
      has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'supervisor'::app_role])
      OR public.is_ministry_leader(auth.uid(), ministry_id)
      OR has_role(auth.uid(), 'ministry_leader'::app_role)
    )
  );

-- schedule_assignments: derive ministry via schedule
DROP POLICY IF EXISTS "manage assignments" ON public.schedule_assignments;
CREATE POLICY "manage assignments" ON public.schedule_assignments
  FOR ALL TO authenticated
  USING (
    church_id = current_church_id() AND (
      has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'supervisor'::app_role])
      OR EXISTS (
        SELECT 1 FROM public.schedules s
         WHERE s.id = schedule_assignments.schedule_id
           AND public.is_ministry_leader(auth.uid(), s.ministry_id)
      )
      OR has_role(auth.uid(), 'ministry_leader'::app_role)
    )
  )
  WITH CHECK (
    church_id = current_church_id() AND (
      has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'supervisor'::app_role])
      OR EXISTS (
        SELECT 1 FROM public.schedules s
         WHERE s.id = schedule_assignments.schedule_id
           AND public.is_ministry_leader(auth.uid(), s.ministry_id)
      )
      OR has_role(auth.uid(), 'ministry_leader'::app_role)
    )
  );

-- substitutions update: leaders of the relevant ministry can approve
DROP POLICY IF EXISTS "leaders update subs" ON public.substitutions;
CREATE POLICY "leaders update subs" ON public.substitutions
  FOR UPDATE TO authenticated
  USING (
    church_id = current_church_id() AND (
      has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'supervisor'::app_role])
      OR EXISTS (
        SELECT 1 FROM public.schedule_assignments sa
        JOIN public.schedules s ON s.id = sa.schedule_id
         WHERE sa.id = substitutions.assignment_id
           AND public.is_ministry_leader(auth.uid(), s.ministry_id)
      )
      OR has_role(auth.uid(), 'ministry_leader'::app_role)
    )
  );

-- ministry_roles: leader of that ministry can manage
DROP POLICY IF EXISTS "manage ministry roles" ON public.ministry_roles;
CREATE POLICY "manage ministry roles" ON public.ministry_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministries m
       WHERE m.id = ministry_roles.ministry_id
         AND m.church_id = current_church_id()
         AND (
           has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'supervisor'::app_role])
           OR public.is_ministry_leader(auth.uid(), m.id)
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministries m
       WHERE m.id = ministry_roles.ministry_id
         AND m.church_id = current_church_id()
         AND (
           has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'supervisor'::app_role])
           OR public.is_ministry_leader(auth.uid(), m.id)
         )
    )
  );

-- volunteer_ministries: leaders of the ministry can manage their members
DROP POLICY IF EXISTS "manage volunteer ministries" ON public.volunteer_ministries;
CREATE POLICY "manage volunteer ministries" ON public.volunteer_ministries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.volunteers v
       WHERE v.id = volunteer_ministries.volunteer_id
         AND v.church_id = current_church_id()
         AND (
           has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'supervisor'::app_role])
           OR public.is_ministry_leader(auth.uid(), volunteer_ministries.ministry_id)
           OR has_role(auth.uid(), 'ministry_leader'::app_role)
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.volunteers v
       WHERE v.id = volunteer_ministries.volunteer_id
         AND v.church_id = current_church_id()
         AND (
           has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'supervisor'::app_role])
           OR public.is_ministry_leader(auth.uid(), volunteer_ministries.ministry_id)
           OR has_role(auth.uid(), 'ministry_leader'::app_role)
         )
    )
  );