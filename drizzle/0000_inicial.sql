CREATE TABLE `adicionales` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`titulo` text NOT NULL,
	`descripcion` text,
	`monto` real NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`respuesta_cliente` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_mensajes` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rol` text NOT NULL,
	`texto` text NOT NULL,
	`acciones` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ai_uso` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`obra_id` text,
	`modelo` text,
	`tokens_entrada` integer DEFAULT 0 NOT NULL,
	`tokens_salida` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `archivos_contenido` (
	`doc_id` text PRIMARY KEY NOT NULL,
	`data` blob NOT NULL,
	FOREIGN KEY (`doc_id`) REFERENCES `documentos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `auditoria` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text,
	`user_id` text,
	`accion` text NOT NULL,
	`detalle` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `avances` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`item_id` text NOT NULL,
	`autor_id` text NOT NULL,
	`avance_pct` real NOT NULL,
	`cantidad` real,
	`nota` text,
	`tipo` text DEFAULT 'avance' NOT NULL,
	`fotos` text DEFAULT '[]' NOT NULL,
	`origen` text DEFAULT 'web' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`autor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cambios` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`solicitante_id` text NOT NULL,
	`descripcion` text NOT NULL,
	`items_afectados` text DEFAULT '[]' NOT NULL,
	`costo_afectado` real,
	`impacto_monto` real,
	`impacto_dias` integer,
	`respuesta_arquitecto` text,
	`estado` text DEFAULT 'solicitado' NOT NULL,
	`adicional_id` text,
	`origen` text DEFAULT 'web' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`solicitante_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `compras` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`proveedor_id` text,
	`rubro_id` text,
	`insumo_id` text,
	`solicitud_id` text,
	`respuesta_id` text,
	`descripcion` text NOT NULL,
	`cantidad` real DEFAULT 1 NOT NULL,
	`unidad` text DEFAULT 'gl' NOT NULL,
	`precio_unitario` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`fecha` text NOT NULL,
	`estado` text DEFAULT 'prevista' NOT NULL,
	`pagado` real DEFAULT 0 NOT NULL,
	`requiere_aprobacion_cliente` integer DEFAULT false NOT NULL,
	`aprobacion_cliente` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `conversacion_pendientes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`canal` text NOT NULL,
	`obra_id` text,
	`tipo` text NOT NULL,
	`payload` text NOT NULL,
	`descripcion` text NOT NULL,
	`expira` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cotizaciones` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`titulo` text NOT NULL,
	`lineas` text DEFAULT '[]' NOT NULL,
	`estado` text DEFAULT 'borrador' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documentos` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`subido_por` text NOT NULL,
	`nombre` text NOT NULL,
	`ruta` text NOT NULL,
	`mime` text,
	`tamano` integer,
	`categoria` text DEFAULT 'general' NOT NULL,
	`visible_cliente` integer DEFAULT true NOT NULL,
	`visible_obrero` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subido_por`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `insumos` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`clave` text,
	`tipo` text NOT NULL,
	`nombre` text NOT NULL,
	`unidad` text NOT NULL,
	`precio` real DEFAULT 0 NOT NULL,
	`precio_actualizado` integer,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `intentos_acceso` (
	`clave` text PRIMARY KEY NOT NULL,
	`fallos` integer DEFAULT 0 NOT NULL,
	`bloqueado_hasta` integer,
	`actualizado` integer
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`rubro_id` text NOT NULL,
	`orden` integer NOT NULL,
	`plantilla_key` text,
	`nombre` text NOT NULL,
	`unidad` text NOT NULL,
	`formula` text,
	`cantidad_calc` real DEFAULT 0 NOT NULL,
	`cantidad_manual` real,
	`hh_por_unidad` real DEFAULT 0 NOT NULL,
	`duracion_manual` integer,
	`duracion` integer DEFAULT 1 NOT NULL,
	`predecesoras` text DEFAULT '[]' NOT NULL,
	`inicio_min` text,
	`inicio` text,
	`fin` text,
	`es_hito` integer DEFAULT false NOT NULL,
	`avance_real` real DEFAULT 0 NOT NULL,
	`cantidad_ejecutada` real DEFAULT 0 NOT NULL,
	`asignado_a` text,
	`notas` text,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rubro_id`) REFERENCES `rubros`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `items_obra_idx` ON `items` (`obra_id`);--> statement-breakpoint
CREATE TABLE `mensajes` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`canal` text NOT NULL,
	`autor_id` text NOT NULL,
	`tipo` text DEFAULT 'mensaje' NOT NULL,
	`texto` text NOT NULL,
	`adjuntos` text DEFAULT '[]' NOT NULL,
	`origen` text DEFAULT 'web' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`autor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mensajes_obra_canal_idx` ON `mensajes` (`obra_id`,`canal`);--> statement-breakpoint
CREATE TABLE `miembros` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`nombre` text,
	`rol` text NOT NULL,
	`oficio` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `miembros_obra_idx` ON `miembros` (`obra_id`);--> statement-breakpoint
