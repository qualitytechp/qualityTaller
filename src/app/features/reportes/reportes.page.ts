import { Component, computed, inject } from '@angular/core';
import { db, vivo } from '../../core/db';
import { diasEntre, hora, plata, plural } from '../../core/formato';
import type { Cliente, Movimiento, Orden, Repuesto, Taller } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { abrirWhatsApp, compartirArchivos } from '../../core/whatsapp';
import { CargandoComponent } from '../../shared/vacio.component';

const DIA = 864e5;

function mesDe(ms: number, desplazamiento = 0): { desde: number; hasta: number; nombre: string } {
  const d = new Date(ms);
  const desde = new Date(d.getFullYear(), d.getMonth() + desplazamiento, 1);
  const hasta = new Date(d.getFullYear(), d.getMonth() + desplazamiento + 1, 1);
  return { desde: desde.getTime(), hasta: hasta.getTime(), nombre: desde.toLocaleDateString('es-CO', { month: 'long' }) };
}

/** Plata que cuenta como del negocio: sin saldos iniciales ni ajustes de cierre. */
const delNegocio = (m: Movimiento) => m.origen?.tipo !== 'saldo' && m.origen?.tipo !== 'ajuste';

function balance(movs: Movimiento[], desde: number, hasta: number) {
  const l = movs.filter((m) => m.en >= desde && m.en < hasta && delNegocio(m));
  const entro = l.filter((m) => m.tipo === 'entra').reduce((s, m) => s + m.monto, 0);
  const salio = l.filter((m) => m.tipo === 'sale').reduce((s, m) => s + m.monto, 0);
  return { entro, salio, queda: entro - salio };
}

@Component({
  selector: 'qt-reportes',
  imports: [CargandoComponent],
  templateUrl: './reportes.page.html',
  styleUrl: './reportes.page.css',
})
export class ReportesPage {
  private readonly ui = inject(UiService);
  protected readonly plata = plata;
  private readonly mes = mesDe(Date.now());
  private readonly anterior = mesDe(Date.now(), -1);
  protected readonly nombreMes = this.mes.nombre;

  protected readonly datos = vivo(
    async () => {
      const [movimientos, ordenes, repuestos, clientes, taller] = await Promise.all([
        db.movimientos.toArray(),
        db.ordenes.toArray(),
        db.repuestos.toArray(),
        db.clientes.toArray(),
        db.taller.get('taller'),
      ]);
      return { movimientos, ordenes, repuestos, clientes, taller };
    },
    { movimientos: [] as Movimiento[], ordenes: [] as Orden[], repuestos: [] as Repuesto[], clientes: [] as Cliente[], taller: undefined as Taller | undefined },
  );

  protected readonly este = computed(() => balance(this.datos.valor().movimientos, this.mes.desde, this.mes.hasta));
  protected readonly comparacion = computed(() => {
    const antes = balance(this.datos.valor().movimientos, this.anterior.desde, this.anterior.hasta).queda;
    const ahora = this.este().queda;
    if (!antes) return { texto: 'Primer mes con datos para comparar', bueno: true };
    const pct = Math.round(((ahora - antes) / Math.abs(antes)) * 100);
    return {
      texto: Math.abs(pct) + '% ' + (pct >= 0 ? 'más' : 'menos') + ' que en ' + this.anterior.nombre + ' (' + plata(antes) + ')',
      bueno: pct >= 0,
    };
  });

  private readonly entregadasMes = computed(() =>
    this.datos.valor().ordenes.filter((o) => o.estado === 'entregada' && !o.garantiaDe && (o.entregada ?? 0) >= this.mes.desde && (o.entregada ?? 0) < this.mes.hasta),
  );

  protected readonly promesa = computed(() => {
    const e = this.entregadasMes();
    const aTiempo = e.filter((o) => (o.listaEn ?? o.entregada ?? 0) <= o.prometida).length;
    const promedio = e.length ? e.reduce((s, o) => s + ((o.entregada ?? o.recibida) - o.recibida) / DIA, 0) / e.length : 0;
    return {
      aTiempo: e.length ? Math.round((aTiempo / e.length) * 100) + '%' : '—',
      tiempo: e.length ? promedio.toFixed(1).replace('.', ',') + ' días' : '—',
      entraron: this.datos.valor().ordenes.filter((o) => o.recibida >= this.mes.desde && o.recibida < this.mes.hasta).length,
      salieron: e.length,
    };
  });

