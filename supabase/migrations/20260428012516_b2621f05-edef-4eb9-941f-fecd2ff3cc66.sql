-- Allow volunteers to insert their own confirmation when assigned
CREATE POLICY "volunteer insert own confirmation"
ON public.confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  church_id = current_church_id()
  AND EXISTS (
    SELECT 1 FROM public.volunteers v
    WHERE v.id = confirmations.volunteer_id
      AND v.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.schedule_assignments sa
    WHERE sa.id = confirmations.assignment_id
      AND sa.volunteer_id = confirmations.volunteer_id
  )
);

-- Ensure unique confirmation per (assignment, volunteer) so upsert works
CREATE UNIQUE INDEX IF NOT EXISTS confirmations_assignment_volunteer_uniq
  ON public.confirmations (assignment_id, volunteer_id);