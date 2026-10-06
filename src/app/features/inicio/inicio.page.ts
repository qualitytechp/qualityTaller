import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { db, vivo } from '../../core/db';
import { EN_TALLER } from '../../core/estados';
import { diasEntre, fechaLarga, inicioDelDia, plata, plural } from '../../core/formato';
import type { Cliente, Movimiento, Orden, Repuesto } from '../../core/models';
import { listaDesde } from '../../core/ordenes.service';
import { DIAS_MUCHOS, muchosDias, prometidaSinTerminar } from '../ordenes/filtros';
import { CargandoComponent, ErrorComponent } from '../../shared/vacio.component';

interface Chip {
  label: string;
  n: number;
  color: string;
  filtro: string;
}

interface Alerta {
  titulo: string;
  detalle: string;
  n: number;
  color: string;
  ir: () => void;
}

/** Panel del día: lo que hay en el taller, lo que pide atención y la plata de hoy. */
@Component({
  selector: 'qt-inicio',
  imports: [RouterLink, CargandoComponent, ErrorComponent],
  templateUrl: './inicio.page.html',
  styleUrl: './inicio.page.css',
})
export class InicioPage {
  private readonly router = inject(Router);
  protected readonly plata = plata;
  protected readonly hoy = fechaLarga(Date.now());

  protected readonly datos = vivo(
    async () => {
      const [ordenes, repuestos, clientes, movimientos] = await Promise.all([
        db.ordenes.toArray(),
        db.repuestos.toArray(),
        db.clientes.filter((c) => c.debe > 0).toArray(),
        db.movimientos.where('en').aboveOrEqual(inicioDelDia()).toArray(),
      ]);
      return { ordenes, repuestos, deudores: clientes, movimientos };
    },
    { ordenes: [] as Orden[], repuestos: [] as Repuesto[], deudores: [] as Cliente[], movimientos: [] as Movimiento[] },
  );

  protected readonly enTaller = computed(() => this.datos.valor().ordenes.filter((o) => EN_TALLER.includes(o.estado)).length);

  protected readonly chips = computed<Chip[]>(() => {
    const o = this.datos.valor().ordenes;
    const n = (...e: Orden['estado'][]) => o.filter((x) => e.includes(x.estado)).length;
    return [
      { label: 'Por diagnosticar', n: n('recibida'), color: 'var(--gray-500)', filtro: 'recibida' },
      { label: 'Esperando aprobación', n: n('cotizacion'), color: 'var(--warning-500)', filtro: 'cotizacion' },
      { label: 'En reparación', n: n('diagnostico', 'aprobada', 'reparacion'), color: 'var(--red-600)', filtro: 'reparacion' },
      { label: 'Esperando repuesto', n: n('repuesto'), color: 'var(--warning-600)', filtro: 'repuesto' },
      { label: 'Listas para entrega', n: n('lista'), color: 'var(--success-500)', filtro: 'lista' },
    ];
  });

  /** Solo se muestran las alertas que tienen algo. */
  protected readonly alertas = computed<Alerta[]>(() => {
    const { ordenes, repuestos } = this.datos.valor();
    const ahora = Date.now();
    const numeros = (l: Orden[]) => l.slice(0, 3).map((o) => o.numero).join(' · ') + (l.length > 3 ? ' y ' + (l.length - 3) + ' más' : '');
    const a: Alerta[] = [];

    const hoy = ordenes.filter((o) => prometidaSinTerminar(o, ahora)).sort((x, y) => x.prometida - y.prometida);
    if (hoy.length) {
      const tarde = hoy.filter((o) => o.prometida < ahora).length;
      a.push({
        titulo: 'Prometidas para hoy sin terminar',
        detalle: numeros(hoy) + (tarde ? ' — ' + plural(tarde, 'ya se pasó', 'ya se pasaron') : ' — el cliente ya las está esperando'),
        n: hoy.length,
        color: 'var(--red-600)',
        ir: () => this.ordenes('hoy'),
      });
    }

    const listas = ordenes.filter((o) => o.estado === 'lista');
    if (listas.length) {
      const vieja = Math.max(...listas.map((o) => diasEntre(listaDesde(o), ahora)));
      a.push({
        titulo: 'Bicis listas sin reclamar',
        detalle: vieja > 0 ? 'La más vieja lleva ' + plural(vieja, 'día', 'días') + ' ocupando espacio' : 'Avísale al cliente que ya puede pasar',
        n: listas.length,
        color: 'var(--warning-600)',
        ir: () => this.ordenes('lista'),
      });
    }

    const cotizadas = ordenes.filter((o) => o.estado === 'cotizacion').sort((x, y) => (x.cotizacionEnviada ?? 0) - (y.cotizacionEnviada ?? 0));
    if (cotizadas.length) {
      const d = cotizadas[0].cotizacionEnviada ? diasEntre(cotizadas[0].cotizacionEnviada, ahora) : 0;
      a.push({
        titulo: 'Cotizaciones sin respuesta',
        detalle: cotizadas[0].numero + ' — enviada ' + (d === 0 ? 'hoy' : 'hace ' + plural(d, 'día', 'días')),
        n: cotizadas.length,
        color: 'var(--warning-500)',
        ir: () => this.ordenes('cotizacion'),
      });
    }

    const bajos = repuestos.filter((r) => r.cantidad <= r.minimo);
    if (bajos.length) {
      a.push({
        titulo: 'Repuestos por debajo del mínimo',
        detalle: bajos.slice(0, 2).map((r) => r.nombre).join(' · ') + (bajos.length > 2 ? ' y ' + (bajos.length - 2) + ' más' : ''),
        n: bajos.length,
        color: 'var(--zinc-800)',
        ir: () => this.router.navigate(['/repuestos'], { queryParams: { filtro: 'bajos' } }),
      });
    }

    const viejas = ordenes.filter((o) => muchosDias(o, ahora)).sort((x, y) => x.recibida - y.recibida);
    if (viejas.length) {
      a.push({
        titulo: 'Bicis con muchos días en el taller',
        detalle: viejas[0].numero + ' lleva ' + plural(diasEntre(viejas[0].recibida, ahora), 'día', 'días') + ' (más de ' + DIAS_MUCHOS + ')',
        n: viejas.length,
        color: 'var(--zinc-900)',
        ir: () => this.ordenes('viejas'),
      });
    }
    return a;
  });

  /** Lo que entró y salió hoy; los saldos iniciales no cuentan como movimiento del día. */
  protected readonly entro = computed(() =>
    this.datos.valor().movimientos.filter((m) => m.tipo === 'entra' && m.origen?.tipo !== 'saldo').reduce((s, m) => s + m.monto, 0),
  );
  protected readonly salio = computed(() =>
    this.datos.valor().movimientos.filter((m) => m.tipo === 'sale' && m.origen?.tipo !== 'saldo').reduce((s, m) => s + m.monto, 0),
  );

  protected readonly meDeben = computed(() => this.datos.valor().deudores.reduce((s, c) => s + c.debe, 0));
  protected readonly deudoresTexto = computed(() => {
    const l = [...this.datos.valor().deudores].sort((a, b) => b.debe - a.debe).map((c) => c.nombre);
    if (!l.length) return 'Nadie te debe nada';
    if (l.length <= 2) return l.join(' y ');
    return l.slice(0, 2).join(', ') + ' y ' + plural(l.length - 2, 'más', 'más');
  });

  ordenes(filtro: string): void {
    this.router.navigate(['/ordenes'], { queryParams: { filtro } });
  }
}
