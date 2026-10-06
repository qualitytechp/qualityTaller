import { Component, computed, inject, signal } from '@angular/core';
import { CajaService } from '../../core/caja.service';
import { db, vivo } from '../../core/db';
import { diasEntre, plata, plural } from '../../core/formato';
import { MEDIOS_PAGO, type Cliente, type MedioPago } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { abrirWhatsApp } from '../../core/whatsapp';
import { CampoPlataComponent } from '../../shared/campo-plata.component';
import { HojaComponent } from '../../shared/hoja.component';
import { CargandoComponent, VacioComponent } from '../../shared/vacio.component';

@Component({
  selector: 'qt-cartera',
  imports: [CampoPlataComponent, HojaComponent, CargandoComponent, VacioComponent],
  template: `
    @if (datos.cargando()) {
      <qt-cargando />
    } @else {
      <div class="page">
        <div class="card-dark">
          <div class="eyebrow">Me deben</div>
          <div class="display total">{{ plata(total()) }}</div>
          <div class="resumen">{{ resumen() }}</div>
        </div>
        <div class="stack lista">
          @for (c of deudores(); track c.id) {
            <div class="card deudor">
              <div class="row">
                <div class="grow">
                  <div class="nombre">{{ c.nombre }}</div>
                  <div class="meta">{{ c.celular }} · {{ desde(c) }}</div>
                </div>
                <div class="display debe">{{ plata(c.debe) }}</div>
              </div>
              <div class="row dos">
                <button type="button" class="btn btn-success" (click)="cobrar(c)">Cobrarle por WhatsApp</button>
                <button type="button" class="btn btn-outline" (click)="abrirAbono(c)">Registrar abono</button>
              </div>
            </div>
          } @empty {
            <qt-vacio titulo="Nadie te debe nada" texto="Todo cobrado." />
          }
        </div>
      </div>

      @if (abono(); as a) {
        <qt-hoja [titulo]="'Abono de ' + a.cliente.nombre" (cerrar)="abono.set(null)">
          <div class="muted">Debe {{ plata(a.cliente.debe) }}.</div>
          <label class="label" for="a-monto">¿Cuánto abona?</label>
          <qt-campo-plata campoId="a-monto" [valor]="a.monto" (valorChange)="abono.set({ cliente: a.cliente, monto: $event, medio: a.medio })" />
          <span class="label">Cómo paga</span>
          <div class="pills-wrap">
            @for (m of medios; track m) {
              <button type="button" class="pill" [class.on]="a.medio === m" (click)="abono.set({ cliente: a.cliente, monto: a.monto, medio: m })">{{ m }}</button>
            }
          </div>
          <button type="button" class="btn btn-primary btn-lg" (click)="registrar()">Registrar {{ plata(a.monto) }}</button>
        </qt-hoja>
      }
    }
  `,
  styles: `
    .total {
      font-size: 50px;
      margin-top: 6px;
    }
    .resumen {
      font-size: 13px;
      color: var(--zinc-400);
      margin-top: 8px;
    }
    .lista {
      margin-top: 16px;
    }
    .deudor {
      border-left: 4px solid var(--red-600);
    }
    .nombre {
      font-size: 16.5px;
      font-weight: 600;
    }
    .meta {
      font-size: 13px;
      color: var(--gray-500);
      margin-top: 3px;
    }
    .debe {
      font-size: 24px;
      color: var(--red-600);
      white-space: nowrap;
    }
    .dos {
      gap: 8px;
      margin-top: 14px;
    }
    .dos .btn {
      flex: 1;
      font-size: 14.5px;
    }
  `,
})
export class CarteraPage {
  private readonly caja = inject(CajaService);
  private readonly ui = inject(UiService);
  protected readonly plata = plata;
  protected readonly medios = MEDIOS_PAGO;
  protected readonly abono = signal<{ cliente: Cliente; monto: number; medio: MedioPago } | null>(null);

  protected readonly datos = vivo(
    async () => ({ clientes: await db.clientes.filter((c) => c.debe > 0).toArray(), taller: await db.taller.get('taller') }),
    { clientes: [] as Cliente[], taller: undefined },
  );
  protected readonly deudores = computed(() => [...this.datos.valor().clientes].sort((a, b) => b.debe - a.debe));
  protected readonly total = computed(() => this.deudores().reduce((s, c) => s + c.debe, 0));
  protected readonly resumen = computed(() => {
    const n = this.deudores().length;
    return n ? plural(n, 'cliente pendiente', 'clientes pendientes') : 'Todo cobrado';
  });

  desde(c: Cliente): string {
    if (!c.debeDesde) return 'debe desde antes';
    const d = diasEntre(c.debeDesde);
    return d === 0 ? 'debe desde hoy' : 'debe desde hace ' + plural(d, 'día', 'días');
  }

  cobrar(c: Cliente): void {
    abrirWhatsApp(
      c.celular,
      'Hola ' + c.nombre + ', le escribimos de ' + (this.datos.valor().taller?.nombre ?? 'el taller') + '. Nos quedó un saldo pendiente de ' + plata(c.debe) + '. ¿Nos ayuda con eso?',
    );
  }

  abrirAbono(c: Cliente): void {
    this.abono.set({ cliente: c, monto: c.debe, medio: 'Efectivo' });
  }

  async registrar(): Promise<void> {
    const a = this.abono();
    if (!a || a.monto <= 0) {
      this.ui.avisar('Escribe cuánto abona');
      return;
    }
    const monto = Math.min(a.monto, a.cliente.debe);
    const queda = a.cliente.debe - monto;
    const ok = await this.ui.confirmar({
      titulo: 'Registrar abono',
      texto:
        a.cliente.nombre + ' abona ' + plata(monto) + ' en ' + a.medio + (queda > 0 ? ' y queda debiendo ' + plata(queda) + '.' : ' y queda al día.'),
      si: 'Sí, registrar',
      tono: 'verde',
    });
    if (!ok) return;
    try {
      await this.caja.abonoCliente(a.cliente.id, monto, a.medio);
      this.abono.set(null);
      this.ui.avisar('Abono de ' + a.cliente.nombre + ' registrado');
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo registrar el abono. Intenta otra vez.');
    }
  }
}
