# Quick Start - Collector

Comienza con Collector en 5 minutos.

## 1️⃣ Configurar Supabase

```bash
# 1. Ve a https://supabase.com y crea una cuenta
# 2. Crea un nuevo proyecto
# 3. Ve a SQL Editor → New Query
# 4. Copia el contenido de supabase/schema.sql
# 5. Pégalo y ejecuta (Run)
# 6. Ve a Project Settings → API Keys
# 7. Copia las credenciales
```

## 2️⃣ Configurar Frontend

```bash
# Abre una terminal en la carpeta frontend
cd frontend

# Copia variables de entorno
cp .env.example .env.local

# Edita .env.local
# Pega tus credenciales de Supabase:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...

# Instala dependencias
npm install

# Inicia servidor de desarrollo
npm run dev
```

## 3️⃣ ¡Listo!

Abre la URL que te muestra Vite en la terminal. Normalmente es `http://localhost:5173`, pero si ese puerto ya está ocupado, Vite puede cambiarlo.

## 🎯 Primera Sesión

1. **Crea cuenta**: Click en "Sign Up"
   - Email: `tu@email.com`
   - Usuario: `mitusuario`
   - Nombre: `Tu Nombre`
   - Contraseña: `contraseña123`

2. **Accede al Dashboard**: Deberías estar en `/dashboard`

3. **Activa un Álbum**: Click en "Activar Álbum"
   - Por defecto está "FIFA World Cup 2026"

4. **Mira tu Colección**: Click en "Ver Mi Colección"

5. **Marca Figuras**: Click en cajas para marcar cantidad

6. **Configura Perfil**: Top right → "Perfil"
   - Agrega ciudad, país
   - Haz público o privado

7. **Crea un Grupo**: Top right → "Grupos"
   - Click en "+ Crear Grupo"
   - Comparte código con otros

## 📁 Archivos Importantes

| Archivo | Descripción |
|---------|-------------|
| `supabase/schema.sql` | Base de datos |
| `frontend/src/App.tsx` | Router principal |
| `frontend/src/stores/authStore.ts` | Auth |
| `frontend/src/stores/collectorStore.ts` | Colección |

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Lint
npm run lint

# Preview del build
npm run preview
```

## 🐛 Errores Comunes

### "Cannot find module"
```bash
npm install
npm run dev
```

### "Supabase URL/Key missing"
- Verifica `.env.local`
- Reinicia servidor: `npm run dev`

### "Auth check failed"
- Verifica credenciales de Supabase
- Asegúrate que proyecto está activo

## 📚 Documentación

- **[README.md](README.md)** - Overview general
- **[frontend/README.md](frontend/README.md)** - Frontend
- **[supabase/README.md](supabase/README.md)** - Database
- **[supabase/SECURITY.md](supabase/SECURITY.md)** - Seguridad
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Desarrollo
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deploy

## 🎨 Customización Rápida

### Cambiar colores
Edita `frontend/tailwind.config.js`:
```js
colors: {
  primary: {
    600: '#0284c7',  // Tu color aquí
  }
}
```

### Cambiar nombre
Busca "Collector" en el código y reemplaza

### Cambiar título de página
Edita `frontend/index.html`:
```html
<title>Mi App de Figuras</title>
```

## 🚀 Próximos Pasos

1. **Agrega más datos**: Crea más álbumes en Supabase
2. **Personaliza**: Cambia colores, nombre, logo
3. **Funciones**: Implementa búsqueda de coleccionistas
4. **Deploy**: Sigue [DEPLOYMENT.md](DEPLOYMENT.md)

## 💡 Tips

- Usa `npm run dev` en desarrollo
- Abre DevTools para debuggear
- Revisa logs de Supabase si algo falla
- Test con múltiples usuarios

## 📞 Ayuda

- Revisa [DEVELOPMENT.md](DEVELOPMENT.md)
- Busca en documentación oficial de librerías
- Abre DevTools Console para ver errores

---

**Estás listo. ¡A coleccionar figuras! 🎨**
