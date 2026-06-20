# Guía de Desarrollo - Collector

## 🎯 Visión General

Collector es una aplicación completa para coleccionar y intercambiar figuras. Este documento te guía sobre cómo trabajar con el código.

## 📁 Estructura del Proyecto

```
Collector/
├── supabase/                      # Base de datos
│   ├── schema.sql                 # DDL + RLS + triggers
│   ├── README.md                  # Guía de setup
│   └── SECURITY.md                # Políticas de seguridad
│
└── frontend/                      # Aplicación React
    ├── src/
    │   ├── components/            # Componentes reutilizables
    │   │   ├── Layout.tsx
    │   │   └── Navbar.tsx
    │   │
    │   ├── pages/                 # Páginas principales
    │   │   ├── HomePage.tsx
    │   │   ├── LoginPage.tsx
    │   │   ├── SignupPage.tsx
    │   │   ├── DashboardPage.tsx
    │   │   ├── ProfilePage.tsx
    │   │   ├── AlbumPage.tsx
    │   │   └── GroupsPage.tsx
    │   │
    │   ├── stores/                # Estado global (Zustand)
    │   │   ├── authStore.ts
    │   │   └── collectorStore.ts
    │   │
    │   ├── types/                 # TypeScript types
    │   │   └── index.ts
    │   │
    │   ├── lib/                   # Utilidades
    │   │   └── supabase.ts
    │   │
    │   ├── hooks/                 # Custom hooks (vacío por ahora)
    │   │
    │   ├── App.tsx                # Router principal
    │   ├── main.tsx               # Entry point
    │   └── index.css              # Estilos globales
    │
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── vite.config.ts
    ├── tsconfig.json
    ├── package.json
    ├── .env.example
    └── README.md
```

## 🚀 Comandos Clave

```bash
# En /frontend

# Desarrollo
npm run dev

# Build para producción
npm run build

# Vista previa del build
npm run preview

# Linting
npm run lint
```

## 💾 Tipos TypeScript

Todos los tipos están en `src/types/index.ts`:

```typescript
Profile, Album, Sticker, UserSticker, UserAlbum, 
PrivateGroup, GroupMember, AuthUser, AuthSession
```

## 🔐 Autenticación

### Flow de Signup
```typescript
1. Usuario llena formulario en /signup
2. signup() → Supabase Auth + create profile
3. authStore.user se actualiza
4. Redirecciona a /dashboard
```

### Flow de Login
```typescript
1. Usuario llena formulario en /login
2. login() → Supabase Auth
3. authStore.user se actualiza
4. Redirecciona a /dashboard
```

### Protección de Rutas
```typescript
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>
```

Solo permite acceso si `authStore.user` existe.

## 📊 Estado Global (Zustand)

### authStore
```typescript
// Lectura
const { user, isLoading, error } = useAuthStore()

// Escritura
const { signup, login, logout, checkAuth } = useAuthStore()

// Inicializar
useEffect(() => {
  useAuthStore.getState().checkAuth()
}, [])
```

### collectorStore
```typescript
// Lectura
const { albums, userAlbums, userStickers } = useCollectorStore()

// Escritura
const { 
  fetchAlbums, 
  fetchUserAlbums, 
  activateAlbum, 
  deactivateAlbum,
  updateStickerQuantity 
} = useCollectorStore()
```

## 🗄️ Operaciones Comunes

### Crear usuario
```typescript
const { signup } = useAuthStore()
await signup(email, password, username, fullName)
```

### Iniciar sesión
```typescript
const { login } = useAuthStore()
await login(email, password)
```

### Obtener álbumes
```typescript
const { fetchAlbums } = useCollectorStore()
await fetchAlbums()
```

### Activar álbum
```typescript
const { activateAlbum } = useCollectorStore()
await activateAlbum(userId, albumId)
```

### Actualizar figuras
```typescript
const { updateStickerQuantity } = useCollectorStore()
await updateStickerQuantity(userId, stickerId, owned, repeated)
```

### Consultas SQL directas
```typescript
import { supabase } from '../lib/supabase'

// SELECT
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)

// INSERT
const { data, error } = await supabase
  .from('profiles')
  .insert({ id, username, email })

// UPDATE
const { error } = await supabase
  .from('profiles')
  .update({ full_name })
  .eq('id', userId)

// DELETE
const { error } = await supabase
  .from('profiles')
  .delete()
  .eq('id', userId)
```

