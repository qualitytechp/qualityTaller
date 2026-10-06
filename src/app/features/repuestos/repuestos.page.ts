import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { db, nuevoId, vivo } from '../../core/db';
import { normalizar, plata, plural } from '../../core/formato';
import type { Proveedor, Repuesto } from '../../core/models';
import { SesionService } from '../../core/sesion.service';
import { UiService } from '../../core/ui.service';
import { abrirWhatsApp } from '../../core/whatsapp';
import { CampoPlataComponent } from '../../shared/campo-plata.component';
import { HojaComponent } from '../../shared/hoja.component';
import { CargandoComponent, ErrorComponent, VacioComponent } from '../../shared/vacio.component';

type Filtro = 'todos' | 'bajos' | 'agotados';

const FILTROS: { k: Filtro; label: string }[] = [
  { k: 'todos', label: 'Todos' },
  { k: 'bajos', label: 'Bajo el mínimo' },
  { k: 'agotados', label: 'Agotados' },
];

function vacio(): Repuesto {
  return { id: '', nombre: '', ref: '', marca: '', costo: 0, precio: 0, cantidad: 0, minimo: 2 };
}

@Component({
  selector: 'qt-repuestos',
  imports: [FormsModule, CampoPlataComponent, HojaComponent, CargandoComponent, ErrorComponent, VacioComponent],
  templateUrl: './repuestos.page.html',
  styleUrl: './repuestos.page.css',
})
export class RepuestosPage {
  protected readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly ui = inject(UiService);
  protected readonly sesion = inject(SesionService);

  protected readonly plata = plata;
  protected readonly filtros = FILTROS;
  protected readonly filtro = signal<Filtro>((this.ruta.snapshot.queryParamMap.get('filtro') as Filtro) || 'todos');
  protected readonly busqueda = signal('');
  protected readonly editando = signal<Repuesto | null>(null);

  protected readonly datos = vivo(
    async () => {
      const [repuestos, proveedores, taller] = await Promise.all([db.repuestos.toArray(), db.proveedores.toArray(), db.taller.get('taller')]);
      return { repuestos, proveedores, nombreTaller: taller?.nombre ?? '' };
    },
    { repuestos: [] as Repuesto[], proveedores: [] as Proveedor[], nombreTaller: '' },
  );

  protected readonly lista = computed(() => {
    const q = normalizar(this.busqueda());
    const f = this.filtro();
    return this.datos
      .valor()
      .repuestos.filter((r) => !q || normalizar(r.nombre + ' ' + r.ref + ' ' + r.marca).includes(q))
      .filter((r) => (f === 'bajos' ? r.cantidad <= r.minimo : f === 'agotados' ? r.cantidad === 0 : true))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  protected readonly conteo = computed(() => plural(this.lista().length, 'referencia', 'referencias'));
  /** El mecánico ve existencias, no plata. */
  protected readonly puedeEditar = computed(() => this.sesion.vePlata());

  barra(r: Repuesto): string {
    return r.cantidad === 0 ? 'var(--red-700)' : r.cantidad <= r.minimo ? 'var(--warning-500)' : 'var(--success-500)';
  }

  colorCantidad(r: Repuesto): string {
    return r.cantidad === 0 ? 'var(--red-700)' : r.cantidad <= r.minimo ? 'var(--warning-700)' : 'var(--gray-900)';
  }

  proveedor(r: Repuesto): Proveedor | undefined {
    return this.datos.valor().proveedores.find((p) => p.id === r.proveedorId);
  }

  elegirFiltro(f: Filtro): void {
    this.filtro.set(f);
    this.router.navigate([], { relativeTo: this.ruta, queryParams: { filtro: f === 'todos' ? null : f }, replaceUrl: true });
  }

  pedir(r: Repuesto): void {
    const p = this.proveedor(r);
    const cuantos = Math.max(r.minimo * 2 - r.cantidad, 2);
    abrirWhatsApp(
      p?.celular,
      'Buenas' + (p ? ' ' + p.nombre : '') + ', de ' + this.datos.valor().nombreTaller + '. Necesito ' + r.nombre + (r.ref ? ' (' + r.ref + ')' : '') + ', ' + cuantos + ' unidades. ¿Tiene disponible y a cómo?',
    );
  }

  nuevo(): void {
    this.editando.set(vacio());
  }

  editar(r: Repuesto): void {
    if (this.puedeEditar()) this.editando.set({ ...r });
  }

  cambiar<K extends keyof Repuesto>(campo: K, valor: Repuesto[K]): void {
    this.editando.update((r) => (r ? { ...r, [campo]: valor } : r));
  }

  cambiarNumero(campo: 'cantidad' | 'minimo', texto: string): void {
    this.cambiar(campo, Math.max(0, parseInt(String(texto).replace(/\D/g, ''), 10) || 0));
  }

  async guardar(): Promise<void> {
    const r = this.editando();
    if (!r) return;
    if (!r.nombre.trim() || r.precio <= 0) {
      this.ui.avisar('El nombre y el precio de venta son obligatorios');
      return;
    }
    const nuevo = !r.id;
    try {
      await db.repuestos.put({ ...r, ultimaEntrada: r.id ? r.ultimaEntrada : Date.now(), id: r.id || nuevoId(), nombre: r.nombre.trim(), ref: r.ref.trim().toUpperCase(), marca: r.marca.trim() });
      this.editando.set(null);
      this.ui.avisar(nuevo ? r.nombre.trim() + ' agregado al inventario' : 'Cambios guardados');
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo guardar. Intenta otra vez.');
    }
  }
}
