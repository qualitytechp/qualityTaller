import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { db, vivo } from '../../core/db';
import { DEL_MECANICO } from '../../core/estados';
import { inicial, plata, plural } from '../../core/formato';
import type { Orden, Persona } from '../../core/models';
import { manoDeObra } from '../../core/ordenes.service';
import { CargandoComponent, VacioComponent } from '../../shared/vacio.component';

function inicioDelMes(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

@Component({
  selector: 'qt-mecanicos',
  imports: [RouterLink, CargandoComponent, VacioComponent],
  template: `
    @if (datos.cargando()) {
      <qt-cargando />
    } @else {
      <div class="page stack-12">
        @for (m of fichas(); track m.persona.id) {
          <div class="card ficha">
            <div class="row">
              <div class="avatar oscuro">{{ inicial(m.persona.nombre) }}</div>
              <div class="grow">
                <div class="nombre">{{ m.persona.nombre }}{{ m.persona.rol === 'admin' ? ' (administrador)' : '' }}</div>
                <div class="estado" [class.libre]="!m.asignadas">{{ m.asignadas ? 'Trabajando hoy' : 'Sin bicis asignadas' }}</div>
              </div>
            </div>
            <div class="grid-2 cifras">
              <div>
                <div class="eyebrow">Bicis asignadas</div>
                <div class="display cifra">{{ m.asignadas }}</div>
              </div>
              <div>
                <div class="eyebrow">Mano de obra del mes</div>
                <div class="display cifra">{{ plata(m.obra) }}</div>
              </div>
            </div>
            <div class="comision">
              @if (m.persona.comision > 0) {
                Con {{ m.persona.comision }}% de comisión le corresponden <strong>{{ plata(m.obra * m.persona.comision / 100) }}</strong> este mes
                ({{ entregadas(m.entregadas) }}).
              } @else {
                Sin comisión configurada. Se cambia en Configuración → Personas.
              }
            </div>
            <a class="btn btn-outline ver" routerLink="/mis-trabajos" [queryParams]="{ de: m.persona.id }">Ver sus trabajos de hoy</a>
          </div>
        } @empty {
          <qt-vacio titulo="No hay mecánicos" texto="Agrégalos en Configuración → Personas." />
        }
      </div>
    }
  `,
  styles: `
    .oscuro {
      width: 48px;
      height: 48px;
      background: var(--zinc-900);
      color: var(--white);
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 19px;
    }
    .ficha {
      border-radius: 18px;
      padding: 18px;
    }
    .nombre {
      font-size: 17px;
      font-weight: 600;
    }
    .estado {
      font-size: 13px;
      font-weight: 600;
      color: var(--success-700);
      margin-top: 2px;
    }
    .estado.libre {
      color: var(--gray-500);
    }
    .cifras {
      gap: 14px;
      margin-top: 16px;
    }
    .cifra {
      font-size: 30px;
      margin-top: 3px;
    }
    .comision {
      font-size: 13px;
      color: var(--gray-500);
      margin-top: 14px;
      line-height: 1.4;
    }
    .comision strong {
      color: var(--gray-900);
    }
    .ver {
      margin-top: 14px;
      min-height: 52px;
    }
  `,
})
export class MecanicosPage {
  protected readonly plata = plata;
  protected readonly inicial = inicial;

  protected readonly datos = vivo(
    async () => ({
      personas: await db.personas.filter((p) => p.activo && (p.rol === 'mecanico' || p.rol === 'admin')).toArray(),
      ordenes: await db.ordenes.toArray(),
    }),
    { personas: [] as Persona[], ordenes: [] as Orden[] },
  );

  /** Los mecánicos, y el administrador solo si tiene trabajo asignado. */
  protected readonly fichas = computed(() => {
    const { personas, ordenes } = this.datos.valor();
    const mes = inicioDelMes();
    return personas
      .map((persona) => {
        const suyas = ordenes.filter((o) => o.mecanicoId === persona.id);
        const delMes = suyas.filter((o) => o.estado === 'entregada' && (o.entregada ?? 0) >= mes && !o.garantiaDe);
        return {
          persona,
          asignadas: suyas.filter((o) => DEL_MECANICO.includes(o.estado) || o.estado === 'recibida').length,
          obra: delMes.reduce((s, o) => s + manoDeObra(o.items), 0),
          entregadas: delMes.length,
        };
      })
      .filter((f) => f.persona.rol === 'mecanico' || f.asignadas || f.obra)
      .sort((a, b) => (a.persona.rol === b.persona.rol ? a.persona.nombre.localeCompare(b.persona.nombre) : a.persona.rol === 'mecanico' ? -1 : 1));
  });

  entregadas(n: number): string {
    return plural(n, 'bici entregada', 'bicis entregadas');
  }
}
