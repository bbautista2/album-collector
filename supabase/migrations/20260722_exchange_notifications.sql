-- ============================================================================
-- Migration: Exchange Notifications & Partner Finder
-- ============================================================================

-- 1. Tabla de notificaciones de intercambio
CREATE TABLE IF NOT EXISTS public.exchange_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL REFERENCES public.stickers(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_exchange_notifications_to_user ON public.exchange_notifications(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_exchange_notifications_from_user ON public.exchange_notifications(from_user_id, status);

-- RLS
ALTER TABLE public.exchange_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver notificaciones propias" ON public.exchange_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Crear solicitud de intercambio" ON public.exchange_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Actualizar notificación propia" ON public.exchange_notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);

-- 2. Función para buscar posibles partners de intercambio
CREATE OR REPLACE FUNCTION public.find_exchange_partners(
  p_user_id UUID,
  p_album_id UUID,
  p_sticker_id UUID
)
RETURNS TABLE (
  user_id UUID,
  username VARCHAR(50),
  city VARCHAR(100),
  repeated_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_city VARCHAR(100);
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Obtener la ciudad del usuario actual
  SELECT city INTO v_user_city FROM profiles WHERE id = p_user_id;

  -- Si el usuario no tiene ciudad, devolver vacío
  IF v_user_city IS NULL OR v_user_city = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.city,
    us.quantity_repeated
  FROM profiles p
  JOIN user_albums ua ON ua.user_id = p.id AND ua.album_id = p_album_id
  JOIN user_stickers us ON us.user_id = p.id AND us.sticker_id = p_sticker_id AND us.quantity_repeated > 0
  WHERE p.id != p_user_id
    AND LOWER(p.city) = LOWER(v_user_city)
    AND NOT EXISTS (
      SELECT 1 FROM exchange_notifications en
      WHERE en.from_user_id = p_user_id
        AND en.to_user_id = p.id
        AND en.album_id = p_album_id
        AND en.sticker_id = p_sticker_id
        AND en.status = 'pending'
    )
  ORDER BY us.quantity_repeated DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.find_exchange_partners(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_exchange_partners(UUID, UUID, UUID) TO authenticated;

-- 3. Habilitar Realtime para la tabla
ALTER PUBLICATION supabase_realtime ADD TABLE public.exchange_notifications;
