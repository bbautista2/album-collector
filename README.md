# Collector - Aplicación de Coleccionismo de Figuras

Plataforma completa para coleccionar, intercambiar y conectar con otros coleccionistas de figuritas.

## 📋 Descripción del Proyecto

Collector es una aplicación web moderna que permite a los usuarios:
- 🎨 Coleccionar figuras organizadas en álbumes
- 📊 Registrar cuáles tienes y cuáles están repetidas
- 🤝 Crear grupos privados para intercambiar figuras
- 🔍 Buscar otros coleccionistas en tu ciudad
- 👥 Conectar con la comunidad

## 🏗️ Arquitectura del Proyecto

```
Collector/
├── supabase/                 # Base de datos (PostgreSQL + RLS)
│   ├── schema.sql           # Script de configuración
│   ├── README.md
│   └── SECURITY.md
├── frontend/                 # Aplicación React
│   ├── src/
│   │   ├── components/       # Componentes reutilizables
│   │   ├── pages/           # Páginas principales
│   │   ├── stores/          # Estado global (Zustand)
│   │   ├── types/           # TypeScript types
│   │   ├── lib/             # Utilidades
│   │   └── App.tsx          # Router principal
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.ts
│   ├── package.json
│   └── README.md
└── README.md                 # Este archivo

```

## 🛠️ Tech Stack

### Backend/Database
- **Supabase** (PostgreSQL)
- **Row Level Security (RLS)**
- **Supabase Auth** (Email/Password)

### Frontend
- **React 19.2**
- **Vite 8.0**
- **TypeScript**
- **React Router v6**
- **Tailwind CSS 3.4**
- **Zustand** (State management)
- **Supabase JS Client**

## 🚀 Instalación Rápida

### Paso 1: Configurar Base de Datos (Supabase)

1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Ve a SQL Editor y ejecuta el script `supabase/schema.sql`

### Paso 2: Configurar Frontend

```bash
cd frontend

# Copia el archivo de variables de entorno
cp .env.example .env.local

# Edita .env.local con tus credenciales de Supabase
# VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
# VITE_SUPABASE_ANON_KEY=tu-clave-anonima

# Instala dependencias
npm install

# Inicia servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 📚 Documentación

- **[supabase/README.md](supabase/README.md)** - Guía de base de datos y RLS
- **[supabase/SECURITY.md](supabase/SECURITY.md)** - Políticas de seguridad detalladas
- **[frontend/README.md](frontend/README.md)** - Documentación del frontend

## 💾 Estructura de Base de Datos

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Perfiles de usuario con privacidad |
| `albums` | Álbumes globales (ej. Mundial 2026) |
| `stickers` | Figuras individuales |
| `user_stickers` | Figuras que tiene cada usuario |
| `user_albums` | Álbumes activados por usuario |
| `private_groups` | Grupos privados para intercambios |
| `group_members` | Miembros de grupos |

Ver [supabase/schema.sql](supabase/schema.sql) para detalles completos.

## 🔒 Seguridad

- ✅ **Row Level Security (RLS)** en todas las tablas
- ✅ **Autenticación**: Email/Password con Supabase Auth
- ✅ **Privacidad**: Los usuarios pueden hacer su perfil público o privado
- ✅ **Encriptación**: Contraseñas encriptadas en Supabase

### Políticas de Seguridad

- 🔒 Perfiles privados solo visibles para el dueño
- 🔒 Figuras solo visibles para el dueño (excepto miembros del grupo)
- ✅ Perfiles públicos visibles para todos
- ✅ Figuras de grupo visibles para miembros

## 📖 Guía de Uso

### 1. Registrarse
- Ve a `/signup`
- Completa: Email, Usuario, Nombre Completo, Contraseña
- Se crea automáticamente un perfil privado

### 2. Configurar Perfil
- Ve a `/profile`
- Agrega tu ciudad y país
- Elige si tu perfil es público o privado
- Carga un avatar (opcional)

### 3. Activar Álbumes
- Ve a `/dashboard`
- Haz clic en "Activar Álbum" en los álbumes que coleccionas
- Accede a tu colección

### 4. Registrar Figuras
- Abre un álbum activado
- Marca qué figuras tienes
- Anota cuántas están repetidas para cambio

### 5. Crear Grupo Privado
- Ve a `/grupos`
- Crea un nuevo grupo
- Comparte el código de invitación con otros coleccionistas
- Los miembros pueden ver tus figuras repetidas

### 6. Buscar Coleccionistas
- Ve a `/buscar`
- Busca por ciudad
- Filtra por figuras que te faltan
- Contacta a coleccionistas públicos

## 🎨 Estructura de Componentes

### Layout
- **Navbar** - Navegación principal
- **Layout** - Estructura común de páginas

### Páginas
- **HomePage** - Página de inicio
- **LoginPage** - Iniciar sesión
- **SignupPage** - Crear cuenta
- **DashboardPage** - Dashboard principal
- **ProfilePage** - Perfil del usuario (por implementar)
- **AlbumPage** - Detalle de álbum (por implementar)
- **GroupsPage** - Mis grupos (por implementar)

### Stores (Zustand)
- **authStore** - Autenticación del usuario
- **collectorStore** - Datos de colección

## 🔄 Flujos de Negocio

### Flujo de Autenticación
```
Signup → Create auth.user → Create profile → Logged in ✓
  ↓
