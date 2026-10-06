import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CajaService, FUENTES } from '../../core/caja.service';
import { db, nuevoId, vivo } from '../../core/db';
import { cuando, plata, soloDigitos } from '../../core/formato';
import type { Compra, Fuente, Proveedor } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { abrirWhatsApp } from '../../core/whatsapp';
import { CampoPlataComponent } from '../../shared/campo-plata.component';
import { HojaComponent } from '../../shared/hoja.component';
import { CargandoComponent, VacioComponent } from '../../shared/vacio.component';

@Component({
  selector: 'qt-compras',
  imports: [FormsModule, RouterLink, CampoPlataComponent, HojaComponent, CargandoComponent, VacioComponent],
  templateUrl: './compras.page.html',
  styleUrl: './compras.page.css',
})
export class ComprasPage {
  private readonly caja = inject(CajaService);
  private readonly ui = inject(UiService);
  protected readonly plata = plata;
  protected readonly cuando = cuando;
  protected readonly fuentes = FUENTES;

  protected readonly abono = signal<{ proveedor: Proveedor; monto: number; fuente: Fuente } | null>(null);
  protected readonly nuevo = signal<{ nombre: string; celular: string } | null>(null);

  protected readonly datos = vivo(
    async () => {
      const [proveedores, compras, taller] = await Promise.all([
        db.proveedores.toArray(),
        db.compras.orderBy('fecha').reverse().limit(15).toArray(),
        db.taller.get('taller'),
      ]);
      return { proveedores, compras, nombreTaller: taller?.nombre ?? '' };
    },
    { proveedores: [] as Proveedor[], compras: [] as Compra[], nombreTaller: '' },
  );

  protected readonly proveedores = computed(() => [...this.datos.valor().proveedores].sort((a, b) => b.debe - a.debe || a.nombre.localeCompare(b.nombre)));
  protected readonly debo = computed(() => this.proveedores().reduce((s, p) => s + p.debe, 0));

  nombreDe(id: string): string {
    return this.datos.valor().proveedores.find((p) => p.id === id)?.nombre ?? 'Proveedor';
  }

  ultima(p: Proveedor): string {
    const k = this.datos.valor().compras.find((c) => c.proveedorId === p.id);
    return k ? 'Última compra ' + cuando(k.fecha, false).toLowerCase() : 'Sin compras registradas';
  }

  detalle(k: Compra): string {
    return k.items.map((i) => i.nombre + ' ×' + i.cantidad).join(' · ');
  }

  escribir(p: Proveedor): void {
    abrirWhatsApp(p.celular, 'Buenas ' + p.nombre + ', de ' + this.datos.valor().nombreTaller + '. Necesito hacerle un pedido.');
  }

  abrirAbono(p: Proveedor): void {
    this.abono.set({ proveedor: p, monto: p.debe, fuente: 'Banco' });
  }

  cambiarAbono(c: Partial<{ monto: number; fuente: Fuente }>): void {
    this.abono.update((a) => (a ? { ...a, ...c } : a));
  }

  async abonar(): Promise<void> {
    const a = this.abono();
    if (!a || a.monto <= 0) {
      this.ui.avisar('Escribe cuánto le abonas');
      return;
    }
    const monto = Math.min(a.monto, a.proveedor.debe);
    const queda = a.proveedor.debe - monto;
    const ok = await this.ui.confirmar({
      titulo: 'Abonar a ' + a.proveedor.nombre,
      texto: 'Se registra un abono de ' + plata(monto) + (queda > 0 ? ' y le quedas debiendo ' + plata(queda) : ' y quedas al día') + '. Sale de la caja.',
      si: 'Sí, registrar el abono',
    });
    if (!ok) return;
    try {
      await this.caja.abonoProveedor(a.proveedor.id, monto, a.fuente);
      this.abono.set(null);
      this.ui.avisar('Abono registrado a ' + a.proveedor.nombre);
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo registrar el abono. Intenta otra vez.');
    }
  }

  async guardarProveedor(): Promise<void> {
    const p = this.nuevo();
    if (!p || !p.nombre.trim() || soloDigitos(p.celular).length < 7) {
      this.ui.avisar('Escribe el nombre y un celular válido');
      return;
    }
    await db.proveedores.add({ id: nuevoId(), nombre: p.nombre.trim(), celular: p.celular.trim(), debe: 0 });
    this.nuevo.set(null);
    this.ui.avisar('Proveedor agregado');
  }
}
