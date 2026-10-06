import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { db, vivo } from '../../core/db';
import { fechaCompleta, plural } from '../../core/formato';
import type { Bici, Cliente, Orden } from '../../core/models';
import { OrdenesService } from '../../core/ordenes.service';
import { UiService } from '../../core/ui.service';
import { HojaComponent } from '../../shared/hoja.component';
import { CargandoComponent } from '../../shared/vacio.component';

interface Ficha {
  orden: Orden;
  cliente: string;
  bici: string;
}

@Component({
  selector: 'qt-garantias',
  imports: [FormsModule, RouterLink, HojaComponent, CargandoComponent],
  templateUrl: './garantias.page.html',
  styleUrl: './garantias.page.css',
})
export class GarantiasPage {
  private readonly ordenes = inject(OrdenesService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  protected readonly fecha = fechaCompleta;

  protected readonly abriendo = signal<Orden | null>(null);
  protected readonly motivo = signal('');

  protected readonly datos = vivo(
    async () => {
      const [ordenes, clientes, bicis] = await Promise.all([db.ordenes.toArray(), db.clientes.toArray(), db.bicis.toArray()]);
      return {
        ordenes,
        clientes: new Map(clientes.map((c) => [c.id, c] as [string, Cliente])),
        bicis: new Map(bicis.map((b) => [b.id, b] as [string, Bici])),
      };
    },
    { ordenes: [] as Orden[], clientes: new Map<string, Cliente>(), bicis: new Map<string, Bici>() },
  );

  private ficha(o: Orden): Ficha {
    const b = this.datos.valor().bicis.get(o.biciId);
    return { orden: o, cliente: this.datos.valor().clientes.get(o.clienteId)?.nombre ?? '', bici: [b?.marca, b?.modelo].filter(Boolean).join(' ') };
  }

  private readonly inicioMes = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  })();

  protected readonly retrabajosMes = computed(() => this.datos.valor().ordenes.filter((o) => o.garantiaDe && o.recibida >= this.inicioMes).length);
  protected readonly tasa = computed(() => {
    const entregas = this.datos.valor().ordenes.filter((o) => o.estado === 'entregada' && !o.garantiaDe && (o.entregada ?? 0) >= this.inicioMes).length;
    if (!entregas) return 'Sin entregas este mes todavía';
    return 'de ' + plural(entregas, 'entrega', 'entregas') + ' del mes · ' + Math.round((this.retrabajosMes() / entregas) * 100) + '% vuelve';
  });

  /** Órdenes de garantía (retrabajos), las más recientes primero. */
  protected readonly retrabajos = computed(() =>
    this.datos
      .valor()
      .ordenes.filter((o) => o.garantiaDe)
      .sort((a, b) => b.recibida - a.recibida)
      .slice(0, 20)
      .map((o) => this.ficha(o)),
  );

  protected readonly vigentes = computed(() => {
    const ahora = Date.now();
    return this.datos
      .valor()
      .ordenes.filter((o) => o.estado === 'entregada' && !o.garantiaDe && (o.garantiaHasta ?? 0) > ahora)
      .sort((a, b) => (a.garantiaHasta ?? 0) - (b.garantiaHasta ?? 0))
      .map((o) => this.ficha(o));
  });

  protected readonly vencidas = computed(() => {
    const ahora = Date.now();
    return this.datos
      .valor()
      .ordenes.filter((o) => o.estado === 'entregada' && !o.garantiaDe && o.garantiaHasta && o.garantiaHasta <= ahora && o.garantiaHasta > ahora - 30 * 864e5)
      .map((o) => this.ficha(o));
  });

  abrir(o: Orden): void {
    this.motivo.set('');
    this.abriendo.set(o);
  }

  async confirmar(): Promise<void> {
    const o = this.abriendo();
    if (!o || !this.motivo().trim()) {
      this.ui.avisar('Escribe qué pasó con la bici');
      return;
    }
    this.abriendo.set(null);
    try {
      const nueva = await this.ordenes.abrirGarantia(o, this.motivo());
      this.ui.avisar('Orden de garantía ' + nueva + ' abierta');
      this.router.navigate(['/orden', nueva]);
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo abrir la garantía. Intenta otra vez.');
    }
  }
}
