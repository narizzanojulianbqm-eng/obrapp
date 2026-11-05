# Arquitectura técnica

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Aplicación | **Next.js 15 (App Router) + TypeScript** | Frontend y backend en un mismo proyecto. Los Server Components leen la base sin una API intermedia y las Server Actions manejan las escrituras. Despliegue simple (Vercel, Railway, VPS). |
| Base de datos | **SQLite / libSQL con Drizzle ORM** | Funciona en local sin instalar nada. En producción se usa Turso (libSQL administrado) cambiando `DATABASE_URL`. Para pasar a PostgreSQL se cambia el dialecto de Drizzle: el esquema está escrito de forma portable. |
| Estilos | Tailwind CSS y componentes propios | Interfaz neutra y liviana, sin dependencias pesadas. |
| Autenticación | Sesión firmada (JWT HS256 en una cookie httpOnly) con contraseñas bcrypt | Sin proveedores externos. Se puede reemplazar por Auth.js o Supabase Auth sin tocar los permisos. |
| IA | API de Anthropic (Claude), pagada por la plataforma | Una sola cuenta centralizada, con cupo mensual por plan, caché del contexto de la obra y modelo configurable. |
| Archivos | Disco local (`data/uploads`), servidos por una ruta con control de permisos | La firma de `guardarArchivos()` está pensada para cambiar a S3, R2 o Supabase Storage. |

## Estructura

```
src/
  app/
    (auth)/             login y registro
    (global)/           dashboard, obras, proveedores, WhatsApp, configuración
    (obra)/obras/[id]/  todos los módulos de una obra (menú lateral según el perfil)
    actions/            server actions (validan permisos en cada llamada)
    api/                archivos protegidos, logout, webhook de WhatsApp
  lib/
    db/schema.ts        modelo de datos
    access.ts           ÚNICA puerta de acceso a una obra (rolEnObra / requireObra / assertObra)
    engine/             motor de cálculo puro: plantillas, cómputo, APU, presupuesto, Gantt, diagnóstico
    obra-service.ts     generación desde plantilla y recálculo en cadena
    asistente/          motor de conversación compartido (web y WhatsApp)
    whatsapp/           Cloud API, webhook, envío, ventana de 24 h, transcripción y visión
```

## Modelo de datos (resumen)

- **users**: con su plan (gratuito, profesional o estudio).
- **obras**: el titular es el arquitecto. Guarda los datos del proyecto, los parámetros de cómputo y los coeficientes del presupuesto.
- **miembros**: el perfil de cada persona en cada obra (arquitecto, cliente u obrero). Un usuario puede tener perfiles distintos en obras distintas.
- **rubros** e **items**: las tareas. Cada ítem tiene su cantidad (calculada o manual), su rendimiento, su duración, sus predecesoras, las fechas calculadas, el avance y el responsable.
- **insumos**: la lista de precios propia de cada obra.
- **recursos**: el análisis de precios, es decir, el consumo de cada insumo por unidad de ítem.
- **avances**: registros de avance o de problemas, con fotos y el origen (web o WhatsApp).
- **solicitudes**, **compras**, **proveedores**, **cotizaciones** y **respuestas_cotizacion**.
- **adicionales** y **cambios**: modificaciones con impacto económico y temporal, que aprueba el cliente.
- **mensajes**: los canales general, cliente y obra, con decisiones, adjuntos y origen.
- **documentos** y **notificaciones**.
- **wa_contactos**, **wa_mensajes** y **conversacion_pendientes**: el canal de WhatsApp y el estado de cada conversación.
- **ai_mensajes** y **ai_uso**: historial y consumo de IA.
- **auditoria**: quién hizo qué, cuándo y por qué canal.

## Cómo se conectan los módulos

