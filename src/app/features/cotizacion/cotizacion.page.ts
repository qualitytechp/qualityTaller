import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { db, nuevoId, vivo } from '../../core/db';
import { normalizar, plata, plural } from '../../core/formato';
import type { EstadoOrden, Item, Repuesto, Servicio } from '../../core/models';
import { OrdenesService, subtotal } from '../../core/ordenes.service';
import { UiService } from '../../core/ui.service';
import { abrirWhatsApp } from '../../core/whatsapp';
import { CampoPlataComponent } from '../../shared/campo-plata.component';
import { HojaComponent } from '../../shared/hoja.component';
import { OpcionHojaComponent } from '../../shared/opcion-hoja.component';
import { CargandoComponent, VacioComponent } from '../../shared/vacio.component';

/** Antes de que el cliente apruebe, la cotización se envía; después, solo se ajusta. */
const SE_COTIZA: EstadoOrden[] = ['recibida', 'diagnostico', 'cotizacion'];

@Component({
  selector: 'qt-cotizacion',
  imports: [CampoPlataComponent, HojaComponent, OpcionHojaComponent, CargandoComponent, VacioComponent],
  templateUrl: './cotizacion.page.html',
  styleUrl: './cotizacion.page.css',
})
export class CotizacionPage {
  private readonly router = inject(Router);
  private readonly ordenes = inject(OrdenesService);
  private readonly ui = inject(UiService);
  private readonly numero = inject(ActivatedRoute).snapshot.paramMap.get('numero') ?? '';

  protected readonly plata = plata;
  protected readonly items = signal<Item[]>([]);
  protected readonly descuento = signal(0);
  protected readonly hoja = signal<'servicios' | 'repuestos' | null>(null);
  protected readonly busqueda = signal('');
  protected readonly guardando = signal(false);
  private cargado = false;

  protected readonly datos = vivo(async () => {
    const orden = await db.ordenes.get(this.numero);
    if (!orden) return null;
    const [cliente, bici, servicios, repuestos, taller] = await Promise.all([
      db.clientes.get(orden.clienteId),
      db.bicis.get(orden.biciId),
      db.servicios.toArray(),
      db.repuestos.toArray(),
      db.taller.get('taller'),
    ]);
    // La primera vez se copian los ítems de la orden; después se trabaja sobre la copia.
    if (!this.cargado) {
      this.cargado = true;
      this.items.set(orden.items.map((i) => ({ ...i })));
      this.descuento.set(orden.descuento || 0);
    }
    return { orden, cliente, bici, servicios, repuestos, taller };
  }, null);

  protected readonly seCotiza = computed(() => SE_COTIZA.includes(this.datos.valor()?.orden.estado ?? 'recibida'));
  protected readonly obra = computed(() => subtotal(this.items().filter((i) => i.tipo === 'servicio')));
  protected readonly enRepuestos = computed(() => subtotal(this.items().filter((i) => i.tipo !== 'servicio')));
  protected readonly total = computed(() => Math.max(0, this.obra() + this.enRepuestos() - this.descuento()));
  protected readonly conteo = computed(() => plural(this.items().length, 'ítem', 'ítems'));
  protected readonly biciTexto = computed(() => {
    const b = this.datos.valor()?.bici;
    return [b?.marca, b?.modelo].filter(Boolean).join(' ');
  });
  protected readonly descuentoAlto = computed(() => this.descuento() > this.obra() + this.enRepuestos());

