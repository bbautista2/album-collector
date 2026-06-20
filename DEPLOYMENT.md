# Deployment Guide - Collector

Guía completa para desplegar Collector en producción.

## 📋 Pre-requisitos

- Cuenta de Supabase
- Cuenta de Vercel/Netlify/cualquier hosting
- Dominio (opcional)
- Node.js >= 16

## 🚀 1. Configurar Base de Datos en Producción

### Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Haz clic en "New Project"
3. Completa detalles:
   - **Name**: Nombre del proyecto
   - **Database Password**: Contraseña fuerte
   - **Region**: Elige región cercana a usuarios
4. Haz clic en "Create new project"

### Ejecutar Schema

1. Espera a que Supabase inicialize (2-3 minutos)
2. Ve a SQL Editor
3. Haz clic en "New Query"
4. Copia contenido de `supabase/schema.sql`
5. Pégalo en el editor
6. Haz clic en "Run"

### Configurar Autenticación

1. Ve a Authentication → Providers
2. Verifica que "Email" esté habilitado
3. Ve a Authentication → URL Configuration
4. Agrega URL de tu frontend:
   - Desarrollo: `http://localhost:5173`
   - Producción: `https://tudominio.com`

### Obtener Credenciales

1. Ve a Project Settings → API Keys
2. Copia:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon` key → `VITE_SUPABASE_ANON_KEY`

## 🏗️ 2. Preparar Frontend para Producción

### Actualizar Variables de Entorno

```bash
cd frontend

# Copia el ejemplo
cp .env.example .env.production

# Edita con credenciales de producción
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima-aqui
```

### Build Local

```bash
# Verifica que todo compila
npm run build

# Vista previa
npm run preview
```

## 🌐 3. Desplegar en Vercel (Recomendado)

### Opción A: Desde GitHub

1. Sube tu código a GitHub
2. Ve a [vercel.com](https://vercel.com)
3. Haz clic en "Import Project"
4. Conecta tu repo de GitHub
5. Selecciona rama `main`
6. Configura variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Haz clic en "Deploy"

### Opción B: CLI de Vercel

```bash
# Instala Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

## 🌐 4. Desplegar en Netlify

### Opción A: Conectar GitHub

1. Ve a [netlify.com](https://netlify.com)
2. Haz clic en "Add new site" → "Import an existing project"
3. Conecta GitHub
4. Selecciona repo
5. Configura build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Agrega variables de entorno en:
   - Site settings → Build & deploy → Environment
7. Haz clic en "Deploy"

### Opción B: Drag & Drop

```bash
# En carpeta frontend
npm run build

# Arrastra carpeta 'dist' a netlify.com
```

## 📦 5. Configurar Dominio

### Con Vercel

1. Ve a Project Settings → Domains
2. Agrega tu dominio
3. Sigue instrucciones para apuntar DNS

### Con Netlify

1. Ve a Site settings → Domain management
2. Agrega tu dominio
3. Sigue instrucciones para apuntar DNS

### Con Supabase

1. Ve a Project Settings → API Configuration
2. Agrega URL de producción a "Allowed redirect URLs"

## ✅ 7. Verificaciones de Producción

### Checklist de Seguridad

- [ ] CORS configurado correctamente en Supabase
- [ ] Variables de entorno NO expuestas en repo
- [ ] RLS habilitado en todas las tablas
- [ ] Passwords hasheadas en base de datos
- [ ] HTTPS obligatorio
- [ ] Backups automáticos en Supabase

### Checklist de Performance

- [ ] Frontend minificado (Vite lo hace automáticamente)
- [ ] CDN habilitado en Vercel/Netlify
- [ ] Imágenes optimizadas
- [ ] Lazy loading implementado

### Checklist de Funcionalidad

- [ ] Signup funciona
- [ ] Login funciona
- [ ] Activar álbum funciona
- [ ] Marcar figuras funciona
- [ ] Crear grupos funciona
- [ ] RLS protege datos (test con múltiples usuarios)

## 🐛 Troubleshooting Deployment

### Error: "Cannot find module"
```bash
npm install
npm run build
```

### Error: CORS
- Supabase Settings → API Configuration
- Agrega URL de producción a "Allowed redirect URLs"
- Agrega dominio a "Additional Redirect URLs"

### Error: "Env variables undefined"
- Verifica que variables están en settings del hosting
- Verifica que tienen prefijo `VITE_` (para Vite)
- Redeploy después de cambiar variables

### Error: "Database connection failed"
- Verifica credenciales en `.env`
- Verifica que Supabase Project está disponible
- Verifica que firewalls no bloquean conexión

### Figuras no aparecen en producción
- Verifica que RLS policies existen en Supabase
- Verifica que tablas tienen datos
- Check Supabase logs

## 📊 Monitoreo

### Supabase Dashboard

- **Database**: Ver uso de storage y conexiones
- **Auth**: Ver usuarios registrados
- **Logs**: Ver errores en queries

### Vercel Analytics

- **Performance**: Ver Core Web Vitals
- **Traffic**: Ver requests por región

### Netlify Analytics

- **Bandwidth**: Ver consumo de banda
- **Deployment**: Ver historial de deploys

## 🔄 CI/CD Workflow

### Rama de Desarrollo

1. Crea rama: `git checkout -b feature/nombre`
2. Desarrolla localmente
3. Merge a `develop` (deployment automático a staging)
4. Test en staging

### Rama de Producción

1. Crea Pull Request de `develop` a `main`
2. Review de código
3. Merge a `main` (deployment automático a producción)
4. Monitor en producción

## 📝 Rollback

### Si algo sale mal en producción

#### Vercel
```bash
# Ve a Deployments
# Haz clic en el deployment anterior
# Haz clic en "Rollback"
```

#### Netlify
```bash
# Ve a Deploys
# Selecciona deploy anterior
# Haz clic en "Publish deploy"
```

#### Database
```bash
# Si hay cambios en schema:
# 1. Usa backups automáticos de Supabase
# 2. Ve a Backups → Restore
# 3. Selecciona backup anterior
```

## 📈 Escalado

### Si crece el tráfico

1. **Database**: 
   - Sube plan de Supabase
   - Agrega índices si es necesario

2. **Frontend**:
   - Vercel/Netlify maneja automáticamente
   - Agrega CDN si es necesario

3. **Storage**:
   - Sube quota en Supabase
   - Implementa image resizing

## 🔐 Seguridad en Producción

### Cambios Recomendados

1. **Habilitar 2FA en Supabase**
   - Project Settings → Authentication

2. **Limitar API Keys**
   - Solo usar `anon` key en frontend
   - Nunca exponer `service_role` key

3. **Habilitar HTTPS**
   - Vercel/Netlify lo hace automáticamente

4. **Rate Limiting**
   - Project Settings → Auth → Rate Limiting

5. **Backups**
   - Supabase → Backups → Enable automatic backups

## 📞 Soporte

- **Vercel**: vercel.com/support
- **Netlify**: netlify.com/support
- **Supabase**: supabase.com/docs o Discord

---

**Última actualización:** 16 de junio de 2026
