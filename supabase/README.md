# Supabase Setup - Collector Project

## Descripción

Este directorio contiene el script SQL necesario para configurar la base de datos en Supabase con todas las tablas, índices, Row Level Security (RLS) y políticas de seguridad.

## Archivos

- **schema.sql**: Script SQL completo con todas las tablas y políticas RLS

## Cómo Usar

### 1. Crear un proyecto en Supabase

1. Visita [supabase.com](https://supabase.com)
2. Crea una nueva cuenta o inicia sesión
3. Haz clic en "New Project"
4. Completa los detalles del proyecto

### 2. Ejecutar el Script SQL

Una vez creado el proyecto:

1. Ve a la sección **SQL Editor** en tu dashboard de Supabase
2. Haz clic en **New Query**
3. Copia todo el contenido de `schema.sql`
4. Pégalo en el editor
5. Haz clic en **Run** (o presiona `Cmd+Enter`)

El script ejecutará:
- ✅ Creación de todas las tablas
- ✅ Definición de claves primarias y foráneas
- ✅ Creación de índices
- ✅ Habilitación de Row Level Security (RLS)
- ✅ Definición de políticas de seguridad
- ✅ Creación de funciones y triggers
- ✅ Inserción de datos de ejemplo

## Estructura de Tablas

### profiles
- Información del perfil de usuario
- Controla privacidad (público/privado)
- Ubicación: ciudad y país

### albums
- Álbumes globales disponibles (ej. Mundial 2026)
- Metadata del álbum

### stickers
- Figuras individuales dentro de cada álbum
- Número, nombre y categoría/equipo

### user_stickers
- Rastreo de qué figuras tiene cada usuario
- Cantidad tenida (quantity_owned)
- Cantidad repetida para cambio (quantity_repeated)

### user_albums
- Registro de cuáles álbumes ha activado cada usuario

### private_groups
- Grupos privados creados por usuarios
- Código de invitación único

### group_members
- Miembros de cada grupo privado

## Políticas RLS

### Profiles
- ✅ Perfiles públicos visibles para todos
- 🔒 Perfil privado solo visible para el usuario

### User Stickers
- 🔒 Solo el usuario puede ver/editar sus figuras
- ✅ Miembros del grupo pueden ver figuras de otros miembros del grupo

### Private Groups
- 🔒 Solo creador y miembros pueden ver el grupo
- 🔒 Solo el creador puede editar/eliminar

### Group Members
- 🔒 Solo miembros del grupo pueden ver la lista de miembros

## Variables de Entorno

Después de ejecutar el script, necesitarás estas variables para tu frontend:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Las puedes encontrar en: **Project Settings > API Keys > Project URL y anon key**

## Notas Importantes

### Row Level Security
- Todas las tablas tienen RLS habilitado
- Las políticas están diseñadas para proteger la privacidad del usuario
- Los usuarios solo pueden ver/editar sus propios datos (excepto datos públicos)

### Códigos de Invitación
- Se generan automáticamente con un trigger
- Son únicos en la base de datos
- Formato: 12 caracteres hexadecimales

### Datos de Ejemplo
- El script incluye un álbum de ejemplo ("FIFA World Cup 2026")
- Se insertan 20 figuras de ejemplo
- Estos datos son opcionales y pueden eliminarse

## Próximos Pasos

1. ✅ Ejecutar este script SQL
2. 📱 Configurar autenticación en Supabase (Email/Password)
3. 🚀 Crear el frontend con React + Vite + TypeScript
4. 🔗 Conectar el frontend a Supabase

## Troubleshooting

### Error: "Permission denied"
- Asegúrate de tener permisos de admin en Supabase
- Ejecuta el script con el usuario correcto

### Error: "Function already exists"
- Esto es normal si ejecutas el script múltiples veces
- El script usa `CREATE OR REPLACE` para evitar conflictos

### Las políticas RLS no funcionan
- Asegúrate de tener `Enable RLS` habilitado en cada tabla
- Verifica que `auth.uid()` esté disponible en tu sesión

## Recursos

- [Documentación de Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Documentación de Supabase SQL](https://supabase.com/docs/guides/database/overview)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
