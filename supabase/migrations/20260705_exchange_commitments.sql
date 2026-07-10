-- ============================================================================
-- MIGRACIÓN: Intercambios pendientes y completados
-- Fecha: 2026-07-05
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.exchange_commitments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  counterparty_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL REFERENCES public.stickers(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_exchange_commitments_created_by
  ON public.exchange_commitments(created_by);

CREATE INDEX IF NOT EXISTS idx_exchange_commitments_counterparty
  ON public.exchange_commitments(counterparty_id);

CREATE INDEX IF NOT EXISTS idx_exchange_commitments_album_status
  ON public.exchange_commitments(album_id, status);

CREATE INDEX IF NOT EXISTS idx_exchange_commitments_sticker
  ON public.exchange_commitments(sticker_id);

ALTER TABLE public.exchange_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver intercambios propios" ON public.exchange_commitments;
DROP POLICY IF EXISTS "Crear intercambios propios" ON public.exchange_commitments;
DROP POLICY IF EXISTS "Actualizar intercambios propios" ON public.exchange_commitments;
DROP POLICY IF EXISTS "Eliminar intercambios propios" ON public.exchange_commitments;

CREATE POLICY "Ver intercambios propios" ON public.exchange_commitments
  FOR SELECT
  USING (auth.uid() = created_by OR auth.uid() = counterparty_id);

CREATE POLICY "Crear intercambios propios" ON public.exchange_commitments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Actualizar intercambios propios" ON public.exchange_commitments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Eliminar intercambios propios" ON public.exchange_commitments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

COMMENT ON TABLE public.exchange_commitments IS 'Compromisos de intercambio entre usuarios (pendiente/completado/cancelado)';
COMMENT ON COLUMN public.exchange_commitments.direction IS 'incoming: la figurita la recibo yo; outgoing: yo la entrego';
COMMENT ON COLUMN public.exchange_commitments.status IS 'Estado del compromiso de intercambio';

COMMIT;
