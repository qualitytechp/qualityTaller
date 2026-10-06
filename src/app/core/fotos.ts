import { db, nuevoId } from './db';

const LADO_MAXIMO = 1600;
const CALIDAD = 0.78;

/**
 * Reduce la foto de la cámara (5–12 MB) a unos 200–400 KB antes de guardarla,
 * para que el celular no se llene. La etiqueta <img> ya respeta la orientación de la foto.
 */
export async function comprimir(archivo: Blob): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
    const ancho = Math.round(img.naturalWidth * escala);
    const alto = Math.round(img.naturalHeight * escala);
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    lienzo.getContext('2d')!.drawImage(img, 0, 0, ancho, alto);
    return await new Promise<Blob>((resolve, reject) =>
      lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la foto'))), 'image/jpeg', CALIDAD),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Comprime y guarda la foto en el celular. Devuelve su id. */
export async function guardarFoto(archivo: Blob): Promise<string> {
  const blob = await comprimir(archivo);
  const id = nuevoId();
  await db.fotos.put({ id, blob, en: Date.now() });
  return id;
}

export async function archivoDeFoto(id: string, nombre: string): Promise<File | null> {
  const f = await db.fotos.get(id);
  return f ? new File([f.blob], nombre + '.jpg', { type: 'image/jpeg' }) : null;
}
