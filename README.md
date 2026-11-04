# Obrapp: plataforma de gestión integral de obras (MVP)

Obrapp es una aplicación web (SaaS) para arquitectos, clientes y obreros, pensada para la producción de obra en Argentina. El arquitecto crea una obra con sus datos básicos y la plataforma genera automáticamente:

- los rubros y las tareas,
- el cómputo de materiales,
- los análisis de precios unitarios,
- el presupuesto,
- el diagrama de Gantt.

Todo queda conectado: si cambia un dato, se recalculan los módulos que dependen de él. Clientes y obreros trabajan dentro del mismo sistema, desde la web o **por WhatsApp**.

## Entorno publicado

- **URL pública:** https://obrapp-three.vercel.app (Vercel + base Turso)
- **Entorno de prueba:** en el login hay botones de acceso para los tres perfiles demo, y los datos son ficticios.
- **Actualizaciones:** cada `git push` a `main` vuelve a publicar la app sola (ver `docs/despliegue.md`).

## Puesta en marcha (local)

Requiere Node 20 o superior.

```bash
npm install
cp .env.example .env.local      # completar AUTH_SECRET como mínimo
npm run setup                   # crea la base SQLite y carga la obra de demostración
npm run dev                     # http://localhost:3000
```

**Usuarios de demostración** (la contraseña de todos es `demo1234`):

| Perfil | Email | Qué ve |
|---|---|---|
| Arquitecta | arquitecta@demo.com | Todo, incluidos los costos, los honorarios y el panel de WhatsApp |
| Cliente | cliente@demo.com | Avance, cronograma, presupuesto final, compras y aprobaciones |
| Obrero / capataz | obrero@demo.com | Sus tareas, los materiales, los pedidos y los avances (vista para celular) |

Los precios de la obra de demostración son **ficticios**. Solo sirven para mostrar cómo funciona. La plataforma no trae precios de mercado: los carga el arquitecto o salen de las cotizaciones.

Para empezar de cero, borrá `data/obrapp.db*` y `data/uploads/` y corré `npm run setup`.

## Qué incluye esta versión

| Módulo | Estado |
|---|---|
| Registro, login y sesiones; perfiles arquitecto, cliente y obrero con permisos por obra | ✅ |
| Crear y editar una obra, con un identificador único por obra | ✅ |
| Plantillas argentinas: tradicional (HºAº + mampostería), steel frame y refacción | ✅ |
| Rubros y tareas editables, con cantidades calculadas por fórmula o cargadas a mano | ✅ |
| Parámetros de cómputo (perímetro, muros, baños, bocas…) con recálculo en cadena | ✅ |
| Cómputo de materiales, mano de obra y equipos | ✅ |
| Análisis de precios unitarios editable (consumos y rendimientos) | ✅ |
| Presupuesto: costo directo, gastos generales, beneficio, honorarios, IVA e incidencia por rubro | ✅ |
| Gantt interactivo: arrastrar, cambiar duración, dependencias FC/CC con desfase, hitos y recálculo | ✅ |
| Seguimiento: avance real vs. previsto, atrasos, curva de avance, fotos | ✅ |
| Costos y beneficios: desvíos por rubro, flujo de fondos, filtros por rubro, proveedor y fecha | ✅ |
| Solicitudes de materiales → aprobación → compra, vinculadas al presupuesto | ✅ |
| Proveedores y cotizaciones: pedido por email o WhatsApp, tabla comparativa y compra con confirmación | ✅ (envío manual con un clic) |
| Presupuestos adicionales y cambios pedidos por el cliente (con impacto en costo y plazo) | ✅ |
| Mensajería por obra (canales general, cliente y obra), decisiones, adjuntos y notificaciones | ✅ |
| Documentación, con visibilidad configurable para el cliente y el equipo de obra | ✅ |
| Asistente de obra (el mismo motor que WhatsApp) | ✅ |
| **WhatsApp**: webhook oficial de Meta, vinculación de números, motor de conversación y simulador | ✅ (falta cargar las credenciales de Meta) |
| Planes (gratuito, profesional y estudio), límites de obras y de IA, uso de IA por cuenta | ✅ (pagos online: próxima etapa) |
| Auditoría de operaciones y confirmación antes de las acciones importantes | ✅ |
| Reporte de avance y presupuesto imprimible / PDF | ✅ |

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md): stack, modelo de datos, permisos y cómo se conectan los módulos.
- [`docs/whatsapp.md`](docs/whatsapp.md): diseño del canal de WhatsApp, costos, reglas de Meta y el paso a paso para activarlo.

## Scripts útiles

- `npm run build && npm start`: producción.
- `node scripts/probar-webhook.mjs`: prueba de punta a punta del webhook de WhatsApp, con mensajes firmados como los de Meta. Requiere el servidor corriendo con `WHATSAPP_APP_SECRET` y `WHATSAPP_VERIFY_TOKEN`.
- `npx tsx scripts/test-engine.ts`: prueba de las plantillas y del cronograma.