```
Datos de obra + parámetros ──► cantidades (fórmulas de plantilla)
                                   │
            consumos por unidad ◄──┤──► rendimientos (hh/u) ──► duraciones ──► cronograma (FC/CC + desfase)
                   │                                                                │
          precios de insumos ──► análisis de precios ──► presupuesto ──► precio final (coeficiente resumen)
                                                              │                     │
  solicitudes ─► compras ─► costo real por rubro ──► desvíos y flujo de fondos   avance previsto (curva S)
  avances (web / WhatsApp) ──────────────────────────────────────────────────► avance real, atrasos y alertas
```

`recalcularObra()` vuelve a ejecutar toda la cadena después de cualquier cambio que la afecte: superficies, parámetros, cantidades, consumos, duraciones o dependencias. Todas las cuentas se hacen con código y fórmulas, nunca con IA.

## Perfiles y permisos

- Todo pasa por `lib/access.ts`. Cada página llama a `requireObra(id, roles)` y cada acción llama a `assertObra(id, roles)`.
- Si alguien sin acceso intenta entrar a una obra, recibe un 404: no se revela que la obra existe.
- **Cliente**: ve el presupuesto solo a precio final (no ve el costo directo, los honorarios ni el beneficio), aprueba adicionales y compras, y pide cambios.
- **Obrero**: ve sus tareas, el cómputo sin precios y los documentos marcados como visibles. Informa avances y problemas y pide materiales.
- Los archivos se descargan por `/api/archivos/[id]`, que vuelve a verificar la obra y la visibilidad según el perfil.
- Las acciones sensibles (eliminar, regenerar, aprobar o comprar) piden confirmación explícita, en la web y en WhatsApp.

## IA: uso eficiente

1. **Primero reglas y datos.** Las preguntas frecuentes (atrasos, gastos, materiales, pendientes, avance, plazos, pagos, fotos) se responden con consultas a la base, sin IA y sin costo.
2. **IA solo cuando agrega valor.** Se usa para interpretar mensajes difíciles (una clasificación con salida estructurada, tool use), describir fotos de obra y responder preguntas abiertas. La IA nunca escribe en la base: propone una interpretación y el motor la ejecuta con los mismos permisos y confirmaciones que la web.
3. **Contexto compacto y cacheado.** El contexto de la obra se arma con código y se filtra por perfil, y se marca para caché de prompt.
4. **Cupo mensual por plan del titular.** Si se agota, se responde con el análisis automático. El consumo de tokens se registra por usuario y por obra.

## Escalabilidad y próximos pasos

- Para producción multiusuario: base en Turso o PostgreSQL, archivos en S3/R2 y el webhook de WhatsApp atendido por una cola (el procesamiento ya va desacoplado con `after()`).
- Pagos online de suscripciones con Mercado Pago o Stripe: el punto de enganche está en `cambiarPlan`.
- Envío automático de cotizaciones por email (Resend/SMTP), por WhatsApp (plantilla) o por API del proveedor: la interfaz `CanalEnvio` está en `lib/integraciones.ts`.
- Notificaciones por email: el punto de extensión está en `notificar()`.

## Carga desde archivos (rubros y tareas)
- Formatos: Excel (.xlsx/.csv), PDF con texto, Word (.docx), texto pegado y fotos (.jpg/.png).
- Sin IA (gratis): `src/lib/importar/texto.ts` interpreta líneas "descripción · unidad · cantidad · [precio] · [total]" y títulos de rubro; las planillas se leen por encabezado (`src/lib/planillas.ts`). Las fotos se leen con OCR en el navegador (tesseract.js), sin enviar la imagen.
- Con IA (si hay `ANTHROPIC_API_KEY`): PDF escaneados, fotos y textos desordenados se leen con Claude (`src/lib/importar/ia.ts`), descontando del cupo del plan.
- `src/lib/importar/vinculo.ts` reconoce la tarea de plantilla equivalente: si el archivo no trae precio, se suman sus materiales y mano de obra; si trae precio, se respeta y la duración sale del rendimiento.
- Siempre hay vista previa editable antes de guardar. En la obra de ejemplo de la demo solo se puede agregar.
