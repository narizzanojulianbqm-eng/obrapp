# WhatsApp como puerta de entrada a la obra

## Objetivo

Que arquitectos, obreros y clientes usen la plataforma desde WhatsApp, con texto, audios, fotos, videos o documentos, sin instalar nada ni registrarse en la web. WhatsApp **no es un sistema aparte**: es otro canal del mismo backend y de la misma base de datos.

```
WhatsApp (Meta Cloud API) ──webhook──►  /api/whatsapp/webhook  ──►  whatsapp/entrada.ts
                                                                     (identifica el número, guarda el historial,
                                                                      transcribe audios, descarga archivos)
                                                                              │
Asistente web  ──────────────────────────────────────────────────►  asistente/motor.ts  ◄── futura app móvil
                                                                     (obra, perfil, intención, acción)
                                                                              │
                                     la misma base: avances, solicitudes, compras, cambios, mensajes, auditoría
                                                                              │
                         notificar()  ──►  campana en la web  +  WhatsApp de quien lo tenga vinculado
```

- Un mensaje recibido por WhatsApp queda en la obra: el avance aparece en Seguimiento, el pedido en Solicitudes, la foto en Documentación y el texto en Mensajes, marcado como "vía WhatsApp".
- Una tarea creada en la web se puede consultar por WhatsApp, porque las consultas leen la misma base.
- Las notificaciones de la plataforma llegan por WhatsApp a quien tenga el número vinculado y los avisos activados.
- Cada mensaje queda guardado en `wa_mensajes`: dirección, tipo, transcripción, intención detectada, obra y estado (enviado, entregado, leído o error). Cada acción queda en `auditoria` con el canal.

## Identificación y seguridad

- **Un número = un usuario.** El arquitecto suma a alguien con su número desde *WhatsApp → Sumar a alguien*. Si esa persona no tiene cuenta, se le crea una automáticamente: no necesita registrarse.
- El canal se activa cuando la persona responde la bienvenida. WhatsApp garantiza que el mensaje viene de ese número.
- Un usuario que ya está registrado en la web vincula su número así: desde *Configuración → Mi WhatsApp* genera un código y lo manda con el texto `VINCULAR 123456` desde ese número.
- **Un número desconocido no recibe ningún dato.** Solo recibe instrucciones para que lo vincule el arquitecto.
- **Selección de obra.** Si la persona participa en varias obras, el asistente pregunta por cuál consulta y lo recuerda. Escribiendo *obras* se cambia. Una obra solo se puede elegir entre las propias: conocer el nombre o la dirección de otra obra no da acceso.
- **Los permisos por perfil son los mismos que en la web.** El cliente nunca recibe costos internos, honorarios ni beneficios, y el obrero no recibe información financiera.
- **Confirmación de las acciones sensibles.** Aprobar o rechazar solicitudes, compras y adicionales, o marcar una tarea como terminada, pide una respuesta *SÍ / NO* que vence en 30 a 60 minutos. Los permisos se vuelven a validar al momento de ejecutar.
- **El cronograma no se cambia solo.** Un problema o un "mañana no podemos trabajar" se registra y se avisa al arquitecto, pero las fechas no se mueven hasta que él lo apruebe en el Gantt.
- **Webhook protegido.** El webhook valida la firma `X-Hub-Signature-256` con el App Secret (obligatoria en producción), descarta mensajes duplicados por `wa_message_id` y responde 200 enseguida, procesando después.
- Un número se puede bloquear desde el panel.

## Qué entiende el asistente

Se interpreta lenguaje natural informal, sin comandos rígidos. Las consultas se responden con **datos reales** de la base, no con texto genérico.

| Perfil | Ejemplos | Qué pasa |
|---|---|---|
| Arquitecto | "¿Qué tareas están atrasadas?", "¿Cuánto gastamos esta semana?", "¿Qué materiales necesitamos mañana?", "¿Cuánto queda de presupuesto para instalaciones?", "¿Cuántas personas trabajaron hoy?", "Generame un informe semanal" | Consulta a la base y responde con números |
| Arquitecto | "¿Qué pedidos esperan mi aprobación?" → "aprobar 1" → "sí" | Muestra la lista numerada, pide confirmación, aprueba y avisa al que pidió |
| Obrero | "Hoy terminamos de levantar las paredes del dormitorio" | Identifica la tarea (si hay dudas, pregunta), registra la novedad y pide el % o confirma "terminada" |
| Obrero | "Nos faltan 20 bolsas de cemento y 2 m³ de arena para mañana" | Crea las solicitudes, verifica contra el cómputo, pone la prioridad y avisa al arquitecto |
| Obrero | "No podemos continuar porque no llegó el material" | Registra el problema en la tarea en curso y avisa al arquitecto, sin tocar fechas |
| Obrero | Foto con o sin texto | Guarda la foto en la obra y la asocia a la tarea (si hay IA, también la describe técnicamente) |
| Obrero | Audio | Lo transcribe y lo procesa como texto. Si no hay transcriptor, lo guarda, avisa al arquitecto y pide un resumen escrito |
| Obrero | "Hoy somos 4" | Registra la asistencia del día |
| Cliente | "¿Cómo viene mi casa?", "¿Cuánto falta?", "¿Qué decisiones tengo pendientes?", "¿Cuánto pago este mes?", "Mostrame cómo quedó el baño" | Responde con datos filtrados para el cliente y fotos visibles para él |
| Cliente | "Quiero cambiar el revestimiento de la cocina" | Crea una **propuesta de cambio** con las tareas afectadas y su precio actual. El arquitecto carga el impacto en costo y plazo, y al cliente le llega como adicional para aprobar o rechazar |

