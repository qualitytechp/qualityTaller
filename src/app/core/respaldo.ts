import { exportDB, importInto } from 'dexie-export-import';
import { db, guardarKV, leerKV } from './db';
import { compartirArchivos } from './whatsapp';

const CLAVE_ULTIMO = 'ultimoRespaldo';

export async function ultimoRespaldo(): Promise<number | undefined> {
  return leerKV<number>(CLAVE_ULTIMO);
}

/** Arma el archivo con todo el taller, fotos incluidas. Puede tardar si hay muchas fotos. */
export async function prepararRespaldo(): Promise<File> {
  const blob = await exportDB(db, { prettyJson: false });
  const fecha = new Date().toISOString().slice(0, 10);
  return new File([blob], `qualitytaller-${fecha}.json`, { type: 'application/json' });
}

/**
 * Entrega la copia con la hoja de compartir del iPhone (Archivos, iCloud, AirDrop, WhatsApp)
 * o, si no se puede, la descarga. Va en su propio toque: Safari solo deja compartir
 * justo después de que la persona toca algo.
 */
export async function entregarRespaldo(archivo: File): Promise<void> {
  const compartido = await compartirArchivos([archivo], 'Copia de seguridad de QualityTaller');
  if (!compartido) {
    const url = URL.createObjectURL(archivo);
    const a = document.createElement('a');
    a.href = url;
    a.download = archivo.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  await guardarKV(CLAVE_ULTIMO, Date.now());
}

/** Reemplaza todos los datos del celular con los de la copia. */
export async function restaurarRespaldo(archivo: Blob): Promise<void> {
  await importInto(db, archivo, { clearTablesBeforeImport: true, acceptVersionDiff: true });
}
