/** Modelo de datos del taller. Todo vive en el celular (IndexedDB). Las fechas son milisegundos desde 1970. */

export type Rol = 'admin' | 'mostrador' | 'mecanico';

export interface Persona {
  id: string;
  nombre: string;
  rol: Rol;
  pinHash: string;
  activo: boolean;
  /** Porcentaje de comisión sobre la mano de obra (solo mecánicos). */
  comision: number;
  creado: number;
}

export interface Taller {
  id: 'taller';
  nombre: string;
  logoId?: string;
  garantiaDias: number;
  textoRecibo: string;
  textoListo: string;
  siguienteOrden: number;
  siguienteVenta: number;
  creado: number;
}

export interface Cliente {
  id: string;
  nombre: string;
  celular: string;
  cedula?: string;
  correo?: string;
  desde: number;
  /** Saldo pendiente (cartera). */
  debe: number;
  /** Desde cuándo debe, para la cartera. */
  debeDesde?: number;
}

export const TIPOS_BICI = ['Ruta', 'Montaña', 'Urbana', 'Eléctrica', 'Infantil', 'BMX'] as const;
export type TipoBici = (typeof TIPOS_BICI)[number];

export interface Bici {
  id: string;
  clienteId: string;
  marca: string;
  modelo: string;
  tipo: TipoBici;
  color: string;
  talla: string;
  serie: string;
  grupo: string;
  frenos: string;
  suspension: string;
  rines: string;
  /** Fecha ISO (AAAA-MM-DD) del próximo mantenimiento. */
  proxMantenimiento?: string;
  fotoId?: string;
  creado: number;
}

export type EstadoOrden =
  | 'recibida'
  | 'diagnostico'
  | 'cotizacion'
  | 'aprobada'
  | 'reparacion'
  | 'repuesto'
  | 'lista'
  | 'entregada'
  | 'rechazada'
  | 'abandonada';

export type TipoItem = 'servicio' | 'repuesto' | 'suelto';

export interface Item {
  id: string;
  tipo: TipoItem;
  /** Id del servicio o repuesto del catálogo. */
  refId?: string;
  nombre: string;
  precio: number;
  cantidad: number;
  /** Costo unitario al momento de usarlo (para la utilidad). */
  costo?: number;
}

export interface Evento {
  en: number;
  personaId?: string;
  /** Nombre visible: "Sandra · Mostrador", "Cliente", "Sistema". */
  quien: string;
  que: string;
}

export type MomentoFoto = 'Llegada' | 'Diagnóstico' | 'Durante' | 'Después';

export interface FotoRef {
  id: string;
  momento: MomentoFoto;
  en: number;
}

export interface Tarea {
  texto: string;
  hecha: boolean;
}

export type Prioridad = 'Normal' | 'Urgente';

export const MEDIOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia', 'Nequi', 'Daviplata'] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

export interface Orden {
  numero: string;
  clienteId: string;
  biciId: string;
  estado: EstadoOrden;
  recibida: number;
  prometida: number;
  prioridad: Prioridad;
  mecanicoId?: string;
  adelanto: number;
  /** Lo que dijo el cliente, tal cual. No se edita después. */
  reportado: string;
  diagnostico: string;
  items: Item[];
  descuento: number;
  fotos: FotoRef[];
  accesorios: string[];
  golpes: string;
  historial: Evento[];
  tareas?: Tarea[];
  cotizacionEnviada?: number;
  aprobacion?: { en: number; quien: string; total: number; express?: boolean };
  pago?: { en: number; medio: MedioPago; monto: number };
  /** Cuándo el mecánico la marcó lista para entrega. */
  listaEn?: number;
  entregada?: number;
  garantiaHasta?: number;
  /** Si es una orden de garantía, el número de la orden original. */
  garantiaDe?: string;
  motivoGarantia?: string;
  actualizada: number;
}

export interface Repuesto {
  id: string;
  nombre: string;
  ref: string;
  marca: string;
  costo: number;
  precio: number;
  cantidad: number;
  minimo: number;
  proveedorId?: string;
  ultimaSalida?: number;
  /** Última vez que entraron unidades (compra o alta). */
  ultimaEntrada?: number;
}

export const CATEGORIAS_SERVICIO = [
  'General',
  'Frenos',
  'Transmisión',
  'Ruedas',
  'Suspensión',
  'Dirección',
  'Paquete',
] as const;
export type CategoriaServicio = (typeof CATEGORIAS_SERVICIO)[number];

export interface Servicio {
  id: string;
  nombre: string;
  categoria: CategoriaServicio;
  precio: number;
  minutos: number;
}

/** Dónde queda la plata: el cajón, el banco o las billeteras. */
export type Fuente = 'Efectivo' | 'Banco' | 'Digital';

export function fuenteDe(medio: MedioPago): Fuente {
  if (medio === 'Efectivo') return 'Efectivo';
  if (medio === 'Nequi' || medio === 'Daviplata') return 'Digital';
  return 'Banco';
}

export const ACCESORIOS = [
  'Luces',
  'Computador',
  'Portacaramañola',
  'Guardabarros',
  'Parrilla',
  'Candado',
  'Pedales especiales',
  'Timbre',
] as const;

export interface Movimiento {
  id: string;
  tipo: 'entra' | 'sale';
  concepto: string;
  fuente: Fuente;
  medio?: MedioPago;
  monto: number;
  en: number;
  personaId?: string;
  origen?: { tipo: 'orden' | 'venta' | 'abono' | 'gasto' | 'compra' | 'saldo' | 'ajuste'; ref?: string };
}

export interface Venta {
  numero: string;
  items: Item[];
  total: number;
  medio: MedioPago;
  en: number;
  personaId?: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  celular: string;
  debe: number;
}

export interface Compra {
  id: string;
  proveedorId: string;
  factura: string;
  fecha: number;
  total: number;
  pagado: number;
  items: { repuestoId?: string; nombre: string; cantidad: number; costo: number }[];
}

export interface CierreCaja {
  id: string;
  en: number;
  esperado: number;
  contado: number;
  diferencia: number;
  personaId?: string;
}

export interface Foto {
  id: string;
  blob: Blob;
  en: number;
}

export interface KV {
  k: string;
  v: unknown;
}
