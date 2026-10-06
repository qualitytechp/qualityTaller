import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { db, vivo } from '../../core/db';
import { EN_TALLER } from '../../core/estados';
import { cuando, inicial, isoLocal, plata, tono } from '../../core/formato';
import { TIPOS_BICI, type Bici } from '../../core/models';
import { queSeLeHace, totalOrden } from '../../core/ordenes.service';
import { UiService } from '../../core/ui.service';
import { abrirWhatsApp } from '../../core/whatsapp';
import { CamaraComponent } from '../../shared/camara.component';
import { EstadoComponent } from '../../shared/estado.component';
import { FotoComponent } from '../../shared/foto.component';
import { HojaComponent } from '../../shared/hoja.component';
import { CargandoComponent, VacioComponent } from '../../shared/vacio.component';

/** "diciembre de 2026" a partir de "2026-12-01". */
function mesDe(iso?: string): string {
  if (!iso) return 'Sin fecha';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d || 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

@Component({
  selector: 'qt-bici',
  imports: [FormsModule, RouterLink, CamaraComponent, EstadoComponent, FotoComponent, HojaComponent, CargandoComponent, VacioComponent],
  templateUrl: './bici.page.html',
  styleUrl: './bici.page.css',
})
export class BiciPage {
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly plata = plata;
  protected readonly cuando = cuando;
  protected readonly tipos = TIPOS_BICI;
  protected readonly editando = signal<Bici | null>(null);

  protected readonly datos = vivo(async () => {
    const bici = await db.bicis.get(this.id);
    if (!bici) return null;
    const [cliente, ordenes, taller] = await Promise.all([
      db.clientes.get(bici.clienteId),
      db.ordenes.where('biciId').equals(this.id).toArray(),
      db.taller.get('taller'),
    ]);
    ordenes.sort((a, b) => b.recibida - a.recibida);
    return { bici, cliente, ordenes, taller };
  }, null);

  protected readonly titulo = computed(() => {
    const b = this.datos.valor()?.bici;
    return [b?.marca, b?.modelo].filter(Boolean).join(' ');
  });
  protected readonly meta = computed(() => {
    const d = this.datos.valor();
    if (!d) return '';
    const b = d.bici;
    return [b.tipo, b.color, b.talla ? 'talla ' + b.talla : '', d.cliente?.nombre].filter(Boolean).join(' · ');
  });
  protected readonly tono = computed(() => tono(this.id));
  protected readonly inicial = computed(() => inicial(this.datos.valor()?.bici.marca));
  protected readonly proximo = computed(() => mesDe(this.datos.valor()?.bici.proxMantenimiento));
  protected readonly leToca = computed(() => {
    const p = this.datos.valor()?.bici.proxMantenimiento;
    return !!p && p <= isoLocal(Date.now());
  });
  /** Si la bici sigue en el taller, no se recibe dos veces. */
  protected readonly enTaller = computed(() => this.datos.valor()?.ordenes.find((o) => EN_TALLER.includes(o.estado)));

  protected readonly historial = computed(() =>
    (this.datos.valor()?.ordenes ?? []).map((o) => ({ orden: o, trabajo: queSeLeHace(o), total: plata(totalOrden(o)) })),
  );

  componente(v: string): string {
    return v?.trim() || 'Por registrar';
  }

  recordar(): void {
    const d = this.datos.valor();
    if (!d) return;
    abrirWhatsApp(
      d.cliente?.celular,
      'Hola ' + (d.cliente?.nombre ?? '') + ', a su ' + this.titulo() + ' le toca mantenimiento en ' + this.proximo() + '. ¿Le agendamos? — ' + (d.taller?.nombre ?? ''),
    );
  }

  recibir(): void {
    const activa = this.enTaller();
    if (activa) {
      this.router.navigate(['/orden', activa.numero]);
      return;
    }
    this.router.navigate(['/recibir', this.id]);
  }

  async cambiarFoto(fotoId: string): Promise<void> {
    const b = this.datos.valor()?.bici;
    if (!b) return;
    const vieja = b.fotoId;
    await db.bicis.update(b.id, { fotoId });
    // La foto vieja se borra solo si no es también una foto de alguna orden.
    if (vieja && !(this.datos.valor()?.ordenes ?? []).some((o) => o.fotos.some((f) => f.id === vieja))) await db.fotos.delete(vieja);
    this.ui.avisar('Foto de la bici actualizada');
  }

  editar(): void {
    const b = this.datos.valor()?.bici;
    if (b) this.editando.set({ ...b });
  }

  cambiar<K extends keyof Bici>(campo: K, valor: Bici[K]): void {
    this.editando.update((b) => (b ? { ...b, [campo]: valor } : b));
  }

  async guardar(): Promise<void> {
    const b = this.editando();
    if (!b) return;
    if (!b.marca.trim() || !b.serie.trim()) {
      this.ui.avisar('La marca y la serie son obligatorias');
      return;
    }
    try {
      await db.bicis.put({ ...b, marca: b.marca.trim(), modelo: b.modelo.trim(), serie: b.serie.trim().toUpperCase() });
      this.editando.set(null);
      this.ui.avisar('Hoja de vida guardada');
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo guardar. Intenta otra vez.');
    }
  }
}
