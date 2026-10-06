import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { db, vivo } from '../../core/db';
import { cuando, plata, plural } from '../../core/formato';
import { ROL_LABEL } from '../../core/sesion.service';
import { abrirWhatsApp, llenarPlantilla } from '../../core/whatsapp';
import { CargandoComponent, VacioComponent } from '../../shared/vacio.component';

@Component({
  selector: 'qt-orden-creada',
  imports: [CargandoComponent, VacioComponent],
  template: `
    @if (datos.cargando()) {
      <qt-cargando />
    } @else if (datos.valor(); as d) {
      <div class="page centro">
        <div class="ok">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 13l4 4L19 7"></path></svg>
        </div>
        <div class="muted grande">Orden creada</div>
        <div class="display numero">{{ d.orden.numero }}</div>
        <div class="cliente">{{ d.cliente?.nombre }}</div>
        <div class="muted">{{ d.bici?.marca }} {{ d.bici?.modelo }} · {{ d.bici?.tipo }}</div>

        <div class="card resumen">
          <div class="fila"><span class="muted">Prometida</span><span class="t-strong">{{ prometida() }}</span></div>
          <div class="fila"><span class="muted">Prioridad</span><span class="t-strong">{{ d.orden.prioridad }}</span></div>
          <div class="fila"><span class="muted">Mecánico</span><span class="t-strong">{{ mecanico() }}</span></div>
          <div class="fila"><span class="muted">Fotos</span><span class="t-strong">{{ fotos() }}</span></div>
          <div class="fila"><span class="muted">Adelanto</span><span class="adelanto">{{ adelanto() }}</span></div>
        </div>
      </div>

      <div class="action-bar">
        <button type="button" class="btn btn-success btn-lg" (click)="enviarRecibo()">Enviar el recibo por WhatsApp</button>
        <div class="row">
          <button type="button" class="btn btn-outline" (click)="verOrden()">Ver la orden</button>
          <button type="button" class="btn btn-outline" (click)="recibirOtra()">Recibir otra</button>
        </div>
      </div>
    } @else {
      <qt-vacio titulo="No se encontró la orden" texto="Búscala en Órdenes." />
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
    .numero {
      font-size: 64px;
      margin: 6px 0 4px;
    }
    .cliente {
      font-size: 16px;
      font-weight: 600;
    }
    .resumen {
      margin-top: 20px;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .fila {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 14.5px;
    }
    .fila span:last-child {
      text-align: right;
    }
    .adelanto {
      font-weight: 700;
      color: var(--success-700);
    }
    .row .btn {
      flex: 1;
    }
  `,
})
export class OrdenCreadaPage {
  // Se lee de la ruta y no con input(): la consulta arranca antes de que Angular asigne los inputs.
  private readonly num = inject(ActivatedRoute).snapshot.paramMap.get('numero') ?? '';
  private readonly numero = () => this.num;
  private readonly router = inject(Router);

  protected readonly datos = vivo(async () => {
    const orden = await db.ordenes.get(this.numero());
    if (!orden) return null;
    const [cliente, bici, mecanico, taller] = await Promise.all([
      db.clientes.get(orden.clienteId),
      db.bicis.get(orden.biciId),
      orden.mecanicoId ? db.personas.get(orden.mecanicoId) : undefined,
      db.taller.get('taller'),
    ]);
    return { orden, cliente, bici, mecanico, taller };
  }, null);

  protected readonly prometida = computed(() => {
    const d = this.datos.valor();
    return d ? cuando(d.orden.prometida) : '';
  });
  protected readonly mecanico = computed(() => {
    const m = this.datos.valor()?.mecanico;
    return m ? m.nombre + (m.rol === 'admin' ? ' (' + ROL_LABEL.admin.toLowerCase() + ')' : '') : 'Sin asignar';
  });
  protected readonly fotos = computed(() => plural(this.datos.valor()?.orden.fotos.length ?? 0, 'foto', 'fotos') + ' de cómo llegó');
  protected readonly adelanto = computed(() => plata(this.datos.valor()?.orden.adelanto ?? 0));

  enviarRecibo(): void {
    const d = this.datos.valor();
    if (!d) return;
    const bici = [d.bici?.marca, d.bici?.modelo].filter(Boolean).join(' ');
    const plantilla = d.taller?.textoRecibo ?? 'Hola {cliente}, recibimos su {bici}. Orden {orden}. Se la tenemos lista el {fecha}.';
    let texto = llenarPlantilla(plantilla, {
      cliente: d.cliente?.nombre ?? '',
      bici,
      orden: d.orden.numero,
      fecha: cuando(d.orden.prometida),
      saldo: plata(0),
      taller: d.taller?.nombre ?? 'el taller',
    });
    texto += '\nReportó: “' + d.orden.reportado + '”.';
    if (d.orden.adelanto > 0) texto += '\nAdelanto recibido: ' + plata(d.orden.adelanto) + '.';
    abrirWhatsApp(d.cliente?.celular, texto);
  }

  verOrden(): void {
    this.router.navigate(['/orden', this.numero()], { replaceUrl: true });
  }

  recibirOtra(): void {
    this.router.navigate(['/recibir'], { replaceUrl: true });
  }
}