Login → Restore session → Logged in ✓
  ↓
Logout → Clear session ✓
```

### Flujo de Colección
```
Activate Album → Fetch stickers → View collection ✓
  ↓
Add sticker → Mark as owned → Save quantity ✓
  ↓
Mark as repeated → Available for exchange ✓
```

### Flujo de Grupos
```
Create group → Generate invite code → Share ✓
  ↓
Join with code → Verify code → Add to group ✓
  ↓
View members → See repeated stickers → Exchange ✓
```

## 📊 Estado Global

### authStore
```typescript
- user: AuthUser | null
- isLoading: boolean
- error: string | null
- signup(email, password, username, fullName)
- login(email, password)
- logout()
- checkAuth()
```

### collectorStore
```typescript
- albums: Album[]
- userAlbums: UserAlbum[]
- userStickers: UserSticker[]
- isLoading: boolean
- error: string | null
- fetchAlbums()
- fetchUserAlbums(userId)
- fetchUserStickers(userId)
- activateAlbum(userId, albumId)
- deactivateAlbum(userId, albumId)
- updateStickerQuantity(userId, stickerId, owned, repeated)
```

## 🐛 Troubleshooting

### Problema: "Cannot find module 'zustand'"
**Solución:**
```bash
npm install
```

### Problema: Variables de entorno no funcionan
**Solución:**
1. Reinicia el servidor: `npm run dev`
2. Usa `.env.local` (no `.env`)
3. Prefija variables con `VITE_`

### Problema: Errores de CORS en Supabase
**Solución:**
- Supabase → Project Settings → Auth → Allowed redirect URLs
- Agrega `http://localhost:5173` en desarrollo

### Problema: "Auth check failed"
**Solución:**
- Verifica que las credenciales de Supabase son correctas
- Revisa la consola del navegador para más detalles

## 📝 Scripts disponibles

```bash
# Frontend
npm run dev          # Iniciar desarrollo
npm run build        # Build para producción
npm run preview      # Vista previa del build
npm run lint         # Verificar linting
```

## 🚧 Próximos Pasos

- [ ] Página de perfil completa
- [ ] Detalle de álbum con figuras
- [ ] Creación de grupos privados
- [ ] Búsqueda de coleccionistas
- [ ] Sistema de notificaciones
- [ ] Upload de avatares
- [ ] Modo oscuro
- [ ] Paginación en listas
- [ ] Filtros avanzados

## 📚 Recursos Útiles

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vite.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [React Router](https://reactrouter.com)
- [Zustand](https://github.com/pmndrs/zustand)

## 📄 Licencia

Proyecto personal - Uso libre

## 👤 Autor

Creado el 16 de junio de 2026

## 📞 Contacto

Para preguntas o contribuciones, contacta al equipo de desarrollo.

---

**Última actualización:** 16 de junio de 2026