Cuando el asistente no entiende, no se pierde nada: reenvía el mensaje al arquitecto (y queda en Mensajes) y explica qué se puede hacer.

La clasificación distingue entre:
- **consulta**: se responde;
- **observación**: avance, foto o asistencia, que se registra;
- **solicitud**: materiales o cambio, que genera un registro pendiente de aprobación;
- **instrucción**: elegir obra o un porcentaje;
- **acción que requiere autorización**: se confirma antes.

## Flujo de materiales por WhatsApp

1. El encargado escribe "faltan 20 bolsas de cemento para mañana".
2. El asistente estructura el pedido: material, cantidad, unidad, fecha, prioridad y tarea relacionada.
3. El sistema lo valida contra el cómputo, porque los insumos son de la obra.
4. Se crea la solicitud (con origen "whatsapp") y se avisa al arquitecto por la web y por WhatsApp.
5. El arquitecto aprueba desde WhatsApp ("aprobar 1" → "sí") o desde la web, donde también puede modificarla.
6. Desde la web pide cotizaciones. Los mensajes a los corralones salen armados con links de WhatsApp o email.
7. Carga las respuestas, compara y elige. La compra solo se genera con su confirmación, y opcionalmente con la del cliente.
8. La compra actualiza el costo real del rubro y el precio del insumo.
9. Al encargado le llega la confirmación de su pedido por WhatsApp.

## Reglas y costos de WhatsApp (vigentes a noviembre 2026)

- **Ventana de 24 h.** Se pueden mandar mensajes libres solo durante las 24 horas siguientes al último mensaje del usuario. Fuera de esa ventana hay que usar una **plantilla aprobada** por Meta. El sistema lo maneja solo: `ventanaAbierta()` decide entre texto libre y la plantilla `aviso_obra`.
- **Costos.** Desde el 1 de julio de 2025, Meta cobra por mensaje enviado según su categoría (marketing, utility o authentication) y el país del destinatario. **Desde el 1 de octubre de 2026 también se cobran los mensajes de servicio** (las respuestas libres dentro de la ventana), con **1.000 gratuitos por número por mes**. También se cobran las plantillas utility enviadas dentro de la ventana. Los mensajes que entran son gratis. Los valores actualizados están en las tarifas oficiales de Meta.
- **Cómo se minimiza el costo:**
  - una sola respuesta por mensaje recibido (se agrupan los textos);
  - los avisos informativos (por ejemplo, un avance) no se mandan por WhatsApp, solo los que piden atención: aprobaciones, problemas, pedidos, cambios;
  - cada persona puede desactivar sus avisos;
  - las plantillas se usan solo cuando la ventana está cerrada.
- **Plantillas a crear en Meta** (categoría *Utility*, idioma `es_AR`):
  - `bienvenida_obra`: «Hola {{1}}, te sumaron a la obra {{2}} en Obrapp. Podés mandarnos mensajes, audios o fotos para registrar avances, consultar tareas o pedir materiales. Respondé este mensaje para activar el canal.»
  - `aviso_obra`: «Hola {{1}}, hay una novedad en tu obra: {{2}}. Respondé este mensaje para ver el detalle.»
- **Sin integraciones no oficiales.** Solo se usa la Graph API oficial de Meta, sin librerías que automaticen WhatsApp Web, para no poner en riesgo los números.

## Qué hace falta para activarlo

1. Una cuenta de **Meta Business** verificada y una app en developers.facebook.com con el producto **WhatsApp**.
2. Un **número de teléfono** dedicado para la plataforma, registrado en la cuenta de WhatsApp Business. No puede estar usándose en la app común de WhatsApp.
3. Un **System User** con un token permanente con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
4. Las variables de entorno: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (un texto que elegís vos) y `APP_URL` (la URL pública con HTTPS).
5. En la app de Meta → WhatsApp → Configuración → Webhook:
   - URL: `APP_URL/api/whatsapp/webhook`;
   - token de verificación: el valor de `WHATSAPP_VERIFY_TOKEN`;
   - suscribir el campo `messages`.
6. Crear y esperar la aprobación de las dos plantillas de arriba.
7. Opcional: `OPENAI_API_KEY` para transcribir audios y `ANTHROPIC_API_KEY` para interpretar mensajes complejos y fotos.
8. Medio de pago cargado en el administrador de WhatsApp de Meta.

Mientras falten credenciales, la plataforma funciona en **modo simulador**:
- los mensajes salientes quedan registrados como "simulados";
- desde *WhatsApp* en la web se puede escribir como cualquier persona vinculada a tus obras y ver las respuestas reales del sistema.

Cuando se activa la API real, el simulador se apaga solo, salvo que se configure `WHATSAPP_SIMULADOR=on`.

Para probar el webhook con mensajes firmados como los de Meta:

```bash
WHATSAPP_APP_SECRET=secreto WHATSAPP_VERIFY_TOKEN=verif npm start
WHATSAPP_APP_SECRET=secreto WHATSAPP_VERIFY_TOKEN=verif node scripts/probar-webhook.mjs
```
