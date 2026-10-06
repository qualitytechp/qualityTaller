import { Injectable, inject } from '@angular/core';
import { db, nuevoId } from './db';
import { fuenteDe, type Item, type MedioPago } from './models';
import { SesionService } from './sesion.service';
import { subtotal } from './ordenes.service';

@Injectable({ providedIn: 'root' })
export class VentasService {
  private readonly sesion = inject(SesionService);

  /**
   * Cobra una venta de mostrador: numera la venta, baja el inventario y registra la plata
   * en la caja, todo junto. Si algo ya no alcanza, no se cobra nada.
   */
  async vender(items: Item[], medio: MedioPago): Promise<string> {
    const ahora = Date.now();
    return db.transaction('rw', [db.taller, db.repuestos, db.ventas, db.movimientos], async () => {
      for (const i of items) {
        if (i.tipo !== 'repuesto' || !i.refId) continue;
        const r = await db.repuestos.get(i.refId);
        if (!r || r.cantidad < i.cantidad) throw new Error('Ya no alcanza: ' + i.nombre);
        await db.repuestos.put({ ...r, cantidad: r.cantidad - i.cantidad, ultimaSalida: ahora });
      }
      const taller = await db.taller.get('taller');
      if (!taller) throw new Error('No hay taller configurado');
      const numero = 'VTA-' + taller.siguienteVenta;
      await db.taller.update('taller', { siguienteVenta: taller.siguienteVenta + 1 });
      const total = subtotal(items);
      await db.ventas.add({ numero, items, total, medio, en: ahora, personaId: this.sesion.persona()?.id });
      await db.movimientos.add({
        id: nuevoId(),
        tipo: 'entra',
        concepto: 'Venta de vitrina ' + numero,
        fuente: fuenteDe(medio),
        medio,
        monto: total,
        en: ahora,
        personaId: this.sesion.persona()?.id,
        origen: { tipo: 'venta', ref: numero },
      });
      return numero;
    });
  }
}
