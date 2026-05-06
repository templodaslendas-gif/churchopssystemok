-- 1) Garantir valor 'substitution_requested' no enum confirmation_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'confirmation_status' AND e.enumlabel = 'substitution_requested'
  ) THEN
    ALTER TYPE public.confirmation_status ADD VALUE 'substitution_requested';
  END IF;
END$$;

-- 2) FK explícita ministries.leader_id -> profiles(id) para joins via PostgREST
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ministries_leader_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.ministries
      ADD CONSTRAINT ministries_leader_id_profiles_fkey
      FOREIGN KEY (leader_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 3) RPC para contar escalas do voluntário no mês (filtro confiável via SQL)
CREATE OR REPLACE FUNCTION public.count_volunteer_assignments_in_month(
  p_volunteer_id uuid,
  p_month_start timestamptz,
  p_month_end timestamptz
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.schedule_assignments sa
  JOIN public.schedules s ON s.id = sa.schedule_id
  JOIN public.events e ON e.id = s.event_id
  WHERE sa.volunteer_id = p_volunteer_id
    AND e.starts_at >= p_month_start
    AND e.starts_at <= p_month_end
    AND sa.church_id = public.current_church_id();
$$;

-- 4) Índice para acelerar a contagem mensal
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_volunteer_church
  ON public.schedule_assignments (volunteer_id, church_id);