  /** Los servicios que más plata dejan (del mes; si no hay entregas, de siempre). */
  protected readonly servicios = computed(() => {
    let base = this.entregadasMes();
    const delMes = base.length > 0;
    if (!delMes) base = this.datos.valor().ordenes.filter((o) => o.estado === 'entregada');
    const suma = new Map<string, number>();
    for (const o of base) for (const i of o.items) if (i.tipo === 'servicio') suma.set(i.nombre, (suma.get(i.nombre) ?? 0) + i.precio * i.cantidad);
    const top = [...suma].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = top[0]?.[1] || 1;
    return {
      delMes,
      lista: top.map(([nombre, monto], k) => ({
        nombre,
        monto,
        pct: Math.round((monto / max) * 100),
        meta: k === 0 ? 'Lo que más plata deja' : Math.round((monto / max) * 100) + '% de lo que deja el primero',
      })),
    };
  });

  protected readonly quietos = computed(() => {
    const limite = Date.now() - 60 * DIA;
    return this.datos
      .valor()
      .repuestos.filter((r) => r.cantidad > 0 && Math.max(r.ultimaSalida ?? 0, r.ultimaEntrada ?? 0) < limite)
      .map((r) => ({ r, plata: r.cantidad * r.costo }))
      .sort((a, b) => b.plata - a.plata)
      .slice(0, 5);
  });

  protected readonly dormidos = computed(() => {
    const { ordenes, clientes } = this.datos.valor();
    const limite = Date.now() - 180 * DIA;
    return clientes
      .map((c) => {
        const suyas = ordenes.filter((o) => o.clienteId === c.id);
        const ultima = Math.max(0, ...suyas.map((o) => o.recibida));
        const gastado = suyas.filter((o) => o.estado === 'entregada').reduce((s, o) => s + (o.pago?.monto ?? 0) + (o.adelanto || 0), 0);
        return { c, ultima, gastado };
      })
      .filter((x) => x.ultima && x.ultima < limite)
      .sort((a, b) => b.gastado - a.gastado)
      .slice(0, 5);
  });

  quietosTexto(n: number): string {
    return plural(n, 'quieto', 'quietos');
  }

  mesesSin(ms: number): string {
    return plural(Math.max(1, Math.round(diasEntre(ms) / 30)), 'mes', 'meses');
  }

  escribir(c: Cliente): void {
    abrirWhatsApp(
      c.celular,
      'Hola ' + c.nombre + ', hace rato no la/lo vemos por ' + (this.datos.valor().taller?.nombre ?? 'el taller') + '. ¿Le hacemos una revisión a su bici? Le tenemos precio especial.',
    );
  }

  /** Los movimientos del mes en una planilla para el contador (se abre en Excel). */
  async descargar(): Promise<void> {
    const movs = this.datos
      .valor()
      .movimientos.filter((m) => m.en >= this.mes.desde && m.en < this.mes.hasta)
      .sort((a, b) => a.en - b.en);
    const celda = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
    const filas = [
      ['Fecha', 'Hora', 'Tipo', 'Concepto', 'Fuente', 'Medio', 'Monto'],
      ...movs.map((m) => [
        new Date(m.en).toLocaleDateString('es-CO'),
        hora(m.en),
        m.tipo === 'entra' ? 'Entrada' : 'Salida',
        m.concepto,
        m.fuente === 'Digital' ? 'Billeteras' : m.fuente,
        m.medio ?? '',
        m.tipo === 'entra' ? m.monto : -m.monto,
      ]),
      [],
      ['', '', '', 'Entró en el mes', '', '', this.este().entro],
      ['', '', '', 'Salió en el mes', '', '', -this.este().salio],
    ];
    // Punto y coma y marca BOM: así Excel en español abre bien las columnas y las tildes.
    const csv = '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
    const d = new Date(this.mes.desde);
    const nombre = 'qualitytaller-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '.csv';
    const archivo = new File([csv], nombre, { type: 'text/csv' });
    if (!(await compartirArchivos([archivo], 'Movimientos de ' + this.nombreMes))) {
      const url = URL.createObjectURL(archivo);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    this.ui.avisar('Planilla de ' + this.nombreMes + ' lista');
  }
}
