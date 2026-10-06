import Dexie, { type Table, liveQuery } from 'dexie';
import { DestroyRef, Signal, inject, signal } from '@angular/core';
import type {
  Bici,
  CierreCaja,
  Cliente,
  Compra,
  Foto,
  KV,
  Movimiento,
  Orden,
  Persona,
  Proveedor,
  Repuesto,
  Servicio,
  Taller,
  Venta,
} from './models';

/** Base de datos local del taller. Cada celular tiene la suya. */
export class TallerDB extends Dexie {
  taller!: Table<Taller, string>;
  personas!: Table<Persona, string>;
  clientes!: Table<Cliente, string>;
  bicis!: Table<Bici, string>;
  ordenes!: Table<Orden, string>;
  repuestos!: Table<Repuesto, string>;
  servicios!: Table<Servicio, string>;
  proveedores!: Table<Proveedor, string>;
  compras!: Table<Compra, string>;
  movimientos!: Table<Movimiento, string>;
  ventas!: Table<Venta, string>;
  cierres!: Table<CierreCaja, string>;
  fotos!: Table<Foto, string>;
  kv!: Table<KV, string>;

  constructor() {
    super('qualitytaller');
    this.version(1).stores({
      taller: 'id',
      personas: 'id, rol',
      clientes: 'id, nombre, celular',
      bicis: 'id, clienteId, serie',
      ordenes: 'numero, estado, clienteId, biciId, mecanicoId, recibida',
      repuestos: 'id, nombre',
      servicios: 'id, categoria',
      proveedores: 'id',
      compras: 'id, proveedorId, fecha',
      movimientos: 'id, en',
      ventas: 'numero, en',
      cierres: 'id, en',
      fotos: 'id',
      kv: 'k',
    });
  }
}

export const db = new TallerDB();

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Resultado de una consulta en vivo: el dato, si está cargando y si falló. */
export interface Vivo<T> {
  valor: Signal<T>;
  cargando: Signal<boolean>;
  error: Signal<string | null>;
}

/**
 * Consulta que se actualiza sola cuando cambian los datos.
 * Se llama dentro de un contexto de inyección (constructor o campo de un componente).
 */
export function vivo<T>(consulta: () => T | Promise<T>, inicial: T): Vivo<T> {
  const valor = signal<T>(inicial);
  const cargando = signal(true);
  const error = signal<string | null>(null);
  const sub = liveQuery(consulta).subscribe({
    next: (v) => {
      valor.set(v);
      cargando.set(false);
      error.set(null);
    },
    error: (e: unknown) => {
      console.error(e);
      cargando.set(false);
      error.set('No se pudieron leer los datos del celular. Cierra la app y vuelve a abrirla.');
    },
  });
  inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  return { valor: valor.asReadonly(), cargando: cargando.asReadonly(), error: error.asReadonly() };
}

export async function leerKV<T>(k: string): Promise<T | undefined> {
  return (await db.kv.get(k))?.v as T | undefined;
}

export async function guardarKV(k: string, v: unknown): Promise<void> {
  await db.kv.put({ k, v });
}

/** Pide a iOS que no borre los datos de la app aunque falte espacio. */
export async function pedirAlmacenamientoPersistente(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
