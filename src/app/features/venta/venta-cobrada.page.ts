import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { db, vivo } from '../../core/db';
import { plata, plural } from '../../core/formato';
import { abrirWhatsApp } from '../../core/whatsapp';
import { CargandoComponent, VacioComponent } from '../../shared/vacio.component';

@Component({
  selector: 'qt-venta-cobrada',
  imports: [CargandoComponent, VacioComponent],
  template: `
    @if (datos.cargando()) {
      <qt-cargando />
    } @else if (datos.valor(); as d) {
      <div class="page centro">
        <div class="ok">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 13l4 4L19 7"></path></svg>
        </div>
        <div class="muted grande">Venta cobrada en {{ d.venta.medio }}</div>
        <div class="display total">{{ plata(d.venta.total) }}</div>
        <div class="muted">{{ d.venta.numero }} · {{ conteo() }}</div>
        <div class="card detalle">
          @for (i of d.venta.items; track i.id) {
            <div class="fila">
              <span class="grow">
                {{ i.nombre }}
                @if (i.cantidad > 1) {
                  <span class="gris">× {{ i.cantidad }}</span>
                }
              </span>
              <span class="t-strong">{{ plata(i.precio * i.cantidad) }}</span>
            </div>
          }
          <div class="raya"></div>
          <div class="nota">El inventario ya bajó. Sin orden de trabajo.</div>
        </div>
      </div>
      <div class="action-bar">
        <button type="button" class="btn btn-success btn-lg" (click)="recibo()">Mandar el recibo por WhatsApp</button>
        <div class="row">
          <button type="button" class="btn btn-outline" (click)="otra()">Otra venta</button>
          <button type="button" class="btn btn-outline" (click)="listo()">Listo</button>
        </div>
      </div>
    } @else {
      <qt-vacio titulo="No se encontró la venta" />
    }
  `,
  styles: `
    .centro {
      text-align: center;
      padding-top: 24px;
    }
    .ok {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--success-100);
      color: var(--success-700);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .grande {
      font-size: 15px;
    }
    .total {
      font-size: 58px;
      margin: 6px 0 2px;
    }
    .detalle {
      margin-top: 20px;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .fila {
      display: flex;
      gap: 10px;
      font-size: 14.5px;
      line-height: 1.35;
    }
    .fila .t-strong {
      white-space: nowrap;
    }
    .gris {
      color: var(--gray-400);
    }
    .raya {
      height: 1px;
      background: var(--border-default);
      margin: 2px 0;
    }
    .nota {
      font-size: 13px;
      color: var(--gray-500);
    }
    .row .btn {
      flex: 1;
    }
  `,
})
export class VentaCobradaPage {
  private readonly router = inject(Router);
  private readonly numero = inject(ActivatedRoute).snapshot.paramMap.get('numero') ?? '';
  protected readonly plata = plata;

  protected readonly datos = vivo(async () => {
    const venta = await db.ventas.get(this.numero);
    if (!venta) return null;
    return { venta, taller: await db.taller.get('taller') };
  }, null);

  protected readonly conteo = computed(() => {
    const n = (this.datos.valor()?.venta.items ?? []).reduce((s, i) => s + i.cantidad, 0);
    return plural(n, 'artículo', 'artículos');
  });

  recibo(): void {
    const d = this.datos.valor();
    if (!d) return;
    const lineas = d.venta.items.map((i) => '• ' + i.nombre + (i.cantidad > 1 ? ' × ' + i.cantidad : '') + ' — ' + plata(i.precio * i.cantidad));
    // Sin celular: WhatsApp deja escoger a quién mandarlo.
    abrirWhatsApp('', ['Recibo ' + (d.taller?.nombre ?? '') + ' · ' + d.venta.numero, ...lineas, 'Total: ' + plata(d.venta.total) + ' (' + d.venta.medio + '). ¡Gracias!'].join('\n'));
  }

  otra(): void {
    this.router.navigate(['/venta'], { replaceUrl: true });
  }

  listo(): void {
    this.router.navigate(['/inicio'], { replaceUrl: true });
  }
}
