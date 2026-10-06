import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { db, nuevoId, vivo } from '../../core/db';
import { fechaCompleta, normalizar, plata } from '../../core/formato';
import { MEDIOS_PAGO, type Item, type MedioPago, type Repuesto } from '../../core/models';
import { OrdenesService, subtotal } from '../../core/ordenes.service';
import { UiService } from '../../core/ui.service';
import { abrirWhatsApp } from '../../core/whatsapp';
import { CampoPlataComponent } from '../../shared/campo-plata.component';
import { HojaComponent } from '../../shared/hoja.component';
import { OpcionHojaComponent } from '../../shared/opcion-hoja.component';
import { CargandoComponent, VacioComponent } from '../../shared/vacio.component';

const DIAS_GARANTIA = [0, 15, 30, 60, 90];

@Component({
  selector: 'qt-cobrar',
  imports: [RouterLink, CampoPlataComponent, HojaComponent, OpcionHojaComponent, CargandoComponent, VacioComponent],
  templateUrl: './cobrar.page.html',
  styleUrl: './cobrar.page.css',
})
export class CobrarPage {
  private readonly router = inject(Router);
  private readonly ordenes = inject(OrdenesService);
  private readonly ui = inject(UiService);
  protected readonly numero = inject(ActivatedRoute).snapshot.paramMap.get('numero') ?? '';

  protected readonly plata = plata;
  protected readonly medios = MEDIOS_PAGO;
  protected readonly diasGarantia = DIAS_GARANTIA;

  /** Repuestos que se usaron y no estaban en la orden ("se me olvidó agregar"). */
  protected readonly extra = signal<Item[]>([]);
  protected readonly medio = signal<MedioPago>('Efectivo');
  protected readonly garantia = signal(30);
  protected readonly pagaAhora = signal(0);
  /** Mientras no toquen el campo, "paga ahora" sigue al saldo. */
  private pagoTocado = false;
  protected readonly hoja = signal(false);
  protected readonly busqueda = signal('');
  protected readonly cobrando = signal(false);

  protected readonly datos = vivo(async () => {
    const orden = await db.ordenes.get(this.numero);
    if (!orden) return null;
    const [cliente, bici, taller, repuestos] = await Promise.all([
      db.clientes.get(orden.clienteId),
      db.bicis.get(orden.biciId),
      db.taller.get('taller'),
      db.repuestos.toArray(),
    ]);
    return { orden, cliente, bici, taller, repuestos };
  }, null);

  protected readonly items = computed(() => [...(this.datos.valor()?.orden.items ?? []), ...this.extra()]);
  protected readonly esGarantia = computed(() => !!this.datos.valor()?.orden.garantiaDe);
  protected readonly descuento = computed(() => this.datos.valor()?.orden.descuento ?? 0);
  protected readonly adelanto = computed(() => this.datos.valor()?.orden.adelanto ?? 0);
  protected readonly total = computed(() => Math.max(0, subtotal(this.items()) - this.descuento()));
  protected readonly saldo = computed(() => (this.esGarantia() ? 0 : Math.max(0, this.total() - this.adelanto())));
  protected readonly paga = computed(() => Math.min(this.pagaAhora(), this.saldo()));
  protected readonly queda = computed(() => this.saldo() - this.paga());
  /** Una orden sin ningún repuesto puede ser plata que se pierde. */
  protected readonly sinRepuestos = computed(() => !this.items().some((i) => i.tipo === 'repuesto'));
  protected readonly hasta = computed(() => {
    const d = new Date();
    d.setDate(d.getDate() + this.garantia());
    return fechaCompleta(d.getTime());
  });
  protected readonly etiqueta = computed(() => {
    if (this.saldo() === 0) return this.esGarantia() ? 'Entregar (garantía, sin cobro)' : 'Entregar (ya está pago)';
    return 'Cobrar ' + plata(this.paga()) + ' y entregar';
  });

  protected readonly repuestosVistos = computed<Repuesto[]>(() => {
    const q = normalizar(this.busqueda());
    return (this.datos.valor()?.repuestos ?? [])
      .filter((r) => !q || normalizar(r.nombre + ' ' + r.ref + ' ' + r.marca).includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  constructor() {
    this.ui.titulo.set('Entregar ' + this.numero);
    effect(() => {
      const s = this.saldo();
      if (!this.pagoTocado) this.pagaAhora.set(s);
    });
    // La garantía por defecto sale de la configuración del taller.
    effect(() => {
      const dias = this.datos.valor()?.taller?.garantiaDias;
      if (dias !== undefined) untracked(() => this.garantia.set(this.esGarantia() ? 0 : dias));
    });
  }

  escribirPago(n: number): void {
    this.pagoTocado = true;
    this.pagaAhora.set(n);
  }

  /** Unidades que quedan de un repuesto, descontando las que ya se agregaron aquí. */
  disponible(r: Repuesto): number {
    return r.cantidad - this.extra().filter((i) => i.refId === r.id).reduce((s, i) => s + i.cantidad, 0);
  }

  agregar(r: Repuesto): void {
    if (this.disponible(r) < 1) {
      this.ui.avisar('No queda ' + r.nombre + ' en el inventario');
      return;
    }
    const ya = this.extra().find((i) => i.refId === r.id);
    if (ya) this.extra.update((l) => l.map((i) => (i === ya ? { ...i, cantidad: i.cantidad + 1 } : i)));
    else this.extra.update((l) => [...l, { id: nuevoId(), tipo: 'repuesto', refId: r.id, nombre: r.nombre, precio: r.precio, costo: r.costo, cantidad: 1 }]);
    this.hoja.set(false);
    this.ui.avisar(r.nombre + ' agregado · el inventario baja al entregar');
  }

  quitarExtra(id: string): void {
    this.extra.update((l) => l.filter((i) => i.id !== id));
  }

  private recibo(): string {
    const d = this.datos.valor();
    const lineas = this.items().map((i) => '• ' + i.nombre + (i.cantidad > 1 ? ' × ' + i.cantidad : '') + ' — ' + plata(i.precio * i.cantidad));
    const bici = [d?.bici?.marca, d?.bici?.modelo].filter(Boolean).join(' ');
    const partes = [
      'Hola ' + (d?.cliente?.nombre ?? '') + ', gracias por confiarnos su ' + bici + '.',
      'Recibo de la orden ' + this.numero + ':',
      ...lineas,
      this.descuento() > 0 ? 'Descuento: -' + plata(this.descuento()) : '',
      'Total: ' + plata(this.esGarantia() ? 0 : this.total()),
      this.adelanto() > 0 ? 'Adelanto: ' + plata(this.adelanto()) : '',
      this.paga() > 0 ? 'Pagado hoy: ' + plata(this.paga()) + ' en ' + this.medio() : '',
      this.queda() > 0 ? 'Queda pendiente: ' + plata(this.queda()) : '',
      this.garantia() > 0 ? 'Garantía de ' + this.garantia() + ' días en mano de obra, hasta el ' + this.hasta() + '.' : '',
      '— ' + (d?.taller?.nombre ?? ''),
    ];
    return partes.filter(Boolean).join('\n');
  }

  async cobrar(): Promise<void> {
    if (this.cobrando()) return;
    const d = this.datos.valor();
    if (!d) return;
    let texto = this.saldo() === 0
      ? 'La orden ' + this.numero + ' queda entregada.'
      : 'Se cobran ' + plata(this.paga()) + ' en ' + this.medio() + ' y la orden ' + this.numero + ' queda entregada.';
    if (this.queda() > 0) texto += ' Quedan ' + plata(this.queda()) + ' en la cartera de ' + (d.cliente?.nombre ?? 'el cliente') + '.';
    texto += ' Esto no se puede deshacer.';
    const ok = await this.ui.confirmar({
      titulo: this.saldo() === 0 ? 'Confirmar entrega' : 'Confirmar cobro',
      texto,
      si: this.saldo() === 0 ? 'Sí, entregar' : 'Sí, cobrar y entregar',
      tono: 'verde',
    });
    if (!ok) return;
    // El recibo se abre ya, en el mismo toque de "Sí": si se espera a guardar, Safari lo bloquea.
    abrirWhatsApp(d.cliente?.celular, this.recibo());
    this.cobrando.set(true);
    try {
      await this.ordenes.entregar(this.numero, {
        items: this.items(),
        medio: this.medio(),
        pagaAhora: this.paga(),
        garantiaDias: this.garantia(),
      });
      this.ui.avisar('Orden ' + this.numero + ' entregada' + (this.paga() > 0 ? ' y cobrada' : ''));
      this.router.navigate(['/orden', this.numero], { replaceUrl: true });
    } catch (e) {
      console.error(e);
      this.cobrando.set(false);
      this.ui.avisar('No se pudo guardar la entrega. Revisa la orden antes de volver a cobrar.');
    }
  }
}
