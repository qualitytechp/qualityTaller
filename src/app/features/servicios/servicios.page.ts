import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { db, nuevoId, vivo } from '../../core/db';
import { plata, plural, soloDigitos } from '../../core/formato';
import { CATEGORIAS_SERVICIO, type CategoriaServicio, type Servicio } from '../../core/models';
import { SesionService } from '../../core/sesion.service';
import { UiService } from '../../core/ui.service';
import { CampoPlataComponent } from '../../shared/campo-plata.component';
import { HojaComponent } from '../../shared/hoja.component';
import { CargandoComponent, VacioComponent } from '../../shared/vacio.component';

/** "1h 30m", "45m". */
export function duracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return (h ? h + 'h' : '') + (h && m ? ' ' : '') + (m || !h ? m + 'm' : '');
}

@Component({
  selector: 'qt-servicios',
  imports: [FormsModule, CampoPlataComponent, HojaComponent, CargandoComponent, VacioComponent],
  template: `
    <div class="sticky-bar">
      <div class="pills arriba">
        <button type="button" class="pill" [class.on]="categoria() === null" (click)="categoria.set(null)">Todas</button>
        @for (c of categorias; track c) {
          <button type="button" class="pill" [class.on]="categoria() === c" (click)="categoria.set(c)">{{ c }}</button>
        }
      </div>
    </div>
    <div class="lista">
      @if (servicios.cargando()) {
        <qt-cargando />
      } @else {
        <div class="row-between">
          <span class="conteo">{{ conteo() }}</span>
          @if (sesion.esAdmin()) {
            <button type="button" class="nuevo" (click)="editar(null)">+ Servicio nuevo</button>
          }
        </div>
        @for (s of lista(); track s.id) {
          <button type="button" class="card servicio" [disabled]="!sesion.esAdmin()" (click)="editar(s)">
            <div class="grow">
              <div class="nombre">{{ s.nombre }}</div>
              <div class="meta">{{ s.categoria }} · toma {{ duracion(s.minutos) }}</div>
            </div>
            <div class="display precio">{{ plata(s.precio) }}</div>
          </button>
        } @empty {
          <qt-vacio titulo="No hay servicios aquí" texto="Los servicios salen en las cotizaciones con su precio." />
        }
      }
    </div>

    @if (editando(); as s) {
      <qt-hoja [titulo]="s.id ? 'Editar servicio' : 'Servicio nuevo'" (cerrar)="editando.set(null)">
        <label class="label" for="s-nombre">Nombre <span class="req">*</span></label>
        <input id="s-nombre" class="input" [ngModel]="s.nombre" (ngModelChange)="cambiar({ nombre: $event })" placeholder="Purga de frenos" autocomplete="off" />
        <span class="label">Categoría</span>
        <div class="pills-wrap">
          @for (c of categorias; track c) {
            <button type="button" class="pill" [class.on]="s.categoria === c" (click)="cambiar({ categoria: c })">{{ c }}</button>
          }
        </div>
        <div class="grid-2">
          <div>
            <label class="label" for="s-precio">Precio <span class="req">*</span></label>
            <qt-campo-plata campoId="s-precio" [valor]="s.precio" (valorChange)="cambiar({ precio: $event })" />
          </div>
          <div>
            <label class="label" for="s-min">Minutos</label>
            <input id="s-min" class="input" inputmode="numeric" [ngModel]="s.minutos" (ngModelChange)="cambiarMinutos($event)" />
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-lg" (click)="guardar()">Guardar</button>
      </qt-hoja>
    }
  `,
  styles: `
    .arriba {
      padding-top: 0;
    }
    .lista {
      padding: 4px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .conteo {
      font-size: 13px;
      color: var(--gray-500);
    }
    .nuevo {
      background: transparent;
      border: 0;
      color: var(--red-700);
      font-size: 14px;
      font-weight: 700;
      min-height: 40px;
    }
    .servicio {
      display: flex;
      align-items: center;
      gap: 12px;
      text-align: left;
      font: inherit;
      color: inherit;
    }
    .nombre {
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
    }
    .meta {
      font-size: 12.5px;
      color: var(--gray-500);
      margin-top: 3px;
    }
    .precio {
      font-size: 22px;
      white-space: nowrap;
    }
  `,
})
export class ServiciosPage {
  protected readonly sesion = inject(SesionService);
  private readonly ui = inject(UiService);
  protected readonly plata = plata;
  protected readonly duracion = duracion;
  protected readonly categorias = CATEGORIAS_SERVICIO;
  protected readonly categoria = signal<CategoriaServicio | null>(null);
  protected readonly editando = signal<Servicio | null>(null);

  protected readonly servicios = vivo(() => db.servicios.toArray(), [] as Servicio[]);
  protected readonly lista = computed(() =>
    this.servicios
      .valor()
      .filter((s) => !this.categoria() || s.categoria === this.categoria())
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre)),
  );
  protected readonly conteo = computed(() => plural(this.lista().length, 'servicio', 'servicios'));

  editar(s: Servicio | null): void {
    if (!this.sesion.esAdmin()) return;
    this.editando.set(s ? { ...s } : { id: '', nombre: '', categoria: this.categoria() ?? 'General', precio: 0, minutos: 30 });
  }

  cambiar(c: Partial<Servicio>): void {
    this.editando.update((s) => (s ? { ...s, ...c } : s));
  }

  cambiarMinutos(texto: string): void {
    this.cambiar({ minutos: parseInt(soloDigitos(texto), 10) || 0 });
  }

  async guardar(): Promise<void> {
    const s = this.editando();
    if (!s) return;
    if (!s.nombre.trim() || s.precio <= 0) {
      this.ui.avisar('El nombre y el precio son obligatorios');
      return;
    }
    await db.servicios.put({ ...s, id: s.id || nuevoId(), nombre: s.nombre.trim() });
    this.editando.set(null);
    this.ui.avisar('Servicio guardado');
  }
}
