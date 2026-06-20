# Guía de Seguridad y RLS - Collector Project

## Descripción General

Este documento explica las políticas de Row Level Security (RLS) implementadas y cómo funcionan en el proyecto Collector.

## ¿Qué es Row Level Security (RLS)?

RLS es una función de PostgreSQL que permite controlar qué filas de una tabla puede ver/modificar cada usuario. Es el mecanismo de seguridad principal que garantiza que:

- ✅ Los usuarios solo vean sus propios datos privados
- ✅ Los usuarios solo vean datos que están autorizados a ver
- ✅ Los datos públicos sean accesibles apropiadamente

## Políticas RLS Implementadas

### 1. TABLA: profiles

#### Política: "Ver perfiles públicos"
```sql
FOR SELECT USING (is_public = TRUE)
```
- **Quién**: Cualquier usuario autenticado
- **Qué ve**: Todos los perfiles donde `is_public = TRUE`
- **Caso de uso**: Buscar coleccionistas públicos en tu ciudad

#### Política: "Ver perfil propio"
```sql
FOR SELECT USING (auth.uid() = id)
```
- **Quién**: El usuario propietario del perfil
- **Qué ve**: Su propio perfil (siempre visible para el dueño, aunque sea privado)
- **Caso de uso**: Configuración personal, ver todos los datos del perfil

#### Política: "Actualizar perfil propio"
```sql
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)
```
- **Quién**: El usuario propietario del perfil
- **Qué hace**: Solo actualiza su propio perfil
- **Caso de uso**: Cambiar avatar, ciudad, toggle de privacidad, etc.

#### Política: "Crear perfil propio"
```sql
FOR INSERT WITH CHECK (auth.uid() = id)
```
- **Quién**: Durante el signup, Supabase Auth crea automáticamente
- **Qué hace**: Solo crea un perfil con su propio UID
- **Caso de uso**: Primera vez que un usuario se registra

### 2. TABLA: albums

#### Política: "Leer álbumes"
```sql
FOR SELECT USING (TRUE)
```
- **Quién**: Cualquier usuario
- **Qué ve**: Todos los álbumes
- **Nota**: Los álbumes son públicos y compartidos globalmente

#### Política: "Admin: crear/actualizar álbumes"
```sql
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = 'admin')
)
```
- **Quién**: Solo usuarios con username = 'admin'
- **Qué hace**: Crear o actualizar álbumes
- **Nota**: Deberás crear manualmente un usuario admin con username 'admin'

### 3. TABLA: stickers

#### Política: "Leer figuras"
```sql
FOR SELECT USING (TRUE)
```
- **Quién**: Cualquier usuario
- **Qué ve**: Todas las figuras de todos los álbumes
- **Caso de uso**: Ver catálogo completo de figuras disponibles

### 4. TABLA: user_stickers

#### Política: "Ver mis figuras"
```sql
FOR SELECT USING (auth.uid() = user_id)
```
- **Quién**: El usuario propietario de las figuras
- **Qué ve**: Solo sus propias figuras
- **Caso de uso**: Tu colección personal

#### Política: "Ver figuras de miembros del grupo"
```sql
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_members gm1
    WHERE gm1.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM group_members gm2
      WHERE gm2.group_id = gm1.group_id
      AND gm2.user_id = user_stickers.user_id
    )
  )
)
```
- **Quién**: Miembros del mismo grupo privado
- **Qué ve**: Las figuras de otros miembros del grupo
- **Caso de uso**: Ver qué figuras repetidas tienen otros miembros para intercambiar

#### Políticas: "Insertar/Actualizar/Eliminar mis figuras"
```sql
FOR INSERT/UPDATE/DELETE
USING/WITH CHECK (auth.uid() = user_id)
```
- **Quién**: El usuario propietario
- **Qué hace**: Modificar solo sus propias figuras
- **Caso de uso**: Agregar figuras nuevas, marcar como repetidas

### 5. TABLA: user_albums

#### Políticas: Ver/crear/actualizar/eliminar álbumes del usuario
```sql
FOR SELECT USING (auth.uid() = user_id)
FOR INSERT WITH CHECK (auth.uid() = user_id)
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
FOR DELETE USING (auth.uid() = user_id)
```
- **Quién**: El usuario propietario
- **Qué hace**: Ver/gestionar qué álbumes ha activado
- **Caso de uso**: Activar el álbum "Mundial 2026" para comenzar a coleccionar

### 6. TABLA: private_groups

#### Política: "Ver grupos donde soy miembro"
```sql
FOR SELECT
USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = private_groups.id
    AND user_id = auth.uid()
  )
)
```
- **Quién**: El creador del grupo o miembros del grupo
- **Qué ve**: Solo grupos donde es miembro o creador
- **Caso de uso**: Acceder a grupos privados

#### Políticas: Crear/actualizar/eliminar grupos
```sql
FOR INSERT/UPDATE/DELETE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by)
```
- **Quién**: El creador del grupo
- **Qué hace**: Crear, actualizar y eliminar su propio grupo
- **Caso de uso**: Gestionar grupo privado

### 7. TABLA: group_members

