import { Injectable, inject } from '@angular/core';
import { db, nuevoId } from './db';
import { plata } from './formato';
import { fuenteDe, type Fuente, type MedioPago, type Movimiento } from './models';
import { SesionService } from './sesion.service';

export const FUENTES: { k: Fuente; label: string; meta: string }[] = [
  { k: 'Efectivo', label: 'Efectivo en el cajón', meta: 'Lo que se puede contar' },
  { k: 'Banco', label: 'Banco', meta: 'Transferencias y tarjeta' },
  { k: 'Digital', label: 'Billeteras digitales', meta: 'Nequi y Daviplata' },
];

/** Saldo de cada fuente: todo lo que entró menos todo lo que salió. */
export function saldos(movs: Movimiento[]): Record<Fuente, number> {
  const s: Record<Fuente, number> = { Efectivo: 0, Banco: 0, Digital: 0 };
  for (const m of movs) s[m.fuente] += m.tipo === 'entra' ? m.monto : -m.monto;
  return s;
}

/** Los saldos iniciales no son movimiento del día. */
export function delDia(m: Movimiento): boolean {
  return m.origen?.tipo !== 'saldo';
}

@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly sesion = inject(SesionService);

  private mov(tipo: Movimiento['tipo'], concepto: string, fuente: Fuente, monto: number, origen: Movimiento['origen']): Movimiento {
    return { id: nuevoId(), tipo, concepto, fuente, monto, en: Date.now(), personaId: this.sesion.persona()?.id, origen };
  }

  /** El cliente abona a lo que debe: baja su cartera y entra la plata. */
  async abonoCliente(clienteId: string, monto: number, medio: MedioPago): Promise<void> {
    await db.transaction('rw', [db.clientes, db.movimientos], async () => {
      const c = await db.clientes.get(clienteId);
      if (!c) throw new Error('No existe el cliente');
      const paga = Math.min(monto, c.debe);
      const debe = c.debe - paga;
      await db.clientes.put({ ...c, debe, debeDesde: debe > 0 ? c.debeDesde : undefined });
      await db.movimientos.add({ ...this.mov('entra', 'Abono de ' + c.nombre, fuenteDe(medio), paga, { tipo: 'abono', ref: c.id }), medio });
    });
  }

  /** Abono a un proveedor: baja la deuda, se aplica a las facturas más viejas y sale la plata. */
  async abonoProveedor(proveedorId: string, monto: number, fuente: Fuente): Promise<void> {
    await db.transaction('rw', [db.proveedores, db.compras, db.movimientos], async () => {
      const p = await db.proveedores.get(proveedorId);
      if (!p) throw new Error('No existe el proveedor');
      const paga = Math.min(monto, p.debe);
      await db.proveedores.put({ ...p, debe: p.debe - paga });
      let resto = paga;
      const pendientes = (await db.compras.where('proveedorId').equals(proveedorId).sortBy('fecha')).filter((k) => k.pagado < k.total);
      for (const k of pendientes) {
        if (resto <= 0) break;
        const abono = Math.min(resto, k.total - k.pagado);
        await db.compras.put({ ...k, pagado: k.pagado + abono });
        resto -= abono;
      }
      await db.movimientos.add(this.mov('sale', 'Abono a ' + p.nombre, fuente, paga, { tipo: 'compra', ref: p.id }));
    });
  }

  /**
   * Registra una compra a un proveedor: sube el inventario, actualiza el costo de cada
   * repuesto, suma a lo que se le debe y, si se pagó algo, lo saca de la caja.
   */
  async registrarCompra(c: {
    proveedorId: string;
    factura: string;
    items: { repuestoId: string; nombre: string; cantidad: number; costo: number }[];
    pagado: number;
    fuente: Fuente;
  }): Promise<void> {
    const total = c.items.reduce((s, i) => s + i.cantidad * i.costo, 0);
    const pagado = Math.min(c.pagado, total);
    await db.transaction('rw', [db.proveedores, db.compras, db.repuestos, db.movimientos], async () => {
      const p = await db.proveedores.get(c.proveedorId);
      if (!p) throw new Error('No existe el proveedor');
      for (const i of c.items) {
        const r = await db.repuestos.get(i.repuestoId);
        if (!r) continue;
        await db.repuestos.put({ ...r, cantidad: r.cantidad + i.cantidad, costo: i.costo, proveedorId: r.proveedorId ?? p.id, ultimaEntrada: Date.now() });
      }
      await db.compras.add({ id: nuevoId(), proveedorId: p.id, factura: c.factura.trim(), fecha: Date.now(), total, pagado, items: c.items });
      await db.proveedores.put({ ...p, debe: p.debe + total - pagado });
      if (pagado > 0) {
        await db.movimientos.add(this.mov('sale', 'Compra a ' + p.nombre + (c.factura.trim() ? ' · ' + c.factura.trim() : ''), c.fuente, pagado, { tipo: 'compra', ref: p.id }));
      }
    });
  }

  async gasto(concepto: string, monto: number, fuente: Fuente): Promise<void> {
    await db.movimientos.add(this.mov('sale', concepto.trim(), fuente, monto, { tipo: 'gasto' }));
  }

  /** Con cuánta plata arranca el taller en cada fuente. */
  async saldosIniciales(montos: Record<Fuente, number>): Promise<void> {
    const nombres: Record<Fuente, string> = { Efectivo: 'del cajón', Banco: 'del banco', Digital: 'de billeteras' };
    await db.movimientos.bulkAdd(
      FUENTES.filter((f) => montos[f.k] > 0).map((f) => this.mov('entra', 'Saldo inicial ' + nombres[f.k], f.k, montos[f.k], { tipo: 'saldo' })),
    );
  }

  /**
   * Cierre del día: guarda lo que debía haber y lo que se contó. Si no cuadra, un ajuste
   * deja el cajón igual a lo contado y la diferencia queda registrada.
   */
  async cerrar(esperado: number, contado: number): Promise<void> {
    const diferencia = contado - esperado;
    await db.transaction('rw', [db.cierres, db.movimientos], async () => {
      const id = nuevoId();
      await db.cierres.add({ id, en: Date.now(), esperado, contado, diferencia, personaId: this.sesion.persona()?.id });
      if (diferencia !== 0) {
        await db.movimientos.add(
          this.mov(
            diferencia > 0 ? 'entra' : 'sale',
            'Ajuste de cierre: ' + (diferencia > 0 ? 'sobró ' : 'faltó ') + plata(Math.abs(diferencia)),
            'Efectivo',
            Math.abs(diferencia),
            { tipo: 'ajuste', ref: id },
          ),
        );
      }
    });
  }
}
