
-- 1. Coluna volunteer_id em invitations
ALTER TABLE public.invitations
  ADD COLUMN volunteer_id uuid REFERENCES public.volunteers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invitations_volunteer_id ON public.invitations(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);

-- 2. Política de DELETE
CREATE POLICY "delete invitations"
ON public.invitations
FOR DELETE
TO authenticated
USING (
  church_id = current_church_id()
  AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'supervisor'::app_role])
);

-- 3. RPC pública para validar convite por token (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  email text,
  role app_role,
  ministry_id uuid,
  ministry_name text,
  church_id uuid,
  church_name text,
  volunteer_id uuid,
  volunteer_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.email,
    i.role,
    i.ministry_id,
    m.name AS ministry_name,
    i.church_id,
    c.name AS church_name,
    i.volunteer_id,
    v.full_name AS volunteer_name
  FROM public.invitations i
  LEFT JOIN public.churches c ON c.id = i.church_id
  LEFT JOIN public.ministries m ON m.id = i.ministry_id
  LEFT JOIN public.volunteers v ON v.id = i.volunteer_id
  WHERE i.token = _token
    AND i.status = 'pending'
    AND i.expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- 4. Atualiza handle_new_user para vincular voluntário existente
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

      -- Se convite tiver voluntário vinculado, apenas conecta o user_id
      IF v_invite.volunteer_id IS NOT NULL THEN
        UPDATE public.volunteers
          SET user_id = NEW.id,
              full_name = COALESCE(NULLIF(v_full_name, ''), full_name)
        WHERE id = v_invite.volunteer_id;
      ELSIF v_invite.role = 'volunteer' THEN
        -- Fallback: convite sem voluntário pré-cadastrado (compatibilidade)
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
    INSERT INTO public.profiles (id, full_name, email) VALUES (NEW.id, v_full_name, NEW.email);
  END IF;

  RETURN NEW;
END;
$function$;
