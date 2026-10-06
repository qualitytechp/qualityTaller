import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CajaService, FUENTES } from '../../core/caja.service';
import { db, nuevoId, vivo } from '../../core/db';
import { normalizar, plata } from '../../core/formato';
import type { Fuente, Proveedor, Repuesto } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { CampoPlataComponent } from '../../shared/campo-plata.component';
import { HojaComponent } from '../../shared/hoja.component';
import { OpcionHojaComponent } from '../../shared/opcion-hoja.component';
import { PasosComponent } from '../../shared/pasos.component';

interface Linea {
  repuestoId: string;
  nombre: string;
  cantidad: number;
  costo: number;
}

const TITULOS = ['¿A quién le compraste?', '¿Qué llegó?', '¿Cómo se paga?'];
const AYUDAS = [
  'Escoge el proveedor y, si tienes, el número de la factura.',
  'Cada repuesto con cuántos llegaron y cuánto costó cada uno. El inventario sube al guardar.',
  'Lo que no pagues ahora queda como deuda con el proveedor.',
];

@Component({
  selector: 'qt-nueva-compra',
  imports: [FormsModule, CampoPlataComponent, HojaComponent, OpcionHojaComponent, PasosComponent],
  templateUrl: './nueva-compra.page.html',
  styleUrl: './nueva-compra.page.css',
})
export class NuevaCompraPage {
  private readonly caja = inject(CajaService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  protected readonly plata = plata;
  protected readonly fuentes = FUENTES;
  protected readonly titulos = TITULOS;
  protected readonly ayudas = AYUDAS;

  protected readonly paso = signal(1);
  protected readonly proveedorId = signal<string | null>(null);
  protected readonly factura = signal('');
  protected readonly lineas = signal<Linea[]>([]);
  protected readonly pagado = signal(0);
  private pagoTocado = false;
  protected readonly fuente = signal<Fuente>('Banco');
  protected readonly hoja = signal<'repuestos' | 'nuevo' | null>(null);
  protected readonly busqueda = signal('');
  protected readonly repNuevo = signal({ nombre: '', precio: 0 });
  protected readonly guardando = signal(false);

  protected readonly datos = vivo(
    async () => ({ proveedores: await db.proveedores.toArray(), repuestos: await db.repuestos.toArray() }),
    { proveedores: [] as Proveedor[], repuestos: [] as Repuesto[] },
  );

  protected readonly total = computed(() => this.lineas().reduce((s, l) => s + l.cantidad * l.costo, 0));
  protected readonly queda = computed(() => Math.max(0, this.total() - this.pagado()));
  protected readonly proveedor = computed(() => this.datos.valor().proveedores.find((p) => p.id === this.proveedorId()));

  protected readonly repuestosVistos = computed(() => {
    const q = normalizar(this.busqueda());
    return this.datos
      .valor()
      .repuestos.filter((r) => !q || normalizar(r.nombre + ' ' + r.ref + ' ' + r.marca).includes(q))
      .sort((a, b) => (a.proveedorId === this.proveedorId() ? -1 : 0) - (b.proveedorId === this.proveedorId() ? -1 : 0) || a.nombre.localeCompare(b.nombre));
  });

  protected readonly falta = computed(() => {
    if (this.paso() === 1) return this.proveedorId() ? '' : 'Escoge el proveedor';
    if (this.paso() === 2) {
      if (!this.lineas().length) return 'Agrega al menos un repuesto';
      return this.lineas().some((l) => l.costo <= 0) ? 'Falta el costo de algún repuesto' : '';
    }
    return '';
  });

  constructor() {
    // Mientras no lo cambien, se paga todo.
    effect(() => {
      const t = this.total();
      if (!this.pagoTocado) this.pagado.set(t);
    });
  }

  escribirPago(n: number): void {
    this.pagoTocado = true;
    this.pagado.set(n);
  }

  agregar(r: Repuesto): void {
    if (!this.lineas().some((l) => l.repuestoId === r.id)) {
      this.lineas.update((l) => [...l, { repuestoId: r.id, nombre: r.nombre, cantidad: 1, costo: r.costo }]);
    }
    this.hoja.set(null);
  }

  cambiarLinea(id: string, c: Partial<Linea>): void {
    this.lineas.update((l) => l.map((x) => (x.repuestoId === id ? { ...x, ...c } : x)).filter((x) => x.cantidad > 0));
  }

  async crearRepuesto(): Promise<void> {
    const n = this.repNuevo();
    if (!n.nombre.trim() || n.precio <= 0) {
      this.ui.avisar('Escribe el nombre y el precio de venta');
      return;
    }
    const r: Repuesto = { id: nuevoId(), nombre: n.nombre.trim(), ref: '', marca: '', costo: 0, precio: n.precio, cantidad: 0, minimo: 2, proveedorId: this.proveedorId() ?? undefined, ultimaEntrada: Date.now() };
    await db.repuestos.add(r);
    this.lineas.update((l) => [...l, { repuestoId: r.id, nombre: r.nombre, cantidad: 1, costo: 0 }]);
    this.repNuevo.set({ nombre: '', precio: 0 });
    this.hoja.set(null);
  }

  atras(): void {
    if (this.paso() === 1) this.router.navigate(['/compras']);
    else this.paso.update((p) => p - 1);
  }

  async siguiente(): Promise<void> {
    if (this.falta()) {
      this.ui.avisar(this.falta());
      return;
    }
    if (this.paso() < 3) {
      this.paso.update((p) => p + 1);
      window.scrollTo(0, 0);
      return;
    }
    const p = this.proveedor();
    if (!p || this.guardando()) return;
    const pagado = Math.min(this.pagado(), this.total());
    const ok = await this.ui.confirmar({
      titulo: 'Guardar la compra',
      texto:
        'Compra a ' + p.nombre + ' por ' + plata(this.total()) + '. ' +
        (pagado > 0 ? 'Se pagan ' + plata(pagado) + ' ahora. ' : '') +
        (this.queda() > 0 ? 'Quedas debiendo ' + plata(this.queda()) + '. ' : '') +
        'El inventario sube.',
      si: 'Sí, guardar',
    });
    if (!ok) return;
    this.guardando.set(true);
    try {
      await this.caja.registrarCompra({ proveedorId: p.id, factura: this.factura(), items: this.lineas(), pagado, fuente: this.fuente() });
      this.ui.avisar('Compra guardada · el inventario subió');
      this.router.navigate(['/compras'], { replaceUrl: true });
    } catch (e) {
      console.error(e);
      this.guardando.set(false);
      this.ui.avisar('No se pudo guardar la compra. Intenta otra vez.');
    }
  }
}
