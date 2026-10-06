import { Injectable, signal } from '@angular/core';

export interface Confirmacion {
  titulo: string;
  texto: string;
  si: string;
  /** Verde para acciones buenas (cobrar), rojo por defecto. */
  tono?: 'rojo' | 'verde';
}

interface ConfirmacionAbierta extends Confirmacion {
  responder: (ok: boolean) => void;
}

/** Avisos cortos abajo y confirmaciones en modal centrado. */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly aviso = signal('');
  readonly confirmacion = signal<ConfirmacionAbierta | null>(null);
  /** Título dinámico de la cabecera (ej. el número de la orden). */
  readonly titulo = signal<string | null>(null);

  private temporizador?: ReturnType<typeof setTimeout>;

  avisar(texto: string): void {
    this.aviso.set(texto);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.aviso.set(''), 2600);
  }

  /** Se confirma antes de cobrar, borrar, rechazar o cerrar la caja. */
  confirmar(c: Confirmacion): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmacion.set({
        ...c,
        responder: (ok) => {
          this.confirmacion.set(null);
          resolve(ok);
        },
      });
    });
  }
}
