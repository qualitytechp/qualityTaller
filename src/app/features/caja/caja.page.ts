import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FUENTES, CajaService, delDia, saldos } from '../../core/caja.service';
import { db, vivo } from '../../core/db';
import { cuando, hora, inicioDelDia, plata } from '../../core/formato';
import type { CierreCaja, Fuente, Movimiento, Persona } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { CampoPlataComponent } from '../../shared/campo-plata.component';
import { HojaComponent } from '../../shared/hoja.component';
import { CargandoComponent, ErrorComponent, VacioComponent } from '../../shared/vacio.component';

const GASTOS_RAPIDOS = ['Arriendo del local', 'Servicios públicos', 'Herramienta', 'Transporte de repuestos', 'Café y aseo', 'Almuerzo'];

@Component({
  selector: 'qt-caja',
  imports: [FormsModule, RouterLink, CampoPlataComponent, HojaComponent, CargandoComponent, ErrorComponent, VacioComponent],
  templateUrl: './caja.page.html',
  styleUrl: './caja.page.css',
})
export class CajaPage {
  private readonly caja = inject(CajaService);
  private readonly ui = inject(UiService);

  protected readonly plata = plata;
  protected readonly fuentes = FUENTES;
  protected readonly gastosRapidos = GASTOS_RAPIDOS;
  protected readonly hoja = signal<'gasto' | 'inicial' | null>(null);
  protected readonly gasto = signal({ concepto: '', monto: 0, fuente: 'Efectivo' as Fuente });
  protected readonly iniciales = signal<Record<Fuente, number>>({ Efectivo: 0, Banco: 0, Digital: 0 });

  protected readonly datos = vivo(
    async () => {
      const [movimientos, personas, cierres] = await Promise.all([
        db.movimientos.toArray(),
        db.personas.toArray(),
        db.cierres.orderBy('en').reverse().limit(1).toArray(),
      ]);
      return { movimientos, personas, ultimoCierre: cierres[0] as CierreCaja | undefined };
    },
    { movimientos: [] as Movimiento[], personas: [] as Persona[], ultimoCierre: undefined as CierreCaja | undefined },
  );

  protected readonly saldos = computed(() => saldos(this.datos.valor().movimientos));
  protected readonly deHoy = computed(() => {
    const desde = inicioDelDia();
    return this.datos
      .valor()
      .movimientos.filter((m) => m.en >= desde && delDia(m))
      .sort((a, b) => b.en - a.en);
  });
  protected readonly entro = computed(() => this.deHoy().filter((m) => m.tipo === 'entra').reduce((s, m) => s + m.monto, 0));
  protected readonly salio = computed(() => this.deHoy().filter((m) => m.tipo === 'sale').reduce((s, m) => s + m.monto, 0));
  protected readonly cajaVacia = computed(() => !this.datos.valor().movimientos.length);

  meta(m: Movimiento): string {
    const quien = this.datos.valor().personas.find((p) => p.id === m.personaId)?.nombre;
    const fuente = m.medio && m.medio !== 'Efectivo' ? m.medio : m.fuente === 'Digital' ? 'Billetera' : m.fuente;
    return [fuente, hora(m.en), quien].filter(Boolean).join(' · ');
  }

  ultimoCierre(): string {
    const c = this.datos.valor().ultimoCierre;
    if (!c) return 'Todavía no se ha cerrado la caja';
    const cuadro = c.diferencia === 0 ? 'cuadró exacto' : (c.diferencia < 0 ? 'faltaron ' : 'sobraron ') + plata(Math.abs(c.diferencia));
    return 'Último cierre: ' + cuando(c.en).toLowerCase() + ' · ' + cuadro;
  }

  abrirGasto(): void {
    this.gasto.set({ concepto: '', monto: 0, fuente: 'Efectivo' });
    this.hoja.set('gasto');
  }

  cambiarGasto(cambio: Partial<{ concepto: string; monto: number; fuente: Fuente }>): void {
    this.gasto.update((g) => ({ ...g, ...cambio }));
  }

  async guardarGasto(): Promise<void> {
    const g = this.gasto();
    if (!g.concepto.trim() || g.monto <= 0) {
      this.ui.avisar('Escribe en qué se gastó y cuánto');
      return;
    }
    try {
      await this.caja.gasto(g.concepto, g.monto, g.fuente);
      this.hoja.set(null);
      this.ui.avisar('Gasto anotado: ' + g.concepto.trim() + ' ' + plata(g.monto));
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo anotar el gasto. Intenta otra vez.');
    }
  }

  cambiarInicial(f: Fuente, n: number): void {
    this.iniciales.update((s) => ({ ...s, [f]: n }));
  }

  async guardarIniciales(): Promise<void> {
    const s = this.iniciales();
    if (!s.Efectivo && !s.Banco && !s.Digital) {
      this.ui.avisar('Escribe al menos un saldo');
      return;
    }
    await this.caja.saldosIniciales(s);
    this.hoja.set(null);
    this.ui.avisar('Saldos iniciales guardados');
  }
}
