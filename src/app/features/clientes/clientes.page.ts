import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { db, vivo } from '../../core/db';
import { diasEntre, inicial, mesAnio, normalizar, plata, plural, soloDigitos } from '../../core/formato';
import type { Bici, Cliente, Orden } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { abrirWhatsApp } from '../../core/whatsapp';
import { HojaComponent } from '../../shared/hoja.component';
import { CargandoComponent, ErrorComponent, VacioComponent } from '../../shared/vacio.component';

interface FichaCliente {
  cliente: Cliente;
  bicis: { bici: Bici; ultimo: string }[];
  gastado: number;
}

/** Lo que el cliente ha pagado: adelantos y cobros de las órdenes entregadas. */
function gastado(ordenes: Orden[]): number {
  return ordenes.filter((o) => o.estado === 'entregada').reduce((s, o) => s + (o.pago?.monto ?? 0) + (o.adelanto || 0), 0);
}

@Component({
  selector: 'qt-clientes',
  imports: [FormsModule, RouterLink, HojaComponent, CargandoComponent, ErrorComponent, VacioComponent],
  templateUrl: './clientes.page.html',
  styleUrl: './clientes.page.css',
})
export class ClientesPage {
  private readonly ui = inject(UiService);
  protected readonly plata = plata;
  protected readonly inicial = inicial;
  protected readonly busqueda = signal('');
  protected readonly editando = signal<Cliente | null>(null);

  protected readonly datos = vivo(
    async () => {
      const [clientes, bicis, ordenes, taller] = await Promise.all([
        db.clientes.toArray(),
        db.bicis.toArray(),
        db.ordenes.toArray(),
        db.taller.get('taller'),
      ]);
      return { clientes, bicis, ordenes, nombreTaller: taller?.nombre ?? '' };
    },
    { clientes: [] as Cliente[], bicis: [] as Bici[], ordenes: [] as Orden[], nombreTaller: '' },
  );

  protected readonly fichas = computed<FichaCliente[]>(() => {
    const { clientes, bicis, ordenes } = this.datos.valor();
    const q = normalizar(this.busqueda());
    const dig = soloDigitos(q);
    return clientes
      .filter(
        (c) =>
          !q ||
          normalizar(c.nombre).includes(q) ||
          (dig.length >= 3 && (soloDigitos(c.celular).includes(dig) || soloDigitos(c.cedula ?? '').includes(dig))),
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((c) => {
        const suyas = ordenes.filter((o) => o.clienteId === c.id);
        return {
          cliente: c,
          gastado: gastado(suyas),
          bicis: bicis
            .filter((b) => b.clienteId === c.id)
            .map((b) => {
              const ult = suyas.filter((o) => o.biciId === b.id).sort((x, y) => y.recibida - x.recibida)[0];
              return { bici: b, ultimo: ult ? 'último ' + mesAnio(ult.recibida) : 'sin órdenes' };
            }),
        };
      });
  });

  protected readonly conteo = computed(() => plural(this.fichas().length, 'cliente', 'clientes'));

  meta(c: Cliente): string {
    return c.celular + ' · cliente desde ' + mesAnio(c.desde);
  }

  debeTexto(c: Cliente): string {
    if (c.debe <= 0) return 'Al día';
    const d = c.debeDesde ? diasEntre(c.debeDesde) : 0;
    return 'Debe ' + plata(c.debe) + (d > 0 ? ' · hace ' + plural(d, 'día', 'días') : '');
  }

  escribir(c: Cliente): void {
    abrirWhatsApp(c.celular, 'Hola ' + c.nombre + ', le escribimos de ' + this.datos.valor().nombreTaller + '.');
  }

  editar(c: Cliente): void {
    this.editando.set({ ...c });
  }

  cambiar<K extends keyof Cliente>(campo: K, valor: Cliente[K]): void {
    this.editando.update((c) => (c ? { ...c, [campo]: valor } : c));
  }

  async guardar(): Promise<void> {
    const c = this.editando();
    if (!c) return;
    if (!c.nombre.trim() || soloDigitos(c.celular).length < 7) {
      this.ui.avisar('El nombre y un celular válido son obligatorios');
      return;
    }
    try {
      await db.clientes.put({
        ...c,
        nombre: c.nombre.trim(),
        celular: c.celular.trim(),
        cedula: c.cedula?.trim() || undefined,
        correo: c.correo?.trim() || undefined,
      });
      this.editando.set(null);
      this.ui.avisar('Datos de ' + c.nombre.trim() + ' guardados');
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo guardar. Intenta otra vez.');
    }
  }
}
