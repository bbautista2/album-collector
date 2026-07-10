-- ============================================================================
-- MIGRACIÓN: Álbumes creados por usuarios + RLS de stickers
-- Fecha: 2026-06-20
-- ============================================================================

BEGIN;

ALTER TABLE public.albums
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.stickers
  ALTER COLUMN album_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_user_stickers_repeated_lte_owned'
      AND conrelid = 'public.user_stickers'::regclass
  ) THEN
    ALTER TABLE public.user_stickers
      ADD CONSTRAINT chk_user_stickers_repeated_lte_owned
      CHECK (quantity_repeated <= quantity_owned);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_albums_created_by
  ON public.albums(created_by);

CREATE INDEX IF NOT EXISTS idx_stickers_album_id_number
  ON public.stickers(album_id, sticker_number);

CREATE INDEX IF NOT EXISTS idx_user_stickers_user_owned_sticker
  ON public.user_stickers(user_id, quantity_owned, sticker_id);

DROP POLICY IF EXISTS "Admin: crear/actualizar álbumes" ON public.albums;
DROP POLICY IF EXISTS "Crear álbumes autenticado" ON public.albums;
DROP POLICY IF EXISTS "Actualizar álbum propio" ON public.albums;
DROP POLICY IF EXISTS "Eliminar álbum propio" ON public.albums;
DROP POLICY IF EXISTS "Crear figuras en álbum propio" ON public.stickers;
DROP POLICY IF EXISTS "Actualizar figuras de álbum propio" ON public.stickers;
DROP POLICY IF EXISTS "Eliminar figuras de álbum propio" ON public.stickers;

CREATE OR REPLACE FUNCTION set_album_creator()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_album_creator ON public.albums;
CREATE TRIGGER trigger_album_creator
BEFORE INSERT ON public.albums
FOR EACH ROW
EXECUTE FUNCTION set_album_creator();

CREATE POLICY "Crear álbumes autenticado" ON public.albums
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Actualizar álbum propio" ON public.albums
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Eliminar álbum propio" ON public.albums
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Crear figuras en álbum propio" ON public.stickers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.albums
      WHERE albums.id = stickers.album_id
        AND albums.created_by = auth.uid()
    )
  );

CREATE POLICY "Actualizar figuras de álbum propio" ON public.stickers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.albums
      WHERE albums.id = stickers.album_id
        AND albums.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.albums
      WHERE albums.id = stickers.album_id
        AND albums.created_by = auth.uid()
    )
  );

CREATE POLICY "Eliminar figuras de álbum propio" ON public.stickers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.albums
      WHERE albums.id = stickers.album_id
        AND albums.created_by = auth.uid()
    )
  );

COMMENT ON COLUMN public.albums.created_by IS 'Usuario fundador del álbum; NULL si fue creado por el sistema';

COMMIT;
