-- Habilitar la extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLA: profiles
-- Almacena la información de perfil de cada usuario
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  city VARCHAR(100),
  country VARCHAR(100),
  is_public BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA: albums
-- Almacena la información de los álbumes creados por usuarios o por el sistema
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  total_stickers INTEGER NOT NULL,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA: stickers
-- Almacena las figuras individuales de cada álbum
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stickers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  sticker_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  category_or_team VARCHAR(100),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(album_id, sticker_number)
);

-- ============================================================================
-- TABLA: user_stickers
-- Rastreo de figuras del usuario: cuántas tiene y cuántas repetidas
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_stickers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL REFERENCES public.stickers(id) ON DELETE CASCADE,
  quantity_owned INTEGER DEFAULT 0 CHECK (quantity_owned >= 0),
  quantity_repeated INTEGER DEFAULT 0 CHECK (quantity_repeated >= 0),
  CONSTRAINT chk_user_stickers_repeated_lte_owned CHECK (quantity_repeated <= quantity_owned),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, sticker_id)
);

-- ============================================================================
-- TABLA: user_albums
-- Rastreo de los álbumes activados por cada usuario
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, album_id)
);

-- ============================================================================
-- TABLA: private_groups
-- Grupos privados creados por usuarios para intercambio de figuras
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.private_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code VARCHAR(20) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA: group_members
-- Miembros de los grupos privados
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.private_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
  UNIQUE(group_id, user_id)
);

-- ============================================================================
-- ÍNDICES para optimización
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_stickers_album_id ON public.stickers(album_id);
CREATE INDEX IF NOT EXISTS idx_stickers_album_id_number ON public.stickers(album_id, sticker_number);
CREATE INDEX IF NOT EXISTS idx_user_stickers_user_id ON public.user_stickers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stickers_sticker_id ON public.user_stickers(sticker_id);
CREATE INDEX IF NOT EXISTS idx_user_stickers_user_owned_sticker ON public.user_stickers(user_id, quantity_owned, sticker_id);
CREATE INDEX IF NOT EXISTS idx_albums_created_by ON public.albums(created_by);
CREATE INDEX IF NOT EXISTS idx_user_albums_user_id ON public.user_albums(user_id);
CREATE INDEX IF NOT EXISTS idx_user_albums_album_id ON public.user_albums(album_id);
CREATE INDEX IF NOT EXISTS idx_private_groups_created_by ON public.private_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_private_groups_invite_code ON public.private_groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_city_country ON public.profiles(city, country);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Habilitar en todas las tablas
-- ============================================================================

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS RLS: PROFILES
-- ============================================================================

-- Cualquiera puede ver perfiles públicos
CREATE POLICY "Ver perfiles públicos" ON public.profiles
  FOR SELECT
  USING (is_public = TRUE);

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Ver perfil propio" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Actualizar perfil propio" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Los usuarios pueden insertar su propio perfil (durante signup)
CREATE POLICY "Crear perfil propio" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- POLÍTICAS RLS: ALBUMS
-- Los álbumes son públicos y accesibles para todos
-- ============================================================================

CREATE POLICY "Leer álbumes" ON public.albums
  FOR SELECT
  USING (TRUE);

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

-- ============================================================================
-- POLÍTICAS RLS: STICKERS
-- Las figuras son públicas, pero solo el creador del álbum puede modificarlas
-- ============================================================================

CREATE POLICY "Leer figuras" ON public.stickers
  FOR SELECT
  USING (TRUE);

CREATE POLICY "Crear figuras en álbum propio" ON public.stickers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.albums
      WHERE albums.id = stickers.album_id
      AND albums.created_by = auth.uid()
    )
  );

CREATE POLICY "Actualizar figuras de álbum propio" ON public.stickers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.albums
      WHERE albums.id = stickers.album_id
      AND albums.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.albums
      WHERE albums.id = stickers.album_id
      AND albums.created_by = auth.uid()
    )
  );

CREATE POLICY "Eliminar figuras de álbum propio" ON public.stickers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.albums
      WHERE albums.id = stickers.album_id
      AND albums.created_by = auth.uid()
    )
  );

-- ============================================================================
-- POLÍTICAS RLS: USER_STICKERS
-- Los usuarios solo pueden ver/editar sus propias figuras
-- ============================================================================

CREATE POLICY "Ver mis figuras" ON public.user_stickers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Insertar mis figuras" ON public.user_stickers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Actualizar mis figuras" ON public.user_stickers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Eliminar mis figuras" ON public.user_stickers
  FOR DELETE
  USING (auth.uid() = user_id);