  protected readonly serviciosVistos = computed<Servicio[]>(() => {
    const q = normalizar(this.busqueda());
    const l = this.datos.valor()?.servicios ?? [];
    return l.filter((s) => !q || normalizar(s.nombre + ' ' + s.categoria).includes(q)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  protected readonly repuestosVistos = computed<Repuesto[]>(() => {
    const q = normalizar(this.busqueda());
    const l = this.datos.valor()?.repuestos ?? [];
    return l.filter((r) => !q || normalizar(r.nombre + ' ' + r.ref + ' ' + r.marca).includes(q)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  constructor() {
    this.ui.titulo.set('Cotización ' + this.numero);
  }

  /**
   * Cuántas unidades de un repuesto se pueden poner todavía: lo que hay en el inventario,
   * más lo que esta orden ya tenía apartado, menos lo que lleva la cotización.
   */
  disponible(refId: string): number {
    const d = this.datos.valor();
    const enInventario = d?.repuestos.find((r) => r.id === refId)?.cantidad ?? 0;
    const apartado = (d?.orden.items ?? []).filter((i) => i.refId === refId).reduce((s, i) => s + i.cantidad, 0);
    const enCotizacion = this.items().filter((i) => i.refId === refId).reduce((s, i) => s + i.cantidad, 0);
    return enInventario + apartado - enCotizacion;
  }

  metaRepuesto(r: Repuesto): string {
    const n = this.disponible(r.id);
    if (n <= 0) return r.ref + ' · agotado';
    return r.ref + ' · quedan ' + n + (n <= r.minimo ? ' (bajo el mínimo)' : '');
  }

  metaItem(i: Item): string {
    const tipo = i.tipo === 'servicio' ? 'Mano de obra' : 'Repuesto';
    return tipo + ' · ' + plata(i.precio) + ' c/u';
  }

  abrirHoja(h: 'servicios' | 'repuestos'): void {
    this.busqueda.set('');
    this.hoja.set(h);
  }

  agregarServicio(s: Servicio): void {
    const ya = this.items().find((i) => i.tipo === 'servicio' && i.refId === s.id);
    if (ya) this.cambiar(ya.id, 1);
    else this.items.update((l) => [...l, { id: nuevoId(), tipo: 'servicio', refId: s.id, nombre: s.nombre, precio: s.precio, cantidad: 1 }]);
    this.hoja.set(null);
    this.ui.avisar(s.nombre + ' agregado');
  }

  agregarRepuesto(r: Repuesto): void {
    if (this.disponible(r.id) < 1) {
      this.ui.avisar('No queda ' + r.nombre + ' en el inventario');
      return;
    }
    const ya = this.items().find((i) => i.tipo === 'repuesto' && i.refId === r.id);
    if (ya) this.cambiar(ya.id, 1);
    else
      this.items.update((l) => [
        ...l,
        { id: nuevoId(), tipo: 'repuesto', refId: r.id, nombre: r.nombre, precio: r.precio, costo: r.costo, cantidad: 1 },
      ]);
    this.hoja.set(null);
    this.ui.avisar(r.nombre + ' agregado');
  }

  cambiar(id: string, d: number): void {
    const item = this.items().find((i) => i.id === id);
    if (!item) return;
    if (d > 0 && item.tipo === 'repuesto' && item.refId && this.disponible(item.refId) < 1) {
      this.ui.avisar('No quedan más unidades de ' + item.nombre);
      return;
    }
    this.items.update((l) => l.map((i) => (i.id === id ? { ...i, cantidad: i.cantidad + d } : i)).filter((i) => i.cantidad > 0));
  }

  private async guardar(que: string, extra = {}): Promise<boolean> {
    if (this.guardando()) return false;
    if (this.descuentoAlto()) {
      this.ui.avisar('El descuento es mayor que el trabajo');
      return false;
    }
    this.guardando.set(true);
    try {
      await this.ordenes.guardarItems(this.numero, this.items(), this.descuento(), que, extra);
      return true;
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo guardar la cotización. Intenta otra vez.');
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  /** Mensaje de WhatsApp con el diagnóstico, cada ítem y el total. */
  private mensaje(): string {
    const d = this.datos.valor();
    const lineas = this.items().map((i) => '• ' + i.nombre + (i.cantidad > 1 ? ' × ' + i.cantidad : '') + ' — ' + plata(i.precio * i.cantidad));
    const partes = [
      'Hola ' + (d?.cliente?.nombre ?? '') + ', revisamos su ' + this.biciTexto() + ' (orden ' + this.numero + ').',
      d?.orden.diagnostico ? 'Encontramos: ' + d.orden.diagnostico : '',
      '',
      ...lineas,
      this.descuento() > 0 ? 'Descuento: -' + plata(this.descuento()) : '',
      'Total: ' + plata(this.total()),
      '',
      this.seCotiza() ? '¿Lo autoriza? Puede aprobar todo o decirnos qué ítems sí.' : 'Así va el trabajo hasta ahora.',
      '— ' + (d?.taller?.nombre ?? ''),
    ];
    return partes.filter((p, i) => p !== '' || partes[i - 1] !== '').join('\n');
  }

  async enviar(): Promise<void> {
    if (!this.items().length) {
      this.ui.avisar('Agrega al menos un servicio o repuesto');
      return;
    }
    if (this.descuentoAlto() || this.guardando()) {
      if (this.descuentoAlto()) this.ui.avisar('El descuento es mayor que el trabajo');
      return;
    }
    // WhatsApp se abre en el mismo toque (antes de guardar): si no, Safari lo bloquea.
    abrirWhatsApp(this.datos.valor()?.cliente?.celular, this.mensaje());
    const ok = await this.guardar('Envió la cotización por WhatsApp (' + plata(this.total()) + ')', {
      estado: 'cotizacion' as EstadoOrden,
      cotizacionEnviada: Date.now(),
    });
    if (ok) this.router.navigate(['/aprobacion', this.numero], { replaceUrl: true });
  }

  async soloGuardar(): Promise<void> {
    const que = this.seCotiza()
      ? 'Guardó la cotización (' + plata(this.total()) + ')'
      : 'Actualizó el trabajo (' + plata(this.total()) + ')';
    if (await this.guardar(que)) {
      this.ui.avisar('Guardado en ' + this.numero);
      this.router.navigate(['/orden', this.numero], { queryParams: { tab: 'trabajo' }, replaceUrl: true });
    }
  }

  async avisarCliente(): Promise<void> {
    if (this.descuentoAlto() || this.guardando()) {
      if (this.descuentoAlto()) this.ui.avisar('El descuento es mayor que el trabajo');
      return;
    }
    abrirWhatsApp(this.datos.valor()?.cliente?.celular, this.mensaje());
    if (await this.guardar('Actualizó el trabajo y le avisó al cliente (' + plata(this.total()) + ')')) {
      this.router.navigate(['/orden', this.numero], { queryParams: { tab: 'trabajo' }, replaceUrl: true });
    }
  }
}