CREATE INDEX `miembros_email_idx` ON `miembros` (`email`);--> statement-breakpoint
CREATE TABLE `notificaciones` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`obra_id` text,
	`texto` text NOT NULL,
	`link` text,
	`leida` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notif_user_idx` ON `notificaciones` (`user_id`);--> statement-breakpoint
CREATE TABLE `obras` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`codigo` text NOT NULL,
	`nombre` text NOT NULL,
	`direccion` text,
	`localidad` text,
	`provincia` text,
	`tipo` text NOT NULL,
	`sistema` text NOT NULL,
	`sup_cubierta` real DEFAULT 0 NOT NULL,
	`sup_semicubierta` real DEFAULT 0 NOT NULL,
	`niveles` integer DEFAULT 1 NOT NULL,
	`fecha_inicio` text NOT NULL,
	`duracion_estimada_dias` integer,
	`cliente_nombre` text,
	`cliente_email` text,
	`cliente_telefono` text,
	`arquitecto_responsable` text,
	`caracteristicas` text,
	`presupuesto_inicial` real,
	`estado` text DEFAULT 'activa' NOT NULL,
	`parametros` text DEFAULT '{}' NOT NULL,
	`gastos_generales_pct` real DEFAULT 10 NOT NULL,
	`beneficio_pct` real DEFAULT 10 NOT NULL,
	`honorarios_pct` real DEFAULT 8 NOT NULL,
	`iva_pct` real DEFAULT 0 NOT NULL,
	`cuadrilla_hh_dia` real DEFAULT 16 NOT NULL,
	`cliente_puede_ver_detalle` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proveedores` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`nombre` text NOT NULL,
	`rubro` text,
	`localidad` text,
	`direccion` text,
	`telefono` text,
	`whatsapp` text,
	`email` text,
	`canal` text DEFAULT 'email' NOT NULL,
	`notas` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recursos` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`insumo_id` text NOT NULL,
	`consumo` real NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`insumo_id`) REFERENCES `insumos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`hash` text NOT NULL,
	`expira` integer NOT NULL,
	`usado` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `respuestas_cotizacion` (
	`id` text PRIMARY KEY NOT NULL,
	`cotizacion_id` text NOT NULL,
	`proveedor_id` text NOT NULL,
	`precios` text DEFAULT '[]' NOT NULL,
	`envio` real DEFAULT 0 NOT NULL,
	`plazo_entrega_dias` integer,
	`condiciones_pago` text,
	`disponibilidad` text,
	`canal_envio` text,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`token` text,
	`enviada_en` integer,
	`respondida_por` text,
	`respondida_en` integer,
	`notas_proveedor` text,
	`estado_pedido` text DEFAULT 'sin_pedido' NOT NULL,
	`fecha_entrega` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cotizacion_id`) REFERENCES `cotizaciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rubros` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`orden` integer NOT NULL,
	`codigo` text NOT NULL,
	`nombre` text NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `solicitudes` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`solicitante_id` text NOT NULL,
	`tipo` text DEFAULT 'material' NOT NULL,
	`material` text NOT NULL,
	`insumo_id` text,
	`cantidad` real NOT NULL,
	`unidad` text NOT NULL,
	`fecha_necesaria` text,
	`item_id` text,
	`observaciones` text,
	`prioridad` text DEFAULT 'media' NOT NULL,
	`fotos` text DEFAULT '[]' NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`respuesta` text,
	`origen` text DEFAULT 'web' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`solicitante_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suscripciones` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan` text NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`proveedor` text DEFAULT 'mercadopago' NOT NULL,
	`id_externo` text,
	`monto` real NOT NULL,
	`checkout_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`nombre` text NOT NULL,
	`password_hash` text NOT NULL,
	`plan` text DEFAULT 'gratuito' NOT NULL,
	`telefono` text,
	`avisos_email` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `wa_contactos` (
	`id` text PRIMARY KEY NOT NULL,
	`telefono` text NOT NULL,
	`user_id` text,
	`nombre` text,
	`estado` text DEFAULT 'invitado' NOT NULL,
	`codigo_vinculacion` text,
	`codigo_expira` integer,
	`obra_activa_id` text,
	`ultimo_entrante` integer,
	`notificaciones` integer DEFAULT true NOT NULL,
	`invitado_por` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wa_contactos_telefono_unique` ON `wa_contactos` (`telefono`);--> statement-breakpoint
CREATE TABLE `wa_mensajes` (
	`id` text PRIMARY KEY NOT NULL,
	`contacto_id` text NOT NULL,
	`obra_id` text,
	`direccion` text NOT NULL,
	`tipo` text NOT NULL,
	`texto` text,
	`transcripcion` text,
	`media_doc_id` text,
	`opciones` text,
	`wa_message_id` text,
	`intencion` text,
	`estado` text DEFAULT 'recibido' NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contacto_id`) REFERENCES `wa_contactos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `wa_msg_contacto_idx` ON `wa_mensajes` (`contacto_id`);