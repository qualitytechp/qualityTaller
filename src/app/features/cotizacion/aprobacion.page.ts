import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { db, vivo } from '../../core/db';
import { plata, plural } from '../../core/formato';
import type { Item } from '../../core/models';
import { OrdenesService, subtotal } from '../../core/ordenes.service';
import { UiService } from '../../core/ui.service';
import { FotoComponent } from '../../shared/foto.component';
import { CargandoComponent, VacioComponent } from '../../shared/vacio.component';

/** Lo que ve el cliente en el celular del taller para aprobar ítem por ítem. */
@Component({
  selector: 'qt-aprobacion',
  imports: [RouterLink, FotoComponent, CargandoComponent, VacioComponent],
  templateUrl: './aprobacion.page.html',
  styleUrl: './aprobacion.page.css',
})
export class AprobacionPage {
  private readonly router = inject(Router);
  private readonly ordenes = inject(OrdenesService);
  private readonly ui = inject(UiService);
  protected readonly numero = inject(ActivatedRoute).snapshot.paramMap.get('numero') ?? '';

  protected readonly plata = plata;
  /** Ítems que el cliente desmarcó. Todo arranca aprobado. */
  protected readonly desmarcados = signal<Set<string>>(new Set());
  protected readonly guardando = signal(false);

  protected readonly datos = vivo(async () => {
    const orden = await db.ordenes.get(this.numero);
    if (!orden) return null;
    const [cliente, bici, taller] = await Promise.all([db.clientes.get(orden.clienteId), db.bicis.get(orden.biciId), db.taller.get('taller')]);
    return { orden, cliente, bici, taller };
  }, null);

  protected readonly items = computed(() => this.datos.valor()?.orden.items ?? []);
  protected readonly marcados = computed(() => this.items().filter((i) => !this.desmarcados().has(i.id)));
  protected readonly descuento = computed(() => this.datos.valor()?.orden.descuento ?? 0);
  protected readonly total = computed(() => Math.max(0, subtotal(this.marcados()) - this.descuento()));
  protected readonly todos = computed(() => this.marcados().length === this.items().length);
  protected readonly conteo = computed(() => this.marcados().length + ' de ' + plural(this.items().length, 'ítem', 'ítems'));
  protected readonly nombreCorto = computed(() => (this.datos.valor()?.cliente?.nombre ?? '').split(' ')[0]);
  protected readonly biciTexto = computed(() => {
    const b = this.datos.valor()?.bici;
    return [b?.marca, b?.modelo].filter(Boolean).join(' ');
  });
  protected readonly fotos = computed(() => (this.datos.valor()?.orden.fotos ?? []).slice(-4));
  protected readonly etiquetaAprobar = computed(() => {
    if (!this.marcados().length) return 'Marque al menos un ítem';
    return (this.todos() ? 'Apruebo todo · ' : 'Apruebo lo marcado · ') + plata(this.total());
  });

  constructor() {
    this.ui.titulo.set('Vista del cliente');
  }

  alternar(i: Item): void {
    this.desmarcados.update((s) => {
      const n = new Set(s);
      if (n.has(i.id)) n.delete(i.id);
      else n.add(i.id);
      return n;
    });
  }

  metaItem(i: Item): string {
    return (i.tipo === 'servicio' ? 'Mano de obra' : 'Repuesto') + ' · ' + i.cantidad + ' × ' + plata(i.precio);
  }

  async aprobar(): Promise<void> {
    if (!this.marcados().length) {
      this.ui.avisar('Marque al menos un ítem, o toque "No autorizo el trabajo"');
      return;
    }
    if (this.guardando()) return;
    this.guardando.set(true);
    const total = this.total();
    const parcial = !this.todos();
    try {
      // Lo que no se aprobó sale de la orden y sus repuestos vuelven al inventario.
      await this.ordenes.guardarItems(
        this.numero,
        this.marcados(),
        Math.min(this.descuento(), subtotal(this.marcados())),
        (parcial ? 'Aprobó una parte de la cotización (' + this.conteo() + ', ' : 'Aprobó toda la cotización (') + plata(total) + ')',
        { estado: 'aprobada', aprobacion: { en: Date.now(), quien: 'Cliente (en el taller)', total } },
        'Cliente',
      );
      this.ui.avisar('Aprobado por ' + plata(total));
      this.router.navigate(['/orden', this.numero], { queryParams: { tab: 'trabajo' }, replaceUrl: true });
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo guardar la aprobación. Intenta otra vez.');
      this.guardando.set(false);
    }
  }

  async rechazar(): Promise<void> {
    const ok = await this.ui.confirmar({
      titulo: '¿Rechazar el trabajo?',
      texto: 'La orden ' + this.numero + ' queda rechazada y se le devuelve la bici al cliente sin cobro.',
      si: 'Sí, rechazar',
    });
    if (!ok) return;
    try {
      await this.ordenes.cambiarEstado(this.numero, 'rechazada', 'No autorizó el trabajo', {}, 'Cliente');
      this.router.navigate(['/orden', this.numero], { queryParams: { tab: 'historial' }, replaceUrl: true });
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo guardar. Intenta otra vez.');
    }
  }
}
