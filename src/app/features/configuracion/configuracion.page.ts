import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { db, vivo } from '../../core/db';
import { inicial } from '../../core/formato';
import type { Persona, Rol, Taller } from '../../core/models';
import { ROL_LABEL, ROL_VE, SesionService, resumenPin } from '../../core/sesion.service';
import { UiService } from '../../core/ui.service';
import { CamaraComponent } from '../../shared/camara.component';
import { FotoComponent } from '../../shared/foto.component';
import { HojaComponent } from '../../shared/hoja.component';
import { CargandoComponent } from '../../shared/vacio.component';

const DIAS = [15, 30, 60, 90];
const ROLES: Rol[] = ['admin', 'mostrador', 'mecanico'];

interface PersonaEditable {
  id: string;
  nombre: string;
  rol: Rol;
  comision: number;
  activo: boolean;
  pin: string;
}

@Component({
  selector: 'qt-configuracion',
  imports: [FormsModule, CamaraComponent, FotoComponent, HojaComponent, CargandoComponent],
  templateUrl: './configuracion.page.html',
  styleUrl: './configuracion.page.css',
})
export class ConfiguracionPage {
  private readonly ui = inject(UiService);
  protected readonly sesion = inject(SesionService);

  protected readonly dias = DIAS;
  protected readonly roles = ROLES;
  protected readonly rolLabel = ROL_LABEL;
  protected readonly rolVe = ROL_VE;
  protected readonly inicial = inicial;
  protected readonly variables = '{cliente}, {bici}, {orden}, {fecha}, {saldo}, {taller}';

  /** Copia del taller que se edita; se guarda con el botón de abajo. */
  protected readonly taller = signal<Taller | null>(null);
  protected readonly editando = signal<PersonaEditable | null>(null);

  protected readonly datos = vivo(
    async () => ({ taller: await db.taller.get('taller'), personas: await db.personas.toArray() }),
    { taller: undefined as Taller | undefined, personas: [] as Persona[] },
  );

  protected readonly personas = computed(() =>
    [...this.datos.valor().personas].sort((a, b) => Number(b.activo) - Number(a.activo) || ROLES.indexOf(a.rol) - ROLES.indexOf(b.rol) || a.nombre.localeCompare(b.nombre)),
  );

  protected readonly cambiado = computed(() => {
    const a = this.taller();
    const b = this.datos.valor().taller;
    return !!a && !!b && JSON.stringify(a) !== JSON.stringify(b);
  });

  constructor() {
    // La primera vez se copia el taller para editarlo.
    effect(() => {
      const t = this.datos.valor().taller;
      if (t && !untracked(this.taller)) this.taller.set({ ...t });
    });
  }

  cambiar(c: Partial<Taller>): void {
    this.taller.update((t) => (t ? { ...t, ...c } : t));
  }

  async logo(id: string): Promise<void> {
    const viejo = this.datos.valor().taller?.logoId;
    await db.taller.update('taller', { logoId: id });
    this.cambiar({ logoId: id });
    if (viejo) await db.fotos.delete(viejo);
    this.ui.avisar('Logo guardado');
  }

  async guardar(): Promise<void> {
    const t = this.taller();
    if (!t) return;
    if (!t.nombre.trim()) {
      this.ui.avisar('El taller necesita un nombre');
      return;
    }
    await db.taller.put({ ...t, nombre: t.nombre.trim() });
    this.ui.avisar('Configuración guardada');
  }

  // ───────── Personas ─────────

  nueva(): void {
    this.editando.set({ id: '', nombre: '', rol: 'mecanico', comision: 15, activo: true, pin: '' });
  }

  editar(p: Persona): void {
    this.editando.set({ id: p.id, nombre: p.nombre, rol: p.rol, comision: p.comision, activo: p.activo, pin: '' });
  }

  cambiarPersona(c: Partial<PersonaEditable>): void {
    this.editando.update((p) => (p ? { ...p, ...c } : p));
  }

  cambiarComision(texto: string): void {
    this.cambiarPersona({ comision: Math.min(100, parseInt(String(texto).replace(/\D/g, ''), 10) || 0) });
  }

  /** No se puede quedar el taller sin ningún administrador activo. */
  private quedaAdmin(p: PersonaEditable): boolean {
    return this.datos.valor().personas.some((x) => x.id !== p.id && x.rol === 'admin' && x.activo) || (p.rol === 'admin' && p.activo);
  }

  async guardarPersona(): Promise<void> {
    const p = this.editando();
    if (!p) return;
    if (!p.nombre.trim()) {
      this.ui.avisar('Escribe el nombre');
      return;
    }
    if ((!p.id || p.pin) && !/^\d{4}$/.test(p.pin)) {
      this.ui.avisar('El PIN son 4 números');
      return;
    }
    if (!this.quedaAdmin(p)) {
      this.ui.avisar('Tiene que quedar al menos un administrador');
      return;
    }
    if (p.id === this.sesion.persona()?.id && !p.activo) {
      this.ui.avisar('No te puedes desactivar a ti mismo');
      return;
    }
    try {
      if (!p.id) {
        await this.sesion.crearPersona({ nombre: p.nombre, rol: p.rol, pin: p.pin, comision: p.comision });
      } else {
        const actual = await db.personas.get(p.id);
        if (!actual) return;
        await db.personas.put({
          ...actual,
          nombre: p.nombre.trim(),
          rol: p.rol,
          comision: p.rol === 'mecanico' ? p.comision : actual.comision,
          activo: p.activo,
          pinHash: p.pin ? await resumenPin(p.pin, p.id) : actual.pinHash,
        });
        if (p.id === this.sesion.persona()?.id) await this.sesion.recargar();
      }
      this.editando.set(null);
      this.ui.avisar(p.id ? 'Cambios guardados' : p.nombre.trim() + ' ya puede entrar con su PIN');
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo guardar. Intenta otra vez.');
    }
  }
}
