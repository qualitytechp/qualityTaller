import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { db, vivo } from '../../core/db';
import { cuando, plural } from '../../core/formato';
import type { Bici, Orden, Persona, Tarea } from '../../core/models';
import { OrdenesService, estaTarde, tareasDe } from '../../core/ordenes.service';
import { SesionService } from '../../core/sesion.service';
import { UiService } from '../../core/ui.service';
import { CamaraComponent } from '../../shared/camara.component';
import { EstadoComponent } from '../../shared/estado.component';
import { HojaComponent } from '../../shared/hoja.component';
import { CargandoComponent, ErrorComponent, VacioComponent } from '../../shared/vacio.component';

interface Trabajo {
  orden: Orden;
  bici: string;
  trabajo: string;
  prometida: string;
  tarde: boolean;
  tareas: Tarea[];
  listo: boolean;
  mecanico?: string;
}

/** Estados en los que la bici está en manos del mecánico. */
const SUYAS: Orden['estado'][] = ['recibida', 'diagnostico', 'aprobada', 'reparacion', 'repuesto'];

@Component({
  selector: 'qt-mis-trabajos',
  imports: [FormsModule, RouterLink, CamaraComponent, EstadoComponent, HojaComponent, CargandoComponent, ErrorComponent, VacioComponent],
  templateUrl: './mis-trabajos.page.html',
  styleUrl: './mis-trabajos.page.css',
})
export class MisTrabajosPage {
  private readonly router = inject(Router);
  private readonly ordenes = inject(OrdenesService);
  private readonly ui = inject(UiService);
  protected readonly sesion = inject(SesionService);

  /** El administrador puede ver los trabajos de cualquiera. */
  /** Desde Mecánicos llega con ?de=<persona>. */
  protected readonly de = signal<string>(
    this.sesion.esAdmin() ? (inject(ActivatedRoute).snapshot.queryParamMap.get('de') ?? '') : (this.sesion.persona()?.id ?? ''),
  );
  protected readonly pidiendo = signal<Orden | null>(null);
  protected readonly queFalta = signal('');

  protected readonly datos = vivo(
    async () => {
      const [ordenes, bicis, personas] = await Promise.all([
        db.ordenes.where('estado').anyOf(SUYAS).toArray(),
        db.bicis.toArray(),
        db.personas.filter((p) => p.activo && (p.rol === 'mecanico' || p.rol === 'admin')).toArray(),
      ]);
      return { ordenes, bicis: new Map(bicis.map((b) => [b.id, b] as [string, Bici])), personas };
    },
    { ordenes: [] as Orden[], bicis: new Map<string, Bici>(), personas: [] as Persona[] },
  );

  private armar(o: Orden, ahora: number): Trabajo {
    const b = this.datos.valor().bicis.get(o.biciId);
    const tareas = tareasDe(o);
    return {
      orden: o,
      bici: [b?.marca, b?.modelo].filter(Boolean).join(' '),
      trabajo: o.diagnostico || o.reportado,
      prometida: (estaTarde(o, ahora) ? 'Se pasó: ' : 'Prometida: ') + cuando(o.prometida).toLowerCase(),
      tarde: estaTarde(o, ahora),
      tareas,
      listo: tareas.every((t) => t.hecha),
      mecanico: this.datos.valor().personas.find((p) => p.id === o.mecanicoId)?.nombre,
    };
  }

  /** Urgentes primero; después, lo que se prometió antes. */
  private ordenar(l: Orden[]): Orden[] {
    return [...l].sort((a, b) => (a.prioridad === b.prioridad ? a.prometida - b.prometida : a.prioridad === 'Urgente' ? -1 : 1));
  }

  /** Sin escoger a nadie, el administrador ve al primer mecánico. */
  protected readonly deEfectivo = computed(
    () => this.de() || this.datos.valor().personas.find((p) => p.rol === 'mecanico')?.id || (this.sesion.persona()?.id ?? ''),
  );

