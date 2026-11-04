CREATE TABLE `partes_diarios` (
	`id` text PRIMARY KEY NOT NULL,
	`obra_id` text NOT NULL,
	`autor_id` text NOT NULL,
	`fecha` text NOT NULL,
	`personas` integer DEFAULT 0 NOT NULL,
	`horas` real DEFAULT 0 NOT NULL,
	`clima` text DEFAULT 'bueno' NOT NULL,
	`trabajos` text,
	`problema` text,
	`fotos` text DEFAULT '[]' NOT NULL,
	`origen` text DEFAULT 'web' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`obra_id`) REFERENCES `obras`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`autor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `partes_obra_fecha_idx` ON `partes_diarios` (`obra_id`,`fecha`);--> statement-breakpoint
ALTER TABLE `obras` ADD `portal_cliente` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `dni` text;--> statement-breakpoint
ALTER TABLE `users` ADD `pin_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_dni_unique` ON `users` (`dni`);