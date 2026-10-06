import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { db, vivo } from '../../core/db';
import { cuando, diasEntre, inicial, normalizar, plural, soloDigitos, tono } from '../../core/formato';
import type { Bici, Cliente, Orden, Persona } from '../../core/models';
import { estaTarde, listaDesde, queSeLeHace } from '../../core/ordenes.service';
import { EstadoComponent } from '../../shared/estado.component';
import { FotoComponent } from '../../shared/foto.component';
import { CargandoComponent, ErrorComponent, VacioComponent } from '../../shared/vacio.component';
import { FILTROS } from './filtros';

interface Tarjeta {
  orden: Orden;
  cliente: string;
  bici: string;
  fotoId?: string;
  inicial: string;
  tono: string;
  trabajo: string;
  dias: string;
  prometida: string;
  tarde: boolean;
  mecanico: string;
}

@Component({
  selector: 'qt-ordenes',
  imports: [FormsModule, RouterLink, EstadoComponent, FotoComponent, CargandoComponent, ErrorComponent, VacioComponent],
  template: `
    <div class="sticky-bar">
      <input
        class="input input-search"
        type="search"
        placeholder="Orden, cliente, celular o serie"
        [ngModel]="busqueda()"
        (ngModelChange)="buscar($event)"
        autocomplete="off"
      />
      <div class="pills">
        @for (f of filtrosVisibles(); track f.k) {
          <button type="button" class="pill" [class.on]="filtro() === f.k" (click)="filtrar(f.k)">{{ f.label }}</button>
        }
      </div>
    </div>

    <div class="lista">
      @if (datos.error(); as e) {
        <qt-error [texto]="e" />
      } @else if (datos.cargando()) {
        <qt-cargando />
      } @else {
        <div class="conteo">{{ conteo() }}</div>
        @for (t of tarjetas(); track t.orden.numero) {
          <a class="card-sm card-tap tarjeta" [routerLink]="['/orden', t.orden.numero]">
            <qt-foto class="thumb" [fotoId]="t.fotoId" [style.background]="t.tono">{{ t.inicial }}</qt-foto>
            <div class="grow">
              <div class="linea1">
                <span class="display numero">{{ t.orden.numero }}</span>
                <span class="dias">{{ t.dias }}</span>
              </div>
              <div class="cliente ellipsis">{{ t.cliente }}</div>
              <div class="bici ellipsis">{{ t.bici }}</div>
              <div class="trabajo ellipsis">{{ t.trabajo }}</div>
              <div class="estado">
                <qt-estado [estado]="t.orden.estado" />
                <span class="prometida" [class.tarde]="t.tarde">{{ t.prometida }}</span>
              </div>
              <div class="mecanico">{{ t.mecanico }}</div>
            </div>
          </a>
        } @empty {
          <qt-vacio titulo="No hay órdenes aquí" texto="Cambia el filtro o toca el botón rojo de abajo para recibir una bici." />
        }
      }
    </div>
  `,
  styles: `
    .lista {
      padding: 4px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .conteo {
      font-size: 13px;
      color: var(--gray-500);
      padding: 2px 0 4px;
    }
    .tarjeta {
      display: flex;
      gap: 12px;
      padding: 12px;
      border-radius: 16px;
      color: inherit;
    }
    .linea1 {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .numero {
      font-size: 18px;
    }
    .dias {
      font-size: 12px;
      color: var(--gray-400);
    }
    .cliente {
      font-size: 15px;
      font-weight: 600;
      margin-top: 1px;
    }
    .bici {
      font-size: 13px;
      color: var(--gray-500);
    }
    .trabajo {
      font-size: 13px;
      color: var(--gray-700);
      margin-top: 4px;
    }
    .estado {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .prometida {
      font-size: 12px;
      font-weight: 600;
      color: var(--gray-500);
    }
    .prometida.tarde {
      color: var(--red-600);
    }
    .mecanico {
      font-size: 12px;
      color: var(--gray-400);
      margin-top: 5px;
    }
  `,
})
export class OrdenesPage {
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly params = this.ruta.snapshot.queryParamMap;

  /** Los especiales solo aparecen si están puestos (se llegó desde una alerta de Inicio). */
  protected readonly filtrosVisibles = computed(() => FILTROS.filter((f) => !f.especial || f.k === this.filtro()));
  protected readonly filtro = signal(this.params.get('filtro') ?? 'todas');
  protected readonly busqueda = signal(this.params.get('q') ?? '');

  protected readonly datos = vivo(
    async () => {
      const [ordenes, clientes, bicis, personas] = await Promise.all([
        db.ordenes.orderBy('recibida').reverse().toArray(),
        db.clientes.toArray(),
        db.bicis.toArray(),
        db.personas.toArray(),
      ]);
      return {
        ordenes,
        clientes: new Map(clientes.map((c) => [c.id, c] as [string, Cliente])),
        bicis: new Map(bicis.map((b) => [b.id, b] as [string, Bici])),
        personas: new Map(personas.map((p) => [p.id, p] as [string, Persona])),
      };
    },
    { ordenes: [] as Orden[], clientes: new Map<string, Cliente>(), bicis: new Map<string, Bici>(), personas: new Map<string, Persona>() },
  );

  protected readonly tarjetas = computed<Tarjeta[]>(() => {
    const { ordenes, clientes, bicis, personas } = this.datos.valor();
    const prueba = FILTROS.find((f) => f.k === this.filtro())?.prueba;
    const q = normalizar(this.busqueda());
    const qDig = soloDigitos(q);
    const ahora = Date.now();
    return ordenes
      .filter((o) => !prueba || prueba(o, ahora))
      .filter((o) => {
        if (!q) return true;
        const c = clientes.get(o.clienteId);
        const b = bicis.get(o.biciId);
        const texto = normalizar([o.numero, c?.nombre, b?.serie, b?.marca, b?.modelo].join(' '));
        return texto.includes(q) || (qDig.length >= 3 && soloDigitos(c?.celular ?? '').includes(qDig));
      })
      .map((o) => {
        const c = clientes.get(o.clienteId);
        const b = bicis.get(o.biciId);
        const m = o.mecanicoId ? personas.get(o.mecanicoId) : undefined;
        return {
          orden: o,
          cliente: c?.nombre ?? 'Cliente borrado',
          bici: [b?.marca, b?.modelo].filter(Boolean).join(' '),
          fotoId: o.fotos[0]?.id ?? b?.fotoId,
          inicial: inicial(b?.marca),
          tono: tono(o.biciId + o.numero),
          trabajo: queSeLeHace(o),
          dias: this.textoDias(o, ahora),
          prometida: this.textoPrometida(o, ahora),
          tarde: estaTarde(o, ahora),
          mecanico: m ? 'Mecánico: ' + m.nombre : 'Sin mecánico asignado',
        };
      });
  });

  protected readonly conteo = computed(() => plural(this.tarjetas().length, 'orden', 'órdenes'));

  private textoDias(o: Orden, ahora: number): string {
    const d = diasEntre(o.recibida, o.entregada ?? ahora);
    if (o.estado === 'entregada') return d === 0 ? 'salió el mismo día' : 'estuvo ' + plural(d, 'día', 'días');
    return d === 0 ? 'entró hoy' : plural(d, 'día', 'días') + ' en taller';
  }

  private textoPrometida(o: Orden, ahora: number): string {
    if (o.estado === 'lista') return 'Lista desde ' + cuando(listaDesde(o), false).toLowerCase();
    if (o.estado === 'entregada' && o.entregada) return 'Entregada ' + cuando(o.entregada, false).toLowerCase();
    if (o.estado === 'rechazada' || o.estado === 'abandonada') return '';
    return (estaTarde(o, ahora) ? 'Se pasó: ' : '') + cuando(o.prometida);
  }

  buscar(q: string): void {
    this.busqueda.set(q);
    this.recordar();
  }

  filtrar(k: string): void {
    this.filtro.set(k);
    this.recordar();
  }

  /** Guarda el filtro en la dirección para que al volver de una orden siga puesto. */
  private recordar(): void {
    this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { filtro: this.filtro() === 'todas' ? null : this.filtro(), q: this.busqueda() || null },
      replaceUrl: true,
    });
  }
}
