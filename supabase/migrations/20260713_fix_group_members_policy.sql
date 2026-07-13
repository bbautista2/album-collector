BEGIN;

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_group_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Ver grupos donde soy miembro" ON public.private_groups;

CREATE POLICY "Ver grupos donde soy miembro" ON public.private_groups
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_group_member(private_groups.id, auth.uid())
  );

DROP POLICY IF EXISTS "Ver miembros de mi grupo" ON public.group_members;

CREATE POLICY "Ver miembros de mi grupo" ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_group_member(group_members.group_id, auth.uid())
  );

COMMIT;
