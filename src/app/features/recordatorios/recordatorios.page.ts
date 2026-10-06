import { Component, computed, signal } from '@angular/core';
import { db, vivo } from '../../core/db';
import { EN_TALLER } from '../../core/estados';
import { diasEntre, isoLocal, plata, plural } from '../../core/formato';
import type { Bici, Cliente, Orden, Taller } from '../../core/models';
import { listaDesde, saldoOrden, totalOrden } from '../../core/ordenes.service';
import { abrirWhatsApp, llenarPlantilla } from '../../core/whatsapp';
import { CargandoComponent, VacioComponent } from '../../shared/vacio.component';

type Grupo = 'sinReclamar' | 'sinResponder' | 'mantenimiento';

interface Recordatorio {
  id: string;
  titulo: string;
  detalle: string;
  dias?: number;
  celular: string;
  mensaje: string;
}

const GRUPOS: { k: Grupo; label: string }[] = [
  { k: 'sinReclamar', label: 'Sin reclamar' },
  { k: 'sinResponder', label: 'Sin responder' },
  { k: 'mantenimiento', label: 'Le toca mantenimiento' },
];

/** Cuántos días antes del próximo mantenimiento se empieza a recordar. */
const AVISO_MANTENIMIENTO = 15;

@Component({
  selector: 'qt-recordatorios',
  imports: [CargandoComponent, VacioComponent],
  template: `
    <div class="page">
      <div class="pills arriba">
        @for (g of grupos; track g.k) {
          <button type="button" class="pill" [class.on]="grupo() === g.k" (click)="grupo.set(g.k)">{{ g.label }} ({{ cuenta()[g.k] }})</button>
        }
      </div>
      @if (datos.cargando()) {
        <qt-cargando />
      } @else {
        <div class="stack">
          @for (r of lista(); track r.id) {
            <div class="card">
              <div class="row">
                <div class="grow">
                  <div class="titulo">{{ r.titulo }}</div>
                  <div class="detalle">{{ r.detalle }}</div>
                </div>
                @if (r.dias !== undefined) {
                  <div class="dias">
                    <div class="display n">{{ r.dias }}</div>
                    <div class="d">días</div>
                  </div>
                }
              </div>
              <button type="button" class="btn btn-success mandar" (click)="mandar(r)">Mandar el mensaje ya escrito</button>
            </div>
          } @empty {
            <qt-vacio titulo="Nada pendiente aquí" texto="Estás al día con este grupo." />
          }
        </div>
      }
    </div>
  `,
  styles: `
    .arriba {
      padding-top: 0;
      padding-bottom: 14px;
    }
    .titulo {
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
    }
    .detalle {
      font-size: 13px;
      color: var(--gray-500);
      margin-top: 4px;
      line-height: 1.4;
    }
    .dias {
      text-align: center;
    }
    .n {
      font-size: 26px;
      color: var(--red-600);
    }
    .d {
      font-size: 10.5px;
      color: var(--gray-400);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 2px;
    }
    .mandar {
      margin-top: 14px;
      min-height: 52px;
    }
  `,
})
export class RecordatoriosPage {
  protected readonly grupos = GRUPOS;
  protected readonly grupo = signal<Grupo>('sinReclamar');

  protected readonly datos = vivo(
    async () => {
      const [ordenes, clientes, bicis, taller] = await Promise.all([db.ordenes.toArray(), db.clientes.toArray(), db.bicis.toArray(), db.taller.get('taller')]);
      return {
        ordenes,
        clientes: new Map(clientes.map((c) => [c.id, c] as [string, Cliente])),
        bicis: new Map(bicis.map((b) => [b.id, b] as [string, Bici])),
        taller,
      };
    },
    { ordenes: [] as Orden[], clientes: new Map<string, Cliente>(), bicis: new Map<string, Bici>(), taller: undefined as Taller | undefined },
  );

