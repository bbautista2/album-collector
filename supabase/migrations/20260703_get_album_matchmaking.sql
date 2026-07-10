-- ============================================================================
-- MIGRACIÓN: RPC de matchmaking por álbum
-- Fecha: 2026-07-03
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_album_matchmaking(
  p_user_a UUID,
  p_user_b UUID,
  p_album_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF auth.uid() <> p_user_a THEN
    RAISE EXCEPTION 'p_user_a debe coincidir con el usuario autenticado';
  END IF;

  WITH album_stickers AS (
    SELECT s.id, s.sticker_number, s.name
    FROM public.stickers s
    WHERE s.album_id = p_album_id
  ),
  stickers_for_a AS (
    SELECT st.id, st.sticker_number, st.name
    FROM album_stickers st
    JOIN public.user_stickers us_b
      ON us_b.sticker_id = st.id
     AND us_b.user_id = p_user_b
     AND us_b.quantity_repeated > 0
    LEFT JOIN public.user_stickers us_a
      ON us_a.sticker_id = st.id
     AND us_a.user_id = p_user_a
    WHERE COALESCE(us_a.quantity_owned, 0) = 0
  ),
  stickers_for_b AS (
    SELECT st.id, st.sticker_number, st.name
    FROM album_stickers st
    JOIN public.user_stickers us_a
      ON us_a.sticker_id = st.id
     AND us_a.user_id = p_user_a
     AND us_a.quantity_repeated > 0
    LEFT JOIN public.user_stickers us_b
      ON us_b.sticker_id = st.id
     AND us_b.user_id = p_user_b
    WHERE COALESCE(us_b.quantity_owned, 0) = 0
  )
  SELECT jsonb_build_object(
    'stickers_for_a', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sfa.id,
            'number', sfa.sticker_number,
            'name', sfa.name
          )
          ORDER BY sfa.sticker_number
        )
        FROM stickers_for_a sfa
      ),
      '[]'::jsonb
    ),
    'stickers_for_b', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sfb.id,
            'number', sfb.sticker_number,
            'name', sfb.name
          )
          ORDER BY sfb.sticker_number
        )
        FROM stickers_for_b sfb
      ),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_album_matchmaking(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_album_matchmaking(UUID, UUID, UUID) TO authenticated;

COMMIT;
