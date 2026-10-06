import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { db, nuevoId, vivo } from '../../core/db';
import { normalizar, plata, plural } from '../../core/formato';
import { MEDIOS_PAGO, type Item, type MedioPago, type Repuesto } from '../../core/models';
import { subtotal } from '../../core/ordenes.service';
import { UiService } from '../../core/ui.service';
import { VentasService } from '../../core/ventas.service';
import { CampoPlataComponent } from '../../shared/campo-plata.component';
import { HojaComponent } from '../../shared/hoja.component';
import { CargandoComponent } from '../../shared/vacio.component';

@Component({
  selector: 'qt-venta',
  imports: [FormsModule, CampoPlataComponent, HojaComponent, CargandoComponent],
  templateUrl: './venta.page.html',
  styleUrl: './venta.page.css',
})
export class VentaPage implements OnDestroy {
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);
  private readonly ventas = inject(VentasService);

  protected readonly plata = plata;
  protected readonly medios = MEDIOS_PAGO;
  protected readonly busqueda = signal('');
  /** El carrito vive aquí: el inventario real solo baja al cobrar. */
  protected readonly carrito = signal<Item[]>([]);
  protected readonly medio = signal<MedioPago>('Efectivo');
  protected readonly suelto = signal<{ nombre: string; precio: number } | null>(null);
  protected readonly cobrando = signal(false);
  private cobrada = false;

  protected readonly repuestos = vivo(() => db.repuestos.toArray(), [] as Repuesto[]);

  /** Lo que queda de cada repuesto, descontando lo que ya está en el carrito. */
  disponible(r: Repuesto): number {
    return r.cantidad - this.carrito().filter((i) => i.refId === r.id).reduce((s, i) => s + i.cantidad, 0);
  }

  protected readonly catalogo = computed(() => {
    const q = normalizar(this.busqueda());
    this.carrito();
    return this.repuestos
      .valor()
      .filter((r) => this.disponible(r) > 0 && (!q || normalizar(r.nombre + ' ' + r.ref + ' ' + r.marca).includes(q)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  protected readonly total = computed(() => subtotal(this.carrito()));
  protected readonly unidades = computed(() => this.carrito().reduce((s, i) => s + i.cantidad, 0));
  protected readonly conteo = computed(() =>
    this.unidades() ? plural(this.unidades(), 'artículo', 'artículos') + ' · ' + this.medio() : 'Nada seleccionado',
  );

  metaRepuesto(r: Repuesto): string {
    const n = this.disponible(r);
    return r.ref + ' · quedan ' + n + (n <= r.minimo ? ' (bajo el mínimo)' : '');
  }

  metaLinea(i: Item): string {
    if (i.tipo === 'suelto') return plata(i.precio) + ' c/u · suelto';
    const r = this.repuestos.valor().find((x) => x.id === i.refId);
    return plata(i.precio) + ' c/u · quedan ' + (r ? this.disponible(r) : 0);
  }

  agregar(r: Repuesto): void {
    if (this.disponible(r) < 1) {
      this.ui.avisar('No queda ' + r.nombre);
      return;
    }
    const ya = this.carrito().find((i) => i.refId === r.id);
    if (ya) this.cambiar(ya.id, 1);
    else
      this.carrito.update((l) => [
        ...l,
        { id: nuevoId(), tipo: 'repuesto', refId: r.id, nombre: r.nombre, precio: r.precio, costo: r.costo, cantidad: 1 },
      ]);
  }

  cambiar(id: string, d: number): void {
    const i = this.carrito().find((x) => x.id === id);
    if (!i) return;
    if (d > 0 && i.tipo === 'repuesto') {
      const r = this.repuestos.valor().find((x) => x.id === i.refId);
      if (!r || this.disponible(r) < 1) {
        this.ui.avisar('No queda más de ' + i.nombre);
        return;
      }
    }
    this.carrito.update((l) => l.map((x) => (x.id === id ? { ...x, cantidad: x.cantidad + d } : x)).filter((x) => x.cantidad > 0));
  }

  abrirSuelto(): void {
    this.suelto.set({ nombre: this.busqueda().trim(), precio: 0 });
  }

  agregarSuelto(): void {
    const s = this.suelto();
    if (!s || !s.nombre.trim() || s.precio <= 0) {
      this.ui.avisar('Escribe qué es y cuánto vale');
      return;
    }
    this.carrito.update((l) => [...l, { id: nuevoId(), tipo: 'suelto', nombre: s.nombre.trim(), precio: s.precio, cantidad: 1 }]);
    this.suelto.set(null);
    this.busqueda.set('');
  }

  async cobrar(): Promise<void> {
    if (!this.total()) {
      this.ui.avisar('Agrega al menos un artículo');
      return;
    }
    if (this.cobrando()) return;
    const ok = await this.ui.confirmar({
      titulo: 'Confirmar la venta',
      texto: 'Se cobran ' + plata(this.total()) + ' en ' + this.medio() + ' y el inventario queda descargado.',
      si: 'Sí, cobrar',
      tono: 'verde',
    });
    if (!ok) return;
    this.cobrando.set(true);
    try {
      const numero = await this.ventas.vender(this.carrito(), this.medio());
      this.cobrada = true;
      this.router.navigate(['/venta-cobrada', numero], { replaceUrl: true });
    } catch (e) {
      console.error(e);
      this.cobrando.set(false);
      this.ui.avisar(e instanceof Error && e.message.startsWith('Ya no alcanza') ? e.message : 'No se pudo cobrar. Intenta otra vez.');
    }
  }

  ngOnDestroy(): void {
    if (!this.cobrada && this.carrito().length) this.ui.avisar('Venta cancelada · el inventario volvió a su sitio');
  }
}
