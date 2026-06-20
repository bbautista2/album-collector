# Collector Frontend

Aplicación web de React + Vite para coleccionar y intercambiar figuras.

## Tech Stack

- **React 19.2** - Framework de UI
- **Vite 8.0** - Build tool
- **TypeScript** - Type safety
- **React Router v6** - Routing
- **Tailwind CSS 3.4** - Styling
- **Zustand** - State management
- **Supabase JS** - Backend client

## Instalación

### Prerrequisitos
- Node.js >= 16
- npm

### Setup

1. Instala dependencias
```bash
npm install
```

2. Configura las variables de entorno
```bash
cp .env.example .env.local
# Edita .env.local con tus credenciales de Supabase
```

Necesitas:
- `VITE_SUPABASE_URL` - URL de tu proyecto en Supabase
- `VITE_SUPABASE_ANON_KEY` - Clave anónima de Supabase

## Scripts Disponibles

```bash
npm run dev          # Desarrollo en http://localhost:5173
npm run build        # Build para producción
npm run preview      # Vista previa del build
npm run lint         # ESLint
```

## Estructura de Carpetas

```
src/
├── components/       # Componentes reutilizables
├── pages/           # Páginas
├── stores/          # Zustand stores (estado global)
├── types/           # TypeScript types
├── lib/             # Utilidades (cliente Supabase)
└── App.tsx          # Router principal
```

## Rutas

- `/` - Página de inicio
- `/login` - Iniciar sesión
- `/signup` - Crear cuenta
- `/dashboard` - Dashboard (protegido)

## Autenticación

La autenticación se maneja con Supabase Auth (email/password):

1. Usuario se registra en `/signup`
2. Se crea cuenta en `auth.users` y perfil en tabla `profiles`
3. Login en `/signup` restaura la sesión
4. Rutas protegidas redirigen si no hay autenticación

## Estado Global (Zustand)

**authStore** - Autenticación del usuario
**collectorStore** - Datos de colección

## Seguridad

- Row Level Security (RLS) protege todos los datos
- Los usuarios solo pueden ver/editar sus propios datos
- Validación en el servidor (Supabase) es la fuente de verdad

## Troubleshooting

### Error: "Cannot find module..."
```bash
npm install
```

### Variables de entorno no funcionan
- Reinicia el servidor: `npm run dev`
- Usa `.env.local` no `.env`
- Prefija con `VITE_`

import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
