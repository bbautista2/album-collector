-- ============================================================================
-- MIGRACIÓN: Añadir `album_sections` y adaptar `stickers` a `section_id`
-- Fecha: 2026-07-09
-- ============================================================================

BEGIN;

-- 1) Crear tabla album_sections
CREATE TABLE IF NOT EXISTS public.album_sections (
  id SERIAL PRIMARY KEY,
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  prefix VARCHAR NOT NULL DEFAULT '',
  total_stickers INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_album_sections_album_id ON public.album_sections(album_id);

-- 2) Añadir sección por defecto para álbumes existentes (sección 'Normal' sin prefijo)
INSERT INTO public.album_sections (album_id, name, prefix, total_stickers)
SELECT a.id, 'Normal', '', COALESCE(count_st.count, 0)
FROM public.albums a
LEFT JOIN (
  SELECT album_id, COUNT(*) AS count FROM public.stickers GROUP BY album_id
) AS count_st ON count_st.album_id = a.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.album_sections s WHERE s.album_id = a.id
);

-- 3) Preparar la tabla stickers para referenciar secciones
ALTER TABLE public.stickers
  ADD COLUMN IF NOT EXISTS section_id INT NULL;

-- 4) Migrar datos: asignar section_id usando la sección por defecto creada arriba
UPDATE public.stickers SET section_id = (
  SELECT id FROM public.album_sections s WHERE s.album_id = public.stickers.album_id ORDER BY id LIMIT 1
)
WHERE section_id IS NULL;

-- 5) Verificar que todas las figuras tienen section_id y luego eliminar album_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.stickers WHERE section_id IS NULL) THEN
    RAISE EXCEPTION 'Hay stickers sin section_id; la migración no puede continuar';
  END IF;
END $$;

-- Guardamos el album_id como redundante ya no necesario en stickers, así que lo eliminamos
ALTER TABLE public.stickers
  DROP CONSTRAINT IF EXISTS stickers_album_id_fkey;

ALTER TABLE public.stickers
  DROP COLUMN IF EXISTS album_id;

-- 6) Hacer section_id NOT NULL y agregar FK
ALTER TABLE public.stickers
  ALTER COLUMN section_id SET NOT NULL;

ALTER TABLE public.stickers
  ADD CONSTRAINT stickers_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.album_sections(id) ON DELETE CASCADE;

-- 7) Índices útiles
CREATE INDEX IF NOT EXISTS idx_stickers_section_number ON public.stickers(section_id, sticker_number);

-- 8) Actualizar total_stickers en album_sections basándonos en stickers
UPDATE public.album_sections SET total_stickers = sub.count FROM (
  SELECT section_id, COUNT(*) AS count FROM public.stickers GROUP BY section_id
) AS sub WHERE album_sections.id = sub.section_id;

-- 9) Habilitar RLS y crear políticas de acceso
ALTER TABLE public.album_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;

-- Policies for album_sections: only album owner can insert/update/delete; everyone authenticated can select
CREATE POLICY "Select album_sections" ON public.album_sections
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Insert album_sections authenticated" ON public.album_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.albums a WHERE a.id = album_sections.album_id AND a.created_by = auth.uid()
    )
  );

CREATE POLICY "Update album_sections owner" ON public.album_sections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.albums a WHERE a.id = album_sections.album_id AND a.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.albums a WHERE a.id = album_sections.album_id AND a.created_by = auth.uid()
    )
  );

CREATE POLICY "Delete album_sections owner" ON public.album_sections
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.albums a WHERE a.id = album_sections.album_id AND a.created_by = auth.uid()
    )
  );

-- Policies for stickers: restrict to album owner (via section -> album)
CREATE POLICY "Select stickers" ON public.stickers
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Insert stickers by album owner" ON public.stickers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.album_sections s JOIN public.albums a ON a.id = s.album_id
      WHERE s.id = public.stickers.section_id AND a.created_by = auth.uid()
    )
  );

CREATE POLICY "Update stickers by album owner" ON public.stickers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.album_sections s JOIN public.albums a ON a.id = s.album_id
      WHERE s.id = public.stickers.section_id AND a.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.album_sections s JOIN public.albums a ON a.id = s.album_id
      WHERE s.id = public.stickers.section_id AND a.created_by = auth.uid()
    )
  );

CREATE POLICY "Delete stickers by album owner" ON public.stickers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.album_sections s JOIN public.albums a ON a.id = s.album_id
      WHERE s.id = public.stickers.section_id AND a.created_by = auth.uid()
    )
  );

COMMIT;