## 🎨 Componentes

### Layout
Wrapper común para todas las páginas:
```tsx
<Layout>
  <YourContent />
</Layout>
```

Proporciona:
- Navbar
- Estilos globales
- Responsive container

### Navbar
Navegación principal con:
- Logo
- Links según autenticación
- Botón de logout

## 📄 Crear una Página Nueva

1. Crea archivo en `src/pages/MyPage.tsx`
```typescript
import { useAuthStore } from '../stores/authStore'

export function MyPage() {
  const { user } = useAuthStore()
  
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Mi Página</h1>
      {/* Contenido */}
    </div>
  )
}
```

2. Agrega ruta en `App.tsx`
```tsx
<Route
  path="/mypage"
  element={
    <ProtectedRoute>
      <MyPage />
    </ProtectedRoute>
  }
/>
```

3. Agrega link en `Navbar.tsx`
```tsx
<Link to="/mypage" className="nav-link">
  Mi Página
</Link>
```

## 🧪 Testing

### Test de autenticación
1. Ve a `/signup`
2. Completa formulario
3. Debe ir a `/dashboard`
4. Verificar que `user` está set

### Test de colección
1. Inicia sesión
2. Ve a `/dashboard`
3. Haz click en "Activar Álbum"
4. Debe agregar a `userAlbums`
5. Click en "Ver Mi Colección"
6. Debe cargar figuras

### Test de RLS
1. Crea dos usuarios
2. Usuario A marca figuras como repetidas
3. Loguea como Usuario B
4. Usuario B NO debe ver figuras de A (a menos que sean en mismo grupo)

## 🐛 Debugging

### Console.log
```typescript
console.log('Debug:', variable)
```

### React DevTools
- Instala extensión React DevTools
- Inspecciona componentes y props

### Network Tab
- Abre DevTools → Network
- Ve las peticiones a Supabase
- Busca errores de CORS

### Supabase Logs
- Ve a Supabase Dashboard
- Database → Query Performance
- Auth → Logs

## 🚨 Errores Comunes

### Error: "Cannot find module"
```bash
npm install
npm run dev
```

### Error: "Auth check failed"
- Verifica credenciales en `.env.local`
- Verifica que Supabase está disponible

### Error: "RLS policy denial"
- Ve a Supabase Dashboard
- Authentication → Policies
- Verifica que RLS policies existen

### Figuras no aparecen
- Verifica que el álbum está activado en `user_albums`
- Verifica que las figuras están en tabla `stickers`
- Abre DevTools Network tab y busca errores

## 🔄 Flujo de Desarrollo Típico

1. Crea rama de feature: `git checkout -b feature/nombre`
2. Desarrolla en `npm run dev`
3. Prueba en navegador
4. Haz commit: `git commit -am "feat: descripción"`
5. Push a rama
6. Create PR

## 📚 Recursos

- [React Docs](https://react.dev)
- [React Router Docs](https://reactrouter.com)
- [Tailwind Docs](https://tailwindcss.com)
- [Supabase Docs](https://supabase.com/docs)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [TypeScript Docs](https://www.typescriptlang.org/docs)

## 🎯 Mejoras Futuras

- [ ] Agregar validación de formularios (Zod/Yup)
- [ ] Agregar toasts/notificaciones (React Toastify)
- [ ] Agregar paginación
- [ ] Agregar filtros/búsqueda
- [ ] Agregar upload de avatares (Supabase Storage)
- [ ] Agregar darkmode
- [ ] Agregar tests unitarios (Vitest)
- [ ] Agregar tests E2E (Playwright)

## 📞 Preguntas Frecuentes

**P: ¿Cómo agrego una nueva tabla a Supabase?**
A: Ve a `supabase/schema.sql`, agrega CREATE TABLE, y ejecuta en SQL Editor.

**P: ¿Cómo cambio los colores?**
A: Edita `tailwind.config.js` en sección `theme.extend.colors`.

**P: ¿Cómo agrego un nuevo tipo TypeScript?**
A: Agrega interfaz en `src/types/index.ts`.

**P: ¿Cómo uso una variable de entorno?**
A: Prefija con `VITE_` en `.env.local`, accede con `import.meta.env.VITE_NOMBRE`.

---

**Última actualización:** 16 de junio de 2026
