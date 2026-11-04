/**
 * "Cómo termina la obra": proyección del costo al cierre por rubro.
 * - avance: % físico ponderado por el costo de cada tarea.
 * - Si el rubro ya avanzó lo suficiente (≥15 %) se proyecta con el rendimiento real
 *   (gasto real / valor ganado), acotado entre 0,7 y 1,5 para no exagerar con datos tempranos.
 * - Si todavía no, se toma lo presupuestado (o lo gastado, si ya se pasó).
 */
export type RubroProyeccion = { id: string; nombre: string; presupuestado: number; avance: number; gastado: number; estimado: number; desvio: number; base: "tendencia" | "presupuesto" };

export function proyectarRubro(id: string, nombre: string, presupuestado: number, avancePct: number, gastado: number): RubroProyeccion {
  const av = Math.max(0, Math.min(100, avancePct)) / 100;
  const ganado = presupuestado * av;
  const restante = presupuestado * (1 - av);
  let estimado: number;
  let base: RubroProyeccion["base"] = "presupuesto";
  if (av >= 0.15 && gastado > 0 && ganado > 0) {
    const factor = Math.max(0.7, Math.min(1.5, gastado / ganado));
    estimado = av >= 1 ? gastado : gastado + restante * factor;
    base = "tendencia";
  } else {
    estimado = Math.max(presupuestado, gastado);
  }
  return { id, nombre, presupuestado, avance: av * 100, gastado, estimado, desvio: estimado - presupuestado, base };
}

export function proyectarObra(
  rubros: { id: string; nombre: string; presupuestado: number; items: { peso: number; avance: number }[] }[],
  gastadoPorRubro: Map<string, number>,
) {
  const filas = rubros.map((r) => {
    const peso = r.items.reduce((s, i) => s + i.peso, 0);
    const av = peso > 0 ? r.items.reduce((s, i) => s + i.peso * i.avance, 0) / peso : 0;
    return proyectarRubro(r.id, r.nombre, r.presupuestado, av, gastadoPorRubro.get(r.id) ?? 0);
  });
  const presupuestado = filas.reduce((s, f) => s + f.presupuestado, 0);
  const estimado = filas.reduce((s, f) => s + f.estimado, 0);
  return { filas, presupuestado, estimado, desvio: estimado - presupuestado };
}
