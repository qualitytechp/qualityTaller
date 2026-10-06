import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CajaService, saldos } from '../../core/caja.service';
import { db, vivo } from '../../core/db';
import { inicioDelDia, plata } from '../../core/formato';
import type { Movimiento } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { CampoPlataComponent } from '../../shared/campo-plata.component';
import { CargandoComponent } from '../../shared/vacio.component';

/** Contar el cajón y ver si cuadra con lo que la app dice que debería haber. */
@Component({
  selector: 'qt-cierre',
  imports: [CampoPlataComponent, CargandoComponent],
  template: `
    @if (movs.cargando()) {
      <qt-cargando />
    } @else {
      <div class="page stack-12">
        <div class="card">
          <div class="eyebrow">Debería haber en efectivo</div>
          <div class="display esperado">{{ plata(esperado()) }}</div>
        </div>
        <div class="card">
          <label class="label" for="contado">Cuenta lo que hay y escríbelo</label>
          <qt-campo-plata campoId="contado" [grande]="true" [valor]="contado() ?? 0" (valorChange)="contado.set($event)" />
        </div>
        <div class="resultado" [class]="clase()">
          <div class="eyebrow">{{ etiqueta() }}</div>
          <div class="display dif">{{ contado() === null ? '—' : plata(abs()) }}</div>
          <div class="texto">{{ texto() }}</div>
        </div>
      </div>
      <div class="action-bar">
        <button type="button" class="btn btn-primary btn-lg" [class.is-off]="contado() === null || guardando()" (click)="cerrar()">Cerrar el día</button>
      </div>
    }
  `,
  styles: `
    .esperado {
      font-size: 40px;
      margin-top: 6px;
    }
    .resultado {
      border-radius: 16px;
      padding: 18px;
      border: 1px solid var(--border-default);
      background: var(--gray-100);
      color: var(--gray-600);
    }
    .resultado .eyebrow {
      color: inherit;
    }
    .resultado.cuadra {
      background: var(--success-50);
      border-color: var(--success-600);
      color: var(--success-700);
    }
    .resultado.descuadre {
      background: var(--red-50);
      border-color: var(--red-200);
      color: var(--red-700);
    }
    .dif {
      font-size: 36px;
      margin-top: 6px;
    }
    .texto {
      font-size: 14px;
      margin-top: 8px;
      line-height: 1.4;
    }
  `,
})
export class CierrePage {
  private readonly caja = inject(CajaService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  protected readonly plata = plata;

  protected readonly movs = vivo(() => db.movimientos.toArray(), [] as Movimiento[]);
  protected readonly contado = signal<number | null>(null);
  protected readonly guardando = signal(false);

  protected readonly esperado = computed(() => saldos(this.movs.valor()).Efectivo);
  private readonly efectivoHoy = computed(() => {
    const desde = inicioDelDia();
    const hoy = this.movs.valor().filter((m) => m.en >= desde && m.fuente === 'Efectivo' && m.origen?.tipo !== 'saldo');
    return {
      entro: hoy.filter((m) => m.tipo === 'entra').reduce((s, m) => s + m.monto, 0),
      salio: hoy.filter((m) => m.tipo === 'sale').reduce((s, m) => s + m.monto, 0),
    };
  });
  protected readonly dif = computed(() => (this.contado() ?? 0) - this.esperado());
  protected readonly abs = computed(() => Math.abs(this.dif()));
  protected readonly clase = computed(() => (this.contado() === null ? 'resultado' : this.dif() === 0 ? 'resultado cuadra' : 'resultado descuadre'));
  protected readonly etiqueta = computed(() => {
    if (this.contado() === null) return 'Diferencia';
    return this.dif() === 0 ? 'Cuadra exacto' : this.dif() < 0 ? 'Falta plata' : 'Sobra plata';
  });
  protected readonly texto = computed(() => {
    if (this.contado() === null) return 'Escribe lo que contaste para ver si cuadra.';
    if (this.dif() === 0) return 'La caja cuadra con lo que debería haber. Cierra tranquilo.';
    const e = this.efectivoHoy();
    if (this.dif() < 0) return 'Revisa hoy mismo: entró ' + plata(e.entro) + ' y salió ' + plata(e.salio) + ' en efectivo.';
    return 'Puede ser un cobro sin registrar. Revísalo antes de cerrar.';
  });

  async cerrar(): Promise<void> {
    const contado = this.contado();
    if (contado === null) {
      this.ui.avisar('Escribe cuánto contaste');
      return;
    }
    const cuadra = this.dif() === 0;
    const ok = await this.ui.confirmar({
      titulo: 'Cerrar el día',
      texto: cuadra
        ? 'La caja cuadra. Queda cerrada con ' + plata(contado) + '.'
        : 'Queda registrada una diferencia de ' + plata(this.abs()) + ' y el cajón queda en ' + plata(contado) + '. Esto no se puede deshacer.',
      si: 'Sí, cerrar el día',
    });
    if (!ok) return;
    this.guardando.set(true);
    try {
      await this.caja.cerrar(this.esperado(), contado);
      this.ui.avisar(cuadra ? 'Caja cerrada · cuadró exacto' : 'Caja cerrada con diferencia de ' + plata(this.abs()));
      this.router.navigate(['/caja'], { replaceUrl: true });
    } catch (e) {
      console.error(e);
      this.guardando.set(false);
      this.ui.avisar('No se pudo cerrar la caja. Intenta otra vez.');
    }
  }
}
