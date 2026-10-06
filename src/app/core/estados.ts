import type { EstadoOrden } from './models';

export interface InfoEstado {
  label: string;
  /** Fondo y texto de la pastilla. */
  bg: string;
  fg: string;
  /** Color del punto en el panel del día. */
  c: string;
}

export const ESTADOS: Record<EstadoOrden, InfoEstado> = {
  recibida: { label: 'Recibida', bg: 'var(--gray-100)', fg: 'var(--gray-700)', c: 'var(--gray-500)' },
  diagnostico: { label: 'En diagnóstico', bg: 'var(--zinc-900)', fg: '#fff', c: 'var(--zinc-800)' },
  cotizacion: { label: 'Cotización enviada', bg: 'var(--warning-100)', fg: 'var(--warning-700)', c: 'var(--warning-500)' },
  aprobada: { label: 'Aprobada', bg: 'var(--success-100)', fg: 'var(--success-700)', c: 'var(--success-600)' },
  reparacion: { label: 'En reparación', bg: 'var(--red-100)', fg: 'var(--red-700)', c: 'var(--red-600)' },
  repuesto: { label: 'Esperando repuesto', bg: 'var(--warning-100)', fg: 'var(--warning-700)', c: 'var(--warning-600)' },
  lista: { label: 'Lista para entrega', bg: 'var(--success-100)', fg: 'var(--success-700)', c: 'var(--success-500)' },
  entregada: { label: 'Entregada', bg: 'var(--gray-100)', fg: 'var(--gray-600)', c: 'var(--gray-400)' },
  rechazada: { label: 'Rechazada por el cliente', bg: 'var(--danger-100)', fg: 'var(--danger-700)', c: 'var(--danger-500)' },
  abandonada: { label: 'Abandonada', bg: 'var(--zinc-800)', fg: '#fff', c: 'var(--zinc-700)' },
};

/** El camino normal de una orden. Rechazada y Abandonada se salen de él. */
export const CAMINO: EstadoOrden[] = [
  'recibida',
  'diagnostico',
  'cotizacion',
  'aprobada',
  'reparacion',
  'repuesto',
  'lista',
  'entregada',
];

/** Estados en los que la bici sigue físicamente en el taller. */
export const EN_TALLER: EstadoOrden[] = ['recibida', 'diagnostico', 'cotizacion', 'aprobada', 'reparacion', 'repuesto', 'lista'];

/** Estados en los que el mecánico tiene trabajo pendiente. */
export const DEL_MECANICO: EstadoOrden[] = ['diagnostico', 'aprobada', 'reparacion', 'repuesto'];
