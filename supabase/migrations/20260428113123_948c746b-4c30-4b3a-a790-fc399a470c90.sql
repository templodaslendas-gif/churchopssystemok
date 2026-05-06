CREATE OR REPLACE FUNCTION public.respond_to_assignment(_assignment_id uuid, _status confirmation_status, _message text DEFAULT NULL::text)
 RETURNS confirmations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_volunteer_id uuid;
  v_church_id uuid;
  v_assignment_volunteer uuid;
  v_assignment_church uuid;
  v_existing_status confirmation_status;
  v_row public.confirmations;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _status NOT IN ('confirmed','declined','substitution_requested') THEN
    RAISE EXCEPTION 'invalid status %', _status;
  END IF;

  SELECT sa.volunteer_id, sa.church_id
    INTO v_assignment_volunteer, v_assignment_church
  FROM public.schedule_assignments sa
  WHERE sa.id = _assignment_id;

  IF v_assignment_volunteer IS NULL THEN
    RAISE EXCEPTION 'assignment not found';
  END IF;

  SELECT v.id, v.church_id INTO v_volunteer_id, v_church_id
  FROM public.volunteers v
  WHERE v.user_id = v_user
    AND v.id = v_assignment_volunteer
  LIMIT 1;

  IF v_volunteer_id IS NULL THEN
    SELECT v.id, v.church_id INTO v_volunteer_id, v_church_id
    FROM public.volunteers v
    JOIN auth.users u ON lower(u.email) = lower(v.email)
    WHERE u.id = v_user
      AND v.id = v_assignment_volunteer
    LIMIT 1;
  END IF;

  IF v_volunteer_id IS NULL THEN
    RAISE EXCEPTION 'this assignment does not belong to you';
  END IF;

  IF v_church_id <> v_assignment_church THEN
    RAISE EXCEPTION 'church mismatch';
  END IF;

  -- Trava: não permite alterar resposta já registrada
  SELECT status INTO v_existing_status
  FROM public.confirmations
  WHERE assignment_id = _assignment_id
  LIMIT 1;

  IF v_existing_status IS NOT NULL AND v_existing_status <> 'pending' THEN
    RAISE EXCEPTION 'Resposta já registrada. Procure o líder para alterações.';
  END IF;

  INSERT INTO public.confirmations (church_id, assignment_id, volunteer_id, status, responded_at, message)
  VALUES (v_church_id, _assignment_id, v_volunteer_id, _status, now(), _message)
  ON CONFLICT (assignment_id) DO UPDATE
    SET status = EXCLUDED.status,
        responded_at = now(),
        message = COALESCE(EXCLUDED.message, public.confirmations.message),
        volunteer_id = EXCLUDED.volunteer_id,
        church_id = EXCLUDED.church_id,
        updated_at = now()
  RETURNING * INTO v_row;

  IF _status = 'substitution_requested' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.substitutions
      WHERE assignment_id = _assignment_id AND status = 'open'
    ) THEN
      INSERT INTO public.substitutions (church_id, assignment_id, requested_by, reason, status)
      VALUES (v_church_id, _assignment_id, v_volunteer_id, _message, 'open');
    END IF;
  END IF;

  RETURN v_row;
END;
$function$;