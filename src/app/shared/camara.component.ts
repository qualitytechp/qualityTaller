import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { guardarFoto } from '../core/fotos';
import { UiService } from '../core/ui.service';

/**
 * Botón que abre la cámara de un toque. Guarda la foto comprimida en el celular
 * y entrega su id. El contenido del botón lo pone quien lo usa.
 */
@Component({
  selector: 'qt-camara',
  template: `
    <button type="button" [class]="clase()" [disabled]="procesando()" (click)="abrir()">
      @if (procesando()) {
        Guardando foto…
      } @else {
        <ng-content />
      }
    </button>
    <input #archivo type="file" accept="image/*" [attr.capture]="directa() ? 'environment' : null" hidden (change)="elegida($event)" />
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class CamaraComponent {
  readonly clase = input('btn btn-dashed');
  /** true abre la cámara de una; false deja escoger también de la galería. */
  readonly directa = input(true);
  readonly foto = output<string>();

  private readonly ui = inject(UiService);
  private readonly archivo = viewChild.required<ElementRef<HTMLInputElement>>('archivo');
  protected readonly procesando = signal(false);

  abrir(): void {
    this.archivo().nativeElement.click();
  }

  async elegida(e: Event): Promise<void> {
    const campo = e.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    campo.value = '';
    if (!archivo) return;
    this.procesando.set(true);
    try {
      this.foto.emit(await guardarFoto(archivo));
    } catch (err) {
      console.error(err);
      this.ui.avisar('No se pudo guardar la foto. Intenta otra vez.');
    } finally {
      this.procesando.set(false);
    }
  }
}
