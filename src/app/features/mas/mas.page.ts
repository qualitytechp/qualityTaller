import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { db, vivo } from '../../core/db';
import { cuando, plata, plural } from '../../core/formato';
import type { Rol } from '../../core/models';
import { entregarRespaldo, prepararRespaldo, restaurarRespaldo, ultimoRespaldo } from '../../core/respaldo';
import { ROL_LABEL, SesionService } from '../../core/sesion.service';
import { UiService } from '../../core/ui.service';

interface Modulo {
  label: string;
  meta: string;
  ruta: string;
  roles: Rol[];
}

const TODOS: Rol[] = ['admin', 'mostrador'];

@Component({
  selector: 'qt-mas',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="card row">
        <div class="avatar oscuro">{{ inicial() }}</div>
        <div class="grow">
          <div class="nombre">{{ sesion.persona()?.nombre }}</div>
          <div class="muted">{{ rolLabel() }}</div>
        </div>
      </div>
      <button type="button" class="btn btn-outline cambiar" (click)="cambiar()">Cambiar de persona</button>

      <div class="subtitulo">Módulos</div>
      <div class="stack-8">
        @for (m of modulos(); track m.ruta) {
          <a class="card-sm card-tap row modulo" [routerLink]="m.ruta">
            <div class="grow">
              <div class="nombre">{{ m.label }}</div>
              <div class="meta">{{ m.meta }}</div>
            </div>
            <span class="flecha">›</span>
          </a>
        }
      </div>

      @if (sesion.esAdmin()) {
        <div class="subtitulo">Copia de seguridad</div>
        <div class="card stack-12">
          <div class="texto">
            Todo el taller vive en este celular. Haz una copia cada semana y guárdala en Archivos, iCloud o
            mándatela por WhatsApp. Si el celular se daña o se pierde, con la copia recuperas todo.
          </div>
          <div class="ultima" [class.vieja]="copiaVieja()">{{ textoUltima() }}</div>
          @if (copia(); as c) {
            <button type="button" class="btn btn-success btn-lg" (click)="entregar(c)">Guardar la copia ({{ tamano(c) }})</button>
          } @else {
            <button type="button" class="btn btn-dark btn-lg" [class.is-off]="ocupado()" (click)="respaldar()">
              {{ ocupado() ? 'Armando la copia…' : 'Hacer una copia ahora' }}
            </button>
          }
          <button type="button" class="btn btn-outline" (click)="archivo.click()">Restaurar desde una copia</button>
          <input #archivo type="file" accept="application/json,.json" hidden (change)="restaurar($event)" />
        </div>
      }
    </div>
  `,
  styles: `
    .oscuro {
      background: var(--zinc-900);
      color: var(--white);
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 19px;
    }
    .nombre {
      font-size: 16px;
      font-weight: 600;
    }
    .cambiar {
      margin-top: 8px;
      min-height: 54px;
    }
    .subtitulo {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--gray-500);
      margin: 22px 0 10px;
    }
    .stack-8 {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .modulo {
      padding: 16px;
      min-height: 64px;
      color: inherit;
    }
    .meta {
      font-size: 13px;
      color: var(--gray-500);
      margin-top: 2px;
      line-height: 1.35;
    }
    .flecha {
      font-size: 22px;
      color: var(--gray-300);
    }
    .texto {
      font-size: 14px;
      color: var(--gray-600);
      line-height: 1.45;
    }
    .ultima {
      font-size: 13px;
      font-weight: 600;
      color: var(--success-700);
    }
    .ultima.vieja {
      color: var(--red-700);
    }
  `,
})
export class MasPage {
  protected readonly sesion = inject(SesionService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  private readonly datos = vivo(
    async () => {
      const [repuestos, servicios, proveedores, clientes, mecanicos] = await Promise.all([
        db.repuestos.toArray(),
        db.servicios.count(),
        db.proveedores.toArray(),
        db.clientes.filter((c) => c.debe > 0).toArray(),
        db.personas.where('rol').equals('mecanico').count(),
      ]);
      return {
        repuestos: repuestos.length,
        bajos: repuestos.filter((r) => r.cantidad <= r.minimo).length,
        servicios,
        debo: proveedores.reduce((s, p) => s + p.debe, 0),
        meDeben: clientes.reduce((s, c) => s + c.debe, 0),
        mecanicos,
      };
    },
    { repuestos: 0, bajos: 0, servicios: 0, debo: 0, meDeben: 0, mecanicos: 0 },
  );

  private readonly ultima = signal<number | undefined>(undefined);
  protected readonly ocupado = signal(false);
  protected readonly copia = signal<File | null>(null);

  protected readonly inicial = computed(() => (this.sesion.persona()?.nombre ?? '?').charAt(0).toUpperCase());
  protected readonly rolLabel = computed(() => {
    const r = this.sesion.rol();
    return r ? ROL_LABEL[r] : '';
  });

  protected readonly copiaVieja = computed(() => {
    const u = this.ultima();
    return !u || Date.now() - u > 7 * 864e5;
  });
  protected readonly textoUltima = computed(() => {
    const u = this.ultima();
    return u ? 'Última copia: ' + cuando(u) : 'Todavía no has hecho ninguna copia';
  });

  protected readonly modulos = computed(() => {
    const d = this.datos.valor();
    const rol = this.sesion.rol() ?? 'mostrador';
    const lista: Modulo[] = [
      { label: 'Mis trabajos (vista del mecánico)', meta: 'Lo que ve el mecánico en su celular', ruta: '/mis-trabajos', roles: ['admin'] },
      { label: 'Venta de vitrina', meta: 'Cobrar sin dejar la bici · el inventario baja solo', ruta: '/venta', roles: TODOS },
      { label: 'Repuestos e inventario', meta: plural(d.repuestos, 'referencia', 'referencias') + ' · ' + d.bajos + ' bajo el mínimo', ruta: '/repuestos', roles: TODOS },
      { label: 'Servicios y paquetes', meta: plural(d.servicios, 'servicio', 'servicios') + ' en el catálogo', ruta: '/servicios', roles: TODOS },
      { label: 'Compras y proveedores', meta: 'Le debo ' + plata(d.debo), ruta: '/compras', roles: ['admin'] },
      { label: 'Cobros y cartera', meta: 'Me deben ' + plata(d.meDeben), ruta: '/cartera', roles: TODOS },
      { label: 'Caja y gastos', meta: 'Movimientos del día y cierre', ruta: '/caja', roles: TODOS },
      { label: 'Mecánicos', meta: plural(d.mecanicos, 'mecánico', 'mecánicos') + ' · mano de obra del mes', ruta: '/mecanicos', roles: ['admin'] },
      { label: 'Garantías', meta: 'Lo que vuelve y por qué', ruta: '/garantias', roles: TODOS },
      { label: 'Recordatorios', meta: 'Sin reclamar, sin responder, mantenimientos', ruta: '/recordatorios', roles: TODOS },
      { label: 'Reportes', meta: 'Entradas, salidas y utilidad del mes', ruta: '/reportes', roles: ['admin'] },
      { label: 'Configuración', meta: 'Taller, personas, garantía, textos de WhatsApp', ruta: '/configuracion', roles: ['admin'] },
    ];
    return lista.filter((m) => m.roles.includes(rol));
  });

  constructor() {
    ultimoRespaldo().then((u) => this.ultima.set(u));
  }

  cambiar(): void {
    this.router.navigateByUrl('/entrar');
  }

  /** Paso 1: armar el archivo (puede tardar con muchas fotos). */
  async respaldar(): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try {
      this.copia.set(await prepararRespaldo());
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo hacer la copia. Intenta otra vez.');
    } finally {
      this.ocupado.set(false);
    }
  }

  /** Paso 2: en su propio toque, para que Safari deje abrir la hoja de compartir. */
  async entregar(archivo: File): Promise<void> {
    try {
      await entregarRespaldo(archivo);
      this.copia.set(null);
      this.ultima.set(Date.now());
      this.ui.avisar('Copia lista. Guárdala en un lugar seguro.');
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo guardar la copia. Intenta otra vez.');
    }
  }

  tamano(f: File): string {
    const mb = f.size / 1024 / 1024;
    return mb < 1 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : mb.toFixed(1).replace('.', ',') + ' MB';
  }

  async restaurar(e: Event): Promise<void> {
    const campo = e.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    campo.value = '';
    if (!archivo) return;
    const ok = await this.ui.confirmar({
      titulo: '¿Restaurar la copia?',
      texto: 'Todo lo que hay ahora en este celular se reemplaza por lo que tiene la copia. Esto no se puede deshacer.',
      si: 'Sí, restaurar',
    });
    if (!ok) return;
    try {
      await restaurarRespaldo(archivo);
      this.sesion.salir();
      this.ui.avisar('Copia restaurada. Entra otra vez con tu PIN.');
      this.router.navigateByUrl('/entrar');
    } catch (err) {
      console.error(err);
      this.ui.avisar('Ese archivo no es una copia de QualityTaller.');
    }
  }
}