  private readonly todos = computed<Record<Grupo, Recordatorio[]>>(() => {
    const { ordenes, clientes, bicis, taller } = this.datos.valor();
    const firma = ' — ' + (taller?.nombre ?? '');
    const biciDe = (id: string) => {
      const b = bicis.get(id);
      return [b?.marca, b?.modelo].filter(Boolean).join(' ');
    };

    const sinReclamar = ordenes
      .filter((o) => o.estado === 'lista')
      .map((o) => {
        const c = clientes.get(o.clienteId);
        const dias = diasEntre(listaDesde(o));
        const saldo = saldoOrden(o);
        const plantilla = taller?.textoListo ?? 'Hola {cliente}, su {bici} ya está lista para recoger. Saldo: {saldo}.';
        return {
          id: o.numero,
          titulo: (c?.nombre ?? '') + ' · ' + o.numero,
          detalle: biciDe(o.biciId) + ' lista ' + (dias ? 'hace ' + plural(dias, 'día', 'días') : 'desde hoy') + ', ocupando espacio. Saldo ' + plata(saldo) + '.',
          dias,
          celular: c?.celular ?? '',
          mensaje:
            llenarPlantilla(plantilla, { cliente: c?.nombre ?? '', bici: biciDe(o.biciId), orden: o.numero, fecha: '', saldo: plata(saldo), taller: taller?.nombre ?? '' }) +
            (dias > 1 ? ' Lleva ' + dias + ' días esperándolo. ¿Cuándo puede pasar?' : '') +
            firma,
        };
      })
      .sort((a, b) => b.dias - a.dias);

    const sinResponder = ordenes
      .filter((o) => o.estado === 'cotizacion')
      .map((o) => {
        const c = clientes.get(o.clienteId);
        const dias = o.cotizacionEnviada ? diasEntre(o.cotizacionEnviada) : 0;
        return {
          id: o.numero,
          titulo: (c?.nombre ?? '') + ' · ' + o.numero,
          detalle: 'Cotización de ' + plata(totalOrden(o)) + ' enviada y sin respuesta.',
          dias,
          celular: c?.celular ?? '',
          mensaje:
            'Hola ' + (c?.nombre ?? '') + ', le recordamos la cotización de su ' + biciDe(o.biciId) + ' (orden ' + o.numero + ') por ' + plata(totalOrden(o)) + '. ¿La autoriza?' + firma,
        };
      })
      .sort((a, b) => b.dias - a.dias);

    // Bicis a las que ya les toca (o les toca en los próximos días) y que no están en el taller.
    const limite = isoLocal(Date.now() + AVISO_MANTENIMIENTO * 864e5);
    const enTaller = new Set(ordenes.filter((o) => EN_TALLER.includes(o.estado)).map((o) => o.biciId));
    const mantenimiento = [...bicis.values()]
      .filter((b) => b.proxMantenimiento && b.proxMantenimiento <= limite && !enTaller.has(b.id))
      .sort((a, b) => (a.proxMantenimiento ?? '').localeCompare(b.proxMantenimiento ?? ''))
      .map((b) => {
        const c = clientes.get(b.clienteId);
        const ultima = ordenes.filter((o) => o.biciId === b.id).sort((x, y) => y.recibida - x.recibida)[0];
        const [a, m, d] = (b.proxMantenimiento ?? '').split('-').map(Number);
        const cuando = new Date(a, m - 1, d).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        return {
          id: b.id,
          titulo: (c?.nombre ?? '') + ' · ' + biciDe(b.id),
          detalle: 'Le toca mantenimiento en ' + cuando + '. Último servicio: ' + (ultima ? new Date(ultima.recibida).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'nunca') + '.',
          celular: c?.celular ?? '',
          mensaje: 'Hola ' + (c?.nombre ?? '') + ', a su ' + biciDe(b.id) + ' le toca mantenimiento en ' + cuando + '. ¿Le agendamos?' + firma,
        };
      });

    return { sinReclamar, sinResponder, mantenimiento };
  });

  protected readonly lista = computed(() => this.todos()[this.grupo()]);
  protected readonly cuenta = computed(() => {
    const t = this.todos();
    return { sinReclamar: t.sinReclamar.length, sinResponder: t.sinResponder.length, mantenimiento: t.mantenimiento.length };
  });

  mandar(r: Recordatorio): void {
    abrirWhatsApp(r.celular, r.mensaje);
  }
}