  protected readonly trabajos = computed(() => {
    const ahora = Date.now();
    const de = this.deEfectivo();
    return this.ordenar(this.datos.valor().ordenes.filter((o) => o.mecanicoId === de)).map((o) => this.armar(o, ahora));
  });

  protected readonly sinAsignar = computed(() => {
    const ahora = Date.now();
    return this.ordenar(this.datos.valor().ordenes.filter((o) => !o.mecanicoId)).map((o) => this.armar(o, ahora));
  });

  protected readonly resumen = computed(() => {
    const n = this.trabajos().length;
    return n ? plural(n, 'bici asignada', 'bicis asignadas') + ' · las urgentes primero' : '';
  });

  protected readonly esMio = computed(() => this.deEfectivo() === this.sesion.persona()?.id);

  async marcar(t: Trabajo, i: number): Promise<void> {
    const tareas = t.tareas.map((x, j) => (j === i ? { ...x, hecha: !x.hecha } : x));
    try {
      await this.ordenes.guardarTareas(t.orden.numero, tareas);
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo guardar el avance');
    }
  }

  private async correr(fn: () => Promise<unknown>, aviso: string): Promise<void> {
    try {
      await fn();
      this.ui.avisar(aviso);
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo guardar. Intenta otra vez.');
    }
  }

  principal(t: Trabajo): { label: string; activo: boolean } {
    switch (t.orden.estado) {
      case 'recibida':
        return { label: 'Empezar el diagnóstico', activo: true };
      case 'diagnostico':
        return { label: t.orden.diagnostico ? 'Corregir el diagnóstico' : 'Escribir el diagnóstico', activo: true };
      case 'aprobada':
        return { label: 'Empezar la reparación', activo: true };
      case 'repuesto':
        return { label: 'Ya llegó el repuesto, seguir', activo: true };
      default:
        return t.listo ? { label: 'Marcar lista para entrega', activo: true } : { label: 'Terminar (falta marcar el avance)', activo: false };
    }
  }

  hacer(t: Trabajo): void {
    const n = t.orden.numero;
    switch (t.orden.estado) {
      case 'recibida':
        this.correr(() => this.ordenes.cambiarEstado(n, 'diagnostico', 'Empezó el diagnóstico'), 'Diagnóstico empezado');
        return;
      case 'diagnostico':
        this.router.navigate(['/orden', n], { queryParams: { tab: 'diagnostico' } });
        return;
      case 'aprobada':
        this.correr(() => this.ordenes.cambiarEstado(n, 'reparacion', 'Empezó la reparación'), 'Reparación empezada');
        return;
      case 'repuesto':
        this.correr(() => this.ordenes.cambiarEstado(n, 'reparacion', 'Llegó el repuesto, sigue la reparación'), 'A seguir con ' + n);
        return;
      default:
        if (!t.listo) {
          this.ui.avisar('Marca primero todo el avance');
          return;
        }
        this.correr(() => this.ordenes.cambiarEstado(n, 'lista', 'Marcó la bici lista para entrega'), n + ' lista para entrega');
    }
  }

  pedir(t: Trabajo): void {
    this.queFalta.set('');
    this.pidiendo.set(t.orden);
  }

  enviarPedido(): void {
    const o = this.pidiendo();
    const que = this.queFalta().trim();
    if (!o || !que) {
      this.ui.avisar('Escribe qué repuesto hace falta');
      return;
    }
    this.pidiendo.set(null);
    this.correr(() => this.ordenes.pedirRepuesto(o.numero, que), 'Pedido avisado al mostrador');
  }

  foto(t: Trabajo, id: string): void {
    this.correr(() => this.ordenes.agregarFoto(t.orden.numero, id), 'Foto subida a ' + t.orden.numero);
  }

  tomar(t: Trabajo): void {
    this.correr(() => this.ordenes.tomar(t.orden.numero), t.orden.numero + ' ahora es tuya');
  }
}
