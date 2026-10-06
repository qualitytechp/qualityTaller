import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { db, guardarKV, leerKV, vivo } from '../../core/db';
import { inicial, isoLocal, deFechaYHora, normalizar, soloDigitos, tono } from '../../core/formato';
import { ACCESORIOS, MEDIOS_PAGO, TIPOS_BICI, type Bici, type Cliente, type Persona } from '../../core/models';
import { BorradorRecibir, CLAVE_BORRADOR, OrdenesService } from '../../core/ordenes.service';
import { UiService } from '../../core/ui.service';
import { CamaraComponent } from '../../shared/camara.component';
import { CampoPlataComponent } from '../../shared/campo-plata.component';
import { FotoComponent } from '../../shared/foto.component';
import { PasosComponent } from '../../shared/pasos.component';

const TITULOS = ['¿De quién es?', '¿Cuál bici?', '¿Qué le pasa?', '¿Para cuándo y quién?'];
const AYUDAS = [
  'Busca al cliente o créalo con lo mínimo: nombre y celular.',
  'Toca la bici que trae. Si es nueva, regístrala con la serie.',
  'Lo que dice el cliente, tal cual, y las fotos de cómo llegó.',
  'Fecha prometida, prioridad, mecánico y adelanto si deja.',
];

function borradorLimpio(): BorradorRecibir {
  return {
    paso: 1,
    clienteId: null,
    nuevoCliente: false,
    nombre: '',
    celular: '',
    cedula: '',
    correo: '',
    biciId: null,
    nuevaBici: false,
    marca: '',
    modelo: '',
    tipo: 'Montaña',
    color: '',
    talla: '',
    serie: '',
    fotoBiciId: null,
    reportado: '',
    fotos: [],
    accesorios: [],
    otroAccesorio: '',
    golpes: '',
    fecha: isoLocal(Date.now() + 864e5),
    hora: '17:00',
    prioridad: 'Normal',
    mecanicoId: null,
    adelanto: 0,
    medioAdelanto: 'Efectivo',
  };
}

/** ¿Vale la pena guardar o retomar este borrador? */
function tieneAlgo(b: BorradorRecibir): boolean {
  return !!(b.clienteId || b.nombre.trim() || b.celular.trim() || b.reportado.trim() || b.fotos.length);
}

@Component({
  selector: 'qt-recibir',
  imports: [FormsModule, PasosComponent, CamaraComponent, FotoComponent, CampoPlataComponent],
  templateUrl: './recibir.page.html',
  styleUrl: './recibir.page.css',
})
export class RecibirPage implements OnInit {
  /** Desde la hoja de vida de una bici: "Recibirla otra vez" arranca en el paso 3. */
  readonly biciId = input<string>();

  private readonly ordenes = inject(OrdenesService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);

  protected readonly titulos = TITULOS;
  protected readonly ayudas = AYUDAS;
  protected readonly tipos = TIPOS_BICI;
  protected readonly accesoriosLista = ACCESORIOS;
  protected readonly medios = MEDIOS_PAGO;
  protected readonly inicial = inicial;
  protected readonly tono = tono;

  protected readonly b = signal<BorradorRecibir>(borradorLimpio());
  protected readonly busqueda = signal('');
  protected readonly retomado = signal(false);
  protected readonly creando = signal(false);
  private listo = false;
  private guardado?: ReturnType<typeof setTimeout>;

  private readonly clientes = vivo(() => db.clientes.toArray(), [] as Cliente[]);
  private readonly bicis = vivo(() => db.bicis.toArray(), [] as Bici[]);
  private readonly recientes = vivo(
    async () => (await db.ordenes.orderBy('recibida').reverse().limit(20).toArray()).map((o) => o.clienteId),
    [] as string[],
  );
  private readonly personas = vivo(() => db.personas.filter((p) => p.activo).toArray(), [] as Persona[]);

  protected readonly paso = computed(() => this.b().paso);

  /** Sin buscar: los últimos clientes atendidos. Buscando: por nombre, cédula o celular. */
  protected readonly clientesVistos = computed(() => {
    const q = normalizar(this.busqueda());
    const todos = this.clientes.valor();
    if (!q) {
      const ids = [...new Set(this.recientes.valor())];
      const porId = new Map(todos.map((c) => [c.id, c]));
      const l = ids.map((id) => porId.get(id)).filter((c): c is Cliente => !!c);
      return (l.length ? l : [...todos].sort((a, c) => c.desde - a.desde)).slice(0, 3);
    }
    const dig = soloDigitos(q);
    return todos
      .filter(
        (c) =>
          normalizar(c.nombre).includes(q) ||
          (dig.length >= 3 && (soloDigitos(c.celular).includes(dig) || soloDigitos(c.cedula ?? '').includes(dig))),
      )
      .slice(0, 6);
  });

  protected readonly cliente = computed(() => this.clientes.valor().find((c) => c.id === this.b().clienteId));

  /** Si el cliente nuevo tiene un celular que ya existe, probablemente ya está registrado. */
  protected readonly celularRepetido = computed(() => {
    const b = this.b();
    const dig = soloDigitos(b.celular);
    if (b.clienteId || dig.length < 7) return undefined;
    return this.clientes.valor().find((c) => soloDigitos(c.celular) === dig);
  });

  protected readonly bicisCliente = computed(() => this.bicis.valor().filter((x) => x.clienteId === this.b().clienteId));
  protected readonly formBici = computed(() => this.b().nuevaBici || !this.bicisCliente().length);

  /** La serie es lo que identifica la bici: si ya existe, se avisa. */
  protected readonly serieRepetida = computed(() => {
    const b = this.b();
    const s = normalizar(b.serie).replace(/[\s-]/g, '');
    if (b.biciId || s.length < 4) return null;
    const bici = this.bicis.valor().find((x) => normalizar(x.serie).replace(/[\s-]/g, '') === s);
    if (!bici) return null;
    const dueno = this.clientes.valor().find((c) => c.id === bici.clienteId);
    return { bici, dueno, esDelCliente: bici.clienteId === b.clienteId };
  });

  /** Se puede asignar a los mecánicos y al administrador (que en talleres pequeños también repara). */
  protected readonly mecanicos = computed(() =>
    this.personas
      .valor()
      .filter((p) => p.rol === 'mecanico' || p.rol === 'admin')
      .sort((a, c) => (a.rol === c.rol ? a.nombre.localeCompare(c.nombre) : a.rol === 'mecanico' ? -1 : 1)),
  );

  protected readonly textoFotos = computed(() => {
    const n = this.b().fotos.length;
    if (!n) return { t: 'Faltan las fotos', c: 'var(--red-600)' };
    if (n < 3) return { t: n + ' de 3 recomendadas', c: 'var(--warning-700)' };
    return { t: n + ' fotos', c: 'var(--success-700)' };
  });

  protected readonly falta = computed(() => {
    const b = this.b();
    switch (b.paso) {
      case 1:
        if (b.clienteId) return '';
        if (!b.nombre.trim() || !b.celular.trim()) return 'Elige un cliente o escribe nombre y celular';
        if (soloDigitos(b.celular).length < 7) return 'Revisa el celular: le faltan números';
        return '';
      case 2:
        if (b.biciId) return '';
        return b.marca.trim() && b.serie.trim() ? '' : 'Elige una bici o registra marca y número de serie';
      case 3:
        if (!b.reportado.trim()) return 'Escribe lo que dice el cliente';
        return b.fotos.length ? '' : 'Toma al menos una foto de cómo llegó la bici';
      default:
        if (!b.fecha) return 'Pon el día prometido';
        return deFechaYHora(b.fecha, b.hora) < Date.now() ? 'La fecha prometida ya pasó' : '';
    }
  });

  constructor() {
    // El borrador se guarda solo mientras se escribe: si se cae la señal o se cierra la app, no se pierde.
    effect(() => {
      const b = this.b();
      if (!this.listo) return;
      clearTimeout(this.guardado);
      this.guardado = setTimeout(() => {
        if (tieneAlgo(b)) guardarKV(CLAVE_BORRADOR, b);
      }, 400);
    });
  }

  async ngOnInit(): Promise<void> {
    const biciId = this.biciId();
    if (biciId) {
      const bici = await db.bicis.get(biciId);
      if (bici) this.b.set({ ...borradorLimpio(), clienteId: bici.clienteId, biciId: bici.id, paso: 3 });
    } else {
      const guardado = await leerKV<BorradorRecibir>(CLAVE_BORRADOR);
      if (guardado && tieneAlgo(guardado)) {
        this.b.set({ ...borradorLimpio(), ...guardado });
        this.retomado.set(true);
      }
    }
    this.listo = true;
  }

  protected set<K extends keyof BorradorRecibir>(campo: K, valor: BorradorRecibir[K]): void {
    this.b.update((b) => ({ ...b, [campo]: valor }));
  }

  elegirCliente(c: Cliente): void {
    this.b.update((b) => ({ ...b, clienteId: c.id, nuevoCliente: false, biciId: b.clienteId === c.id ? b.biciId : null }));
  }

  alternarNuevoCliente(): void {
    this.b.update((b) => ({ ...b, nuevoCliente: !b.nuevoCliente, clienteId: null, biciId: null }));
  }

  elegirBici(x: Bici): void {
    this.b.update((b) => ({ ...b, biciId: x.id, nuevaBici: false }));
  }

  alternarNuevaBici(): void {
    this.b.update((b) => ({ ...b, nuevaBici: !b.nuevaBici, biciId: null }));
  }

  usarBiciExistente(x: Bici): void {
    this.b.update((b) => ({ ...b, clienteId: x.clienteId, biciId: x.id, nuevaBici: false, nuevoCliente: false }));
  }

  alternarAccesorio(a: string): void {
    this.b.update((b) => ({
      ...b,
      accesorios: b.accesorios.includes(a) ? b.accesorios.filter((x) => x !== a) : [...b.accesorios, a],
    }));
  }

  agregarFoto(id: string): void {
    this.b.update((b) => ({ ...b, fotos: [...b.fotos, id] }));
  }

  async quitarFoto(id: string): Promise<void> {
    this.b.update((b) => ({ ...b, fotos: b.fotos.filter((f) => f !== id) }));
    await db.fotos.delete(id);
  }

  async empezarDeCero(): Promise<void> {
    const b = this.b();
    await db.fotos.bulkDelete([...b.fotos, ...(b.fotoBiciId ? [b.fotoBiciId] : [])]);
    await db.kv.delete(CLAVE_BORRADOR);
    this.b.set(borradorLimpio());
    this.busqueda.set('');
    this.retomado.set(false);
  }

  atras(): void {
    if (this.paso() === 1) {
      this.router.navigateByUrl('/');
      return;
    }
    this.set('paso', this.paso() - 1);
    window.scrollTo(0, 0);
  }

  async siguiente(): Promise<void> {
    const falta = this.falta();
    if (falta) {
      this.ui.avisar(falta);
      return;
    }
    this.retomado.set(false);
    if (this.paso() < 4) {
      this.set('paso', this.paso() + 1);
      this.busqueda.set('');
      window.scrollTo(0, 0);
      return;
    }
    if (this.creando()) return;
    this.creando.set(true);
    clearTimeout(this.guardado);
    this.listo = false;
    try {
      const numero = await this.ordenes.crearDesdeBorrador(this.b());
      this.router.navigate(['/orden-creada', numero], { replaceUrl: true });
    } catch (e) {
      console.error(e);
      this.listo = true;
      this.creando.set(false);
      this.ui.avisar('No se pudo crear la orden. Lo escrito sigue guardado: intenta otra vez.');
    }
  }
}
