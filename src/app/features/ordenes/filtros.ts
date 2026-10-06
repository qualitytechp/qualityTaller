import { EN_TALLER } from '../../core/estados';
import { diasEntre } from '../../core/formato';
import type { Orden } from '../../core/models';
import { estaTarde } from '../../core/ordenes.service';

export interface FiltroOrdenes {
  k: string;
  label: string;
  prueba: ((o: Orden, ahora: number) => boolean) | null;
  /** Los filtros especiales solo salen como pastilla cuando se llega desde una alerta de Inicio. */
  especial?: boolean;
}

/** Desde cuántos días en el taller una bici se considera "vieja". */
export const DIAS_MUCHOS = 15;

const estado = (...estados: Orden['estado'][]) => (o: Orden) => estados.includes(o.estado);

function finDelDia(ahora: number): number {
  const d = new Date(ahora);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Prometidas para hoy o antes, y todavía sin terminar. */
export function prometidaSinTerminar(o: Orden, ahora: number): boolean {
  return estaTarde(o, finDelDia(ahora));
}

export function muchosDias(o: Orden, ahora: number): boolean {
  return EN_TALLER.includes(o.estado) && diasEntre(o.recibida, ahora) >= DIAS_MUCHOS;
}

/** Pastillas de la lista de órdenes. "En reparación" agrupa lo que está en manos del mecánico. */
export const FILTROS: FiltroOrdenes[] = [
  { k: 'todas', label: 'Todas', prueba: null },
  { k: 'recibida', label: 'Por diagnosticar', prueba: estado('recibida') },
  { k: 'cotizacion', label: 'Esperando aprobación', prueba: estado('cotizacion') },
  { k: 'reparacion', label: 'En reparación', prueba: estado('diagnostico', 'aprobada', 'reparacion') },
  { k: 'repuesto', label: 'Esperando repuesto', prueba: estado('repuesto') },
  { k: 'lista', label: 'Listas', prueba: estado('lista') },
  { k: 'entregada', label: 'Entregadas', prueba: estado('entregada') },
  { k: 'cerradas', label: 'Rechazadas y abandonadas', prueba: estado('rechazada', 'abandonada') },
  { k: 'hoy', label: 'Prometidas para hoy', prueba: prometidaSinTerminar, especial: true },
  { k: 'viejas', label: 'Muchos días en el taller', prueba: muchosDias, especial: true },
];