-- Miembros de grupo pueden ver figuras de otros miembros
CREATE POLICY "Ver figuras de miembros del grupo" ON public.user_stickers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm1
      WHERE gm1.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.group_members gm2
        WHERE gm2.group_id = gm1.group_id
        AND gm2.user_id = user_stickers.user_id
      )
    )
  );

-- ============================================================================
-- POLÍTICAS RLS: USER_ALBUMS
-- Los usuarios solo pueden ver/editar sus propios álbumes activados
-- ============================================================================

CREATE POLICY "Ver mis álbumes activados" ON public.user_albums
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Activar álbumes" ON public.user_albums
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Actualizar mis álbumes" ON public.user_albums
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Eliminar mis álbumes" ON public.user_albums
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- POLÍTICAS RLS: PRIVATE_GROUPS
-- Los miembros del grupo pueden ver el grupo
-- ============================================================================

CREATE POLICY "Ver grupos donde soy miembro" ON public.private_groups
  FOR SELECT
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = private_groups.id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Crear grupos privados" ON public.private_groups
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Actualizar mi grupo" ON public.private_groups
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Eliminar mi grupo" ON public.private_groups
  FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================================================
-- POLÍTICAS RLS: GROUP_MEMBERS
-- Solo miembros del grupo pueden ver los miembros
-- ============================================================================

CREATE POLICY "Ver miembros de mi grupo" ON public.group_members
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Unirse a grupo" ON public.group_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Dejar grupo" ON public.group_members
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================================

-- Función para generar código de invitación único
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
BEGIN
  RETURN SUBSTR(md5(RANDOM()::TEXT || CURRENT_TIMESTAMP::TEXT), 1, 12);
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar código de invitación automáticamente
CREATE OR REPLACE FUNCTION set_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := generate_invite_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invite_code
BEFORE INSERT ON public.private_groups
FOR EACH ROW
EXECUTE FUNCTION set_invite_code();

-- Trigger para asignar el creador del álbum automáticamente
CREATE OR REPLACE FUNCTION set_album_creator()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_album_creator
BEFORE INSERT ON public.albums
FOR EACH ROW
EXECUTE FUNCTION set_album_creator();

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER trigger_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_albums_updated_at
BEFORE UPDATE ON public.albums
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_user_stickers_updated_at
BEFORE UPDATE ON public.user_stickers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_private_groups_updated_at
BEFORE UPDATE ON public.private_groups
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- DATOS DE EJEMPLO (Opcional)
-- ============================================================================

-- Insertar álbum de ejemplo
INSERT INTO public.albums (title, description, total_stickers)
VALUES (
  'FIFA World Cup 2026',
  'Colecciona todas las figuras del Mundial 2026',
  640
)
ON CONFLICT DO NOTHING;

-- Insertar algunas figuras de ejemplo
-- (Esto es un ejemplo simplificado)
DO $$
DECLARE
  album_id UUID;
  sticker_number INT;
BEGIN
  SELECT id INTO album_id FROM public.albums WHERE title = 'FIFA World Cup 2026' LIMIT 1;
  
  FOR sticker_number IN 1..20 LOOP
    INSERT INTO public.stickers (album_id, sticker_number, name, category_or_team)
    VALUES (
      album_id,
      sticker_number,
      'Sticker ' || sticker_number,
      CASE 
        WHEN sticker_number <= 5 THEN 'Argentina'
        WHEN sticker_number <= 10 THEN 'Brazil'
        WHEN sticker_number <= 15 THEN 'France'
        ELSE 'Spain'
      END
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END$$;

-- ============================================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE public.profiles IS 'Perfiles de usuarios con información de ubicación y privacidad';
COMMENT ON TABLE public.albums IS 'Álbumes de figuras creados por usuarios o por el sistema';
COMMENT ON TABLE public.stickers IS 'Figuras individuales de cada álbum';
COMMENT ON TABLE public.user_stickers IS 'Rastreo de figuras del usuario (cantidad tenida y repetidas)';
COMMENT ON TABLE public.user_albums IS 'Rastreo de álbumes activados por usuario';
COMMENT ON TABLE public.private_groups IS 'Grupos privados para intercambio de figuras';
COMMENT ON TABLE public.group_members IS 'Miembros de grupos privados';

COMMENT ON COLUMN public.profiles.is_public IS 'Si es TRUE, otros usuarios pueden ver el perfil y sus figuras';
COMMENT ON COLUMN public.albums.created_by IS 'Usuario fundador del álbum; NULL si fue creado por el sistema';
COMMENT ON COLUMN public.user_stickers.quantity_owned IS 'Cantidad de figuras que el usuario tiene';
COMMENT ON COLUMN public.user_stickers.quantity_repeated IS 'Cantidad de figuras repetidas disponibles para intercambio';
COMMENT ON COLUMN public.private_groups.invite_code IS 'Código único para unirse al grupo';
