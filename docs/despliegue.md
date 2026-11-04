# Publicación (GitHub + Vercel + Turso) y actualizaciones

## Arquitectura de producción (planes gratuitos)

| Pieza | Servicio | Plan |
|---|---|---|
| Código | GitHub (repositorio privado) | Gratis |
| Aplicación web: frontend y backend | Vercel | Hobby (gratis) |
| Base de datos y archivos | Turso (libSQL), creada desde Vercel → Storage | Free |

Los archivos y fotos se guardan dentro de la base, porque Vercel no tiene disco persistente. Antes de subirlas, las fotos se comprimen en el navegador para respetar el límite de unos 4,5 MB por request de Vercel.

## Primera publicación

1. Crear un repositorio vacío en GitHub y subir el código (`git push`).
2. En Vercel: **Add New → Project → Import** el repositorio. El framework se detecta solo (Next.js).
3. En el proyecto de Vercel: **Storage → Create Database → Turso → Free**, y conectarla al proyecto. Esto crea `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
4. En **Settings → Environment Variables**, agregar:
   - `AUTH_SECRET`: un texto largo y aleatorio (por ejemplo, el resultado de `openssl rand -hex 32`).
   - `APP_URL`: la URL pública, por ejemplo `https://obrapp-xxxx.vercel.app`.
   - `DEMO_MODE`: `1` para mostrar el aviso de entorno de prueba y los accesos de demostración. `0` para producción real.
   - `SEED_DEMO`: `1` carga la obra de demostración si no existe. `0` no la carga.
5. **Deployments → Redeploy.** El build ejecuta:
   - `scripts/verificar-entorno.mjs`: frena el build si falta la base o `AUTH_SECRET`;
   - `drizzle-kit migrate`: crea o actualiza las tablas;
   - `scripts/seed.ts`: carga la demo (es idempotente);
   - `next build`.

## Actualizar la aplicación

Cada `git push` a la rama `main` dispara un nuevo despliegue automático en Vercel.

```bash
# 1. hacer los cambios
# 2. si cambió src/lib/db/schema.ts:
npm run db:generate        # crea la migración SQL en /drizzle (hay que subirla al repositorio)
# 3. probar en local
npm run setup && npm run dev
npm test
# 4. publicar
git add -A && git commit -m "Descripción del cambio" && git push
```

Las migraciones se aplican solas en el build y no borran datos. Nunca se edita una migración que ya está publicada: se genera una nueva.

## Copias de seguridad

- Turso guarda backups automáticos según el plan. Además, `node scripts/backup.mjs` hace un volcado de la base a un archivo local.
- Para descargar una copia de la base de Turso a tu computadora: `turso db shell <nombre> .dump > backup.sql` (requiere la CLI de Turso).

## Integraciones pendientes de activación

Cada una se activa agregando sus variables en Vercel y volviendo a desplegar. Mientras falten, la interfaz las muestra como **PENDIENTE**:

- **WhatsApp:** `WHATSAPP_*` (ver `docs/whatsapp.md`).
- **IA:** `ANTHROPIC_API_KEY`. Opcional: `OPENAI_API_KEY` para transcribir audios.
- **Email:** `RESEND_API_KEY` y `EMAIL_FROM`.
- **Cobro de suscripciones:** `MERCADOPAGO_ACCESS_TOKEN`.
