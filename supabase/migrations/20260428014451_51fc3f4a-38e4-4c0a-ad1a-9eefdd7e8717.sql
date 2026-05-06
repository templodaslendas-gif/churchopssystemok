CREATE OR REPLACE FUNCTION public.respond_to_assignment(
  _assignment_id uuid,
  _status public.confirmation_status,
  _message text DEFAULT NULL
)
RETURNS public.confirmations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_volunteer_id uuid;
  v_church_id uuid;
  v_assignment_volunteer uuid;
  v_assignment_church uuid;
  v_row public.confirmations;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
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
    RAISE EXCEPTION 'this assignment does not belong to you';
  END IF;

  IF v_church_id <> v_assignment_church THEN
    RAISE EXCEPTION 'church mismatch';
  END IF;

  INSERT INTO public.confirmations (church_id, assignment_id, volunteer_id, status, responded_at, message)
  VALUES (v_church_id, _assignment_id, v_volunteer_id, _status, now(), _message)
  ON CONFLICT (assignment_id) DO UPDATE
    SET status = EXCLUDED.status,
        responded_at = EXCLUDED.responded_at,
        message = COALESCE(EXCLUDED.message, public.confirmations.message),
        volunteer_id = EXCLUDED.volunteer_id,
        church_id = EXCLUDED.church_id,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_assignment(uuid, public.confirmation_status, text) TO authenticated;