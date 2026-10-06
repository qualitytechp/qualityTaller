import { Component, OnDestroy, effect, input, signal, untracked } from '@angular/core';
import { db } from '../core/db';

/** Muestra una foto guardada en el celular. Sin foto, un bloque de color con la inicial. */
@Component({
  selector: 'qt-foto',
  template: `
    @if (url(); as u) {
      <img [src]="u" [alt]="alt()" />
    } @else {
      <ng-content />
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  `,
})
export class FotoComponent implements OnDestroy {
  readonly fotoId = input<string | undefined>();
  readonly alt = input('Foto');
  protected readonly url = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const id = this.fotoId();
      let vivo = true;
      onCleanup(() => (vivo = false));
      this.soltar();
      if (!id) return;
      db.fotos.get(id).then((f) => {
        if (vivo && f) this.url.set(URL.createObjectURL(f.blob));
      });
    });
  }

  private soltar(): void {
    // untracked: si el efecto leyera `url`, al ponerle la foto se volvería a ejecutar y la borraría.
    const u = untracked(this.url);
    if (u) URL.revokeObjectURL(u);
    this.url.set(null);
  }

  ngOnDestroy(): void {
    this.soltar();
  }
}
