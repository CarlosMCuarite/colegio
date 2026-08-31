'use client';
import { useEffect } from 'react';
import api from '../lib/api';

const MODULOS = ['estudiantes','padres','matriculas','asistencias','pagos','eventos','comunicados'];

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sige-respaldos-locales', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('respaldos', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function guardarLocal(blob: Blob, colegioId: string) {
  const db = await abrirDB();
  const registros: any[] = await new Promise((resolve, reject) => {
    const req = db.transaction('respaldos', 'readonly').objectStore('respaldos').getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
  const tx = db.transaction('respaldos', 'readwrite');
  const store = tx.objectStore('respaldos');
  store.put({ id: `${colegioId}-${Date.now()}`, colegioId, creadoEn: new Date().toISOString(), blob });
  registros.filter(r => r.colegioId === colegioId).sort((a,b) => a.creadoEn.localeCompare(b.creadoEn)).slice(0, -2).forEach(r => store.delete(r.id));
}

export default function BackgroundLocalBackup({ rol, colegioId }: { rol: string; colegioId?: string }) {
  useEffect(() => {
    if (!colegioId || !['SUPERADMIN','ADMINISTRADOR','SECRETARIA'].includes(rol) || !('indexedDB' in window)) return;
    let ocupado = false;
    const ejecutar = async () => {
      if (ocupado || !navigator.onLine || document.visibilityState !== 'visible') return;
      ocupado = true;
      try {
        const res = await api.post('/exportaciones', { modulos: MODULOS }, { responseType: 'blob' });
        await guardarLocal(new Blob([res.data], { type: 'application/zip' }), colegioId);
        localStorage.setItem('sige-ultimo-respaldo-local', new Date().toISOString());
      } catch { /* respaldo secundario: nunca interrumpe el trabajo del usuario */ }
      finally { ocupado = false; }
    };
    const inicio = window.setTimeout(ejecutar, 60_000);
    const intervalo = window.setInterval(ejecutar, 30 * 60_000);
    return () => { clearTimeout(inicio); clearInterval(intervalo); };
  }, [rol, colegioId]);
  return null;
}