#### Política: "Ver miembros de mi grupo"
```sql
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
  )
)
```
- **Quién**: Miembros del grupo
- **Qué ve**: Lista de miembros del grupo
- **Caso de uso**: Ver quién más está en el grupo

#### Política: "Unirse a grupo"
```sql
FOR INSERT WITH CHECK (auth.uid() = user_id)
```
- **Quién**: Cualquier usuario autenticado
- **Qué hace**: Agregarse a un grupo (después de validar el código)
- **Nota**: El frontend debe validar el código de invitación antes de insertar

#### Política: "Dejar grupo"
```sql
FOR DELETE USING (auth.uid() = user_id)
```
- **Quién**: El usuario miembro
- **Qué hace**: Eliminarse a sí mismo del grupo
- **Caso de uso**: Salir de un grupo

## Flujos de Seguridad

### Flujo 1: Registro de Usuario

```
1. Usuario completa formulario de signup
2. Supabase Auth crea auth.users con email/password
3. Trigger ejecuta política de INSERT en profiles
4. Se crea automáticamente una fila en profiles con:
   - id = UID del usuario (desde auth.users.id)
   - is_public = FALSE (privado por defecto)
```

### Flujo 2: Buscar Coleccionistas en Mi Ciudad

```
1. Usuario A (ciudad = "Buenos Aires", is_public = TRUE)
2. Usuario B busca "Buenos Aires"
3. Política "Ver perfiles públicos" permite ver el perfil de A
4. Usuario B puede ver figuras de A gracias a su es_public = TRUE
```

### Flujo 3: Unirse a Grupo Privado

```
1. Usuario A crea grupo privado → se genera invite_code único
2. Usuario A comparte link: /grupos/join?code=ABC123
3. Usuario B visita el link
4. Frontend valida el código en private_groups
5. Si es válido, inserta fila en group_members
6. Usuario B ahora es miembro del grupo
7. Puede ver figuras repetidas de otros miembros
```

### Flujo 4: Ver Figuras Repetidas de Miembro del Grupo

```
1. Usuario A es miembro del grupo X
2. Usuario B es miembro del grupo X
3. Usuario A consulta figuras de usuario B
4. Política de user_stickers verifica:
   - ¿A está en algún grupo?
   - ¿B está en el mismo grupo que A?
   - Si ambas son TRUE, permite ver
5. Usuario A ve quantity_repeated de B
```

## Testing de Políticas RLS

### Caso de Prueba 1: No poder ver perfil privado

```sql
-- Conectarse como Usuario A
SELECT * FROM profiles WHERE username = 'usuario_b_privado';
-- Resultado: No retorna nada (la política bloquea)

-- Conectarse como Usuario B
SELECT * FROM profiles WHERE username = 'usuario_b_privado';
-- Resultado: Retorna el perfil (es el suyo)
```

### Caso de Prueba 2: No poder ver figuras de otros usuarios

```sql
-- Conectarse como Usuario A
SELECT * FROM user_stickers WHERE user_id = 'UUID_de_usuario_b';
-- Resultado: No retorna nada (políticas bloquean)

-- Conectarse como Usuario B
SELECT * FROM user_stickers WHERE user_id = 'UUID_de_usuario_b';
-- Resultado: Retorna sus figuras
```

### Caso de Prueba 3: Ver figuras de miembro del grupo

```sql
-- Conectarse como Usuario A (miembro del grupo X)
SELECT * FROM user_stickers WHERE user_id = 'UUID_de_usuario_b';
-- Si Usuario B también es miembro del grupo X:
-- Resultado: Retorna figuras de B (la política lo permite)
```

## Mantenimiento y Administración

### Crear un Usuario Admin

```sql
-- Inserta un perfil con username 'admin'
INSERT INTO profiles (id, username, full_name, is_public)
VALUES ('UUID_del_usuario_admin', 'admin', 'Administrator', FALSE);
```

### Deshabilitar Temporalmente RLS (⚠️ CUIDADO)

```sql
-- Solo en desarrollo/testing
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Volver a habilitar
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### Ver Todas las Políticas

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

### Eliminar una Política

```sql
DROP POLICY "Ver perfiles públicos" ON profiles;
```

## Mejores Prácticas

### ✅ DO's

- ✅ Siempre usar `auth.uid()` para comparar con el usuario actual
- ✅ Probar políticas exhaustivamente
- ✅ Documentar el propósito de cada política
- ✅ Usar índices en columnas usadas en políticas RLS
- ✅ Validar datos en el frontend antes de enviar
- ✅ Loguear intentos de acceso denegado

### ❌ DON'Ts

- ❌ No confiar solo en el frontend para seguridad
- ❌ No usar `TRUE` en políticas a menos que sea intencional
- ❌ No deshabilitar RLS en producción
- ❌ No insertar datos sensibles en logs
- ❌ No compartir códigos de invitación por canales inseguros

## Posibles Mejoras Futuras

1. **Notificaciones**: Alertar cuando alguien ve tus figuras
2. **Roles**: Sistema de roles más granular (admin, moderator, user)
3. **Auditoría**: Tabla de logs para ver quién accedió qué
4. **Restricciones temporales**: Expiración de códigos de invitación
5. **Blacklist**: Bloquear usuarios específicos

---

Última actualización: 16 de junio de 2026
