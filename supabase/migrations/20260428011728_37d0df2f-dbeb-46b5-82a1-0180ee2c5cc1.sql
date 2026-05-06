
-- 1) Reparar vínculos: para cada voluntário SEM user_id, encontrar usuário com mesmo e-mail (case-insensitive) na mesma igreja e vincular
UPDATE public.volunteers v
SET user_id = p.id
FROM public.profiles p
WHERE v.user_id IS NULL
  AND v.email IS NOT NULL
  AND p.email IS NOT NULL
  AND lower(v.email) = lower(p.email)
  AND v.church_id = p.church_id
  AND NOT EXISTS (SELECT 1 FROM public.volunteers v2 WHERE v2.user_id = p.id AND v2.church_id = p.church_id);

-- 2) Para casos em que existe um voluntário "vazio" (sem ministério/escala) ligado ao user_id, e outro voluntário com escalas mas sem user_id (mesmo e-mail / igreja) — migrar as referências para o voluntário com user_id e remover o duplicado.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT v_user.id AS keep_id, v_data.id AS dup_id
    FROM public.volunteers v_user
    JOIN public.volunteers v_data
      ON v_user.church_id = v_data.church_id
     AND v_user.id <> v_data.id
     AND v_user.user_id IS NOT NULL
     AND v_data.user_id IS NULL
     AND (
        (v_user.email IS NOT NULL AND v_data.email IS NOT NULL AND lower(v_user.email) = lower(v_data.email))
        OR upper(v_user.full_name) = upper(v_data.full_name)
     )
  LOOP
    -- mover assignments
    UPDATE public.schedule_assignments SET volunteer_id = r.keep_id WHERE volunteer_id = r.dup_id;
    -- mover confirmations
    UPDATE public.confirmations SET volunteer_id = r.keep_id WHERE volunteer_id = r.dup_id;
    -- mover volunteer_ministries (evitando duplicidade)
    INSERT INTO public.volunteer_ministries (volunteer_id, ministry_id, ministry_role_id)
      SELECT r.keep_id, ministry_id, ministry_role_id FROM public.volunteer_ministries WHERE volunteer_id = r.dup_id
      ON CONFLICT (volunteer_id, ministry_id, ministry_role_id) DO NOTHING;
    DELETE FROM public.volunteer_ministries WHERE volunteer_id = r.dup_id;
    -- mover substitutions
    UPDATE public.substitutions SET requested_by = r.keep_id WHERE requested_by = r.dup_id;
    UPDATE public.substitutions SET substitute_id = r.keep_id WHERE substitute_id = r.dup_id;
    -- remover duplicado
    DELETE FROM public.volunteers WHERE id = r.dup_id;
  END LOOP;
END $$;

-- 3) Reforçar handle_new_user: aceitar convite mesmo quando volunteer_id é NULL, vinculando voluntário existente por e-mail
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_church_id UUID;
  v_full_name TEXT;
  v_church_name TEXT;
  v_invite RECORD;
  v_token TEXT;
  v_existing_volunteer_id UUID;
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

      IF v_invite.role = 'volunteer' THEN
        -- Preferir o voluntário do convite
        IF v_invite.volunteer_id IS NOT NULL THEN
          UPDATE public.volunteers
            SET user_id = NEW.id,
                full_name = COALESCE(NULLIF(v_full_name, ''), full_name)
          WHERE id = v_invite.volunteer_id;
        ELSE
          -- Procurar voluntário existente sem user_id pelo e-mail
          SELECT id INTO v_existing_volunteer_id
          FROM public.volunteers
          WHERE church_id = v_church_id
            AND user_id IS NULL
            AND email IS NOT NULL
            AND lower(email) = lower(NEW.email)
          LIMIT 1;

          IF v_existing_volunteer_id IS NOT NULL THEN
            UPDATE public.volunteers
              SET user_id = NEW.id,
                  full_name = COALESCE(NULLIF(v_full_name, ''), full_name)
            WHERE id = v_existing_volunteer_id;
          ELSE
            INSERT INTO public.volunteers (church_id, user_id, full_name, email)
            VALUES (v_church_id, NEW.id, v_full_name, NEW.email);
          END IF;
        END IF;
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
    INSERT INTO public.profiles (id, full_name, email) VALUES (NEW.id, v_full_name, NEW.email);
  END IF;

  RETURN NEW;
END;
$function$;
