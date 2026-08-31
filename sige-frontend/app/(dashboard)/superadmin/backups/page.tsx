'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const ESTADO_CONF: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  COMPLETADO: { bg: '#d1fae5', text: '#065f46', label: 'Completado', icon: 'bi-check-circle'  },
  EN_PROCESO: { bg: '#fef3c7', text: '#92400e', label: 'En proceso', icon: 'bi-hourglass-split' },
  FALLIDO:    { bg: '#fee2e2', text: '#991b1b', label: 'Fallido',    icon: 'bi-x-circle'        },
};

export default function BackupsPage() {
  const { data: backupsData, mutate } = useData<any>('/backups');
  const { data: colegiosData }        = useData<any>('/colegios');
  const { loading: saving, mutate: save } = useMutation();
  const [colegioSel, setColegioSel] = useState('');

  const backups  = (backupsData as any)?.data ?? [];
  const colegios  = Array.isArray((colegiosData as any)?.data) ? (colegiosData as any).data : [];
  const ultimoRecuperable = backups.find((backup: any) => backup.estado === 'COMPLETADO');

  const dispararBackup = async () => {
    await save(async () => {
      const res = await api.post('/backups', colegioSel ? { colegioId: colegioSel } : {});
      const resultado = res.data?.data;
      if (resultado?.backups?.length) {
        toast.success(`${resultado.backups.length} respaldo(s) generado(s) y verificado(s)`);
      } else if (resultado?.fallidos?.length) {
        toast.error(`No se pudo generar: ${resultado.fallidos.join(' · ')}`, { duration: 10000 });
      } else if (resultado?.bloqueados?.length) {
        toast.error(`Protección activada: ${resultado.bloqueados.join(' · ')}`, { duration: 10000 });
      } else if (resultado?.omitidos?.length) {
        toast.success('No hubo cambios desde el último respaldo; no se consumió almacenamiento adicional.');
      }
      mutate();
    });
  };

  const restaurar = async (id: string, colegio: string) => {
    try {
      const comprobacion = await api.get(`/backups/${id}/verificar`);
      if (!comprobacion.data?.data?.recuperable) {
        toast.error('La restauración fue bloqueada porque este respaldo no superó la verificación de integridad.', { duration: 9000 });
        return;
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo comprobar la integridad del respaldo. No se realizó ningún cambio.');
      return;
    }
    if (!confirm(`¿Restaurar los datos faltantes de ${colegio}?\n\nModo seguro: no borra ni reemplaza información actual; solo recupera registros/archivos ausentes y reactiva eliminados lógicamente.`)) return;
    await save(async () => {
      const res = await api.post(`/backups/${id}/restaurar`, { confirmacion: 'RESTAURAR SIN BORRAR' });
      const r = res.data?.data;
      const insertados = Object.values(r?.insertados ?? {}).reduce((n: number, v: any) => n + Number(v || 0), 0);
      const reactivados = Object.values(r?.reactivados ?? {}).reduce((n: number, v: any) => n + Number(v || 0), 0);
      toast.success(`Restauración segura: ${insertados} registros recuperados, ${reactivados} reactivados y ${r?.archivosRestaurados ?? 0} archivos restaurados.`, { duration: 9000 });
      mutate();
    });
  };

  const descargar = async (id: string, nombre: string) => {
    try {
      const res = await api.get(`/backups/${id}/descargar`);
      const archivo = await fetch(res.data.url);
      if (!archivo.ok) throw new Error('El archivo firmado no está disponible');
      const blob = await archivo.blob();
      const urlLocal = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlLocal;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(urlLocal);
    } catch (err: any) {
      toast.error(
        (err?.response?.data?.error ?? 'No se pudo descargar el backup') +
        ' — probablemente el bucket "backups" de Supabase Storage no existe o fue recreado. Vuelve a correr docs/SUPABASE_STORAGE_SETUP.sql y usa "Purgar rotos".',
        { duration: 9000 },
      );
    }
  };

  const verificar = async (id: string) => {
    try {
      const res = await api.get(`/backups/${id}/verificar`);
      const v = res.data?.data;
      if (v?.recuperable) {
        const aviso = v.archivosFaltantes ? ` · ${v.archivosFaltantes} referencia(s) ya no existían en Storage` : '';
        toast.success(`Verificado: ${v.registrosEnJson} registros · ${v.archivosRespaldados} archivos vigentes${aviso}`, { duration: 8000 });
      } else {
        toast.error(`Este respaldo no es recuperable: ${v?.archivosNoDisponibles ?? 0} archivo(s) del espejo no están disponibles o falló la integridad del JSON.`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo verificar el backup');
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este backup? Esta acción no se puede deshacer.')) return;
    await save(async () => {
      await api.delete(`/backups/${id}`);
      toast.success('Backup eliminado');
      mutate();
    });
  };

  const purgarRotos = async () => {
    if (!confirm('Esto revisa todos los backups marcados "Completado" y elimina de la lista los que ya no existen en Storage (por ejemplo, si el bucket se recreó manualmente). ¿Continuar?')) return;
    await save(async () => {
      const res = await api.post('/backups/purgar-rotos');
      const { purgados, revisados } = res.data;
      toast.success(purgados > 0 ? `Se limpiaron ${purgados} de ${revisados} backups rotos` : `Los ${revisados} backups revisados están en buen estado`, { duration: 6000 });
      mutate();
    });
  };

  const diagnosticarStorage = async () => {
    await save(async () => {
      const res = await api.post('/backups/diagnostico-storage');
      const d = res.data?.data;
      toast.success(`Storage operativo: escritura y limpieza verificadas en el bucket “${d?.bucket ?? 'backups'}”.`, { duration: 7000 });
    });
  };

  return (
    <DashboardLayout title="Backups del Sistema" allowedRoles={['SUPERADMIN']}>

      <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--accent)' }}>
        <i className="bi bi-shield-check me-2" />
        Cada versión incluye todas las tablas y archivos deduplicados por contenido. Se conservan hasta 7 versiones,
        no se repiten datos sin cambios y una caída anormal de registros bloquea la copia para proteger la última versión sana.
        La restauración funciona por fusión: recupera lo faltante sin borrar ni sobrescribir información actual.
      </div>

      <div className="sige-card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>
          <i className="bi bi-arrow-repeat me-2" />Generar respaldo manual
        </h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ minWidth: 260 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Colegio</label>
            <select value={colegioSel} onChange={e => setColegioSel(e.target.value)} className="sige-input">
              <option value="">Todos los colegios activos</option>
              {colegios.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <button onClick={dispararBackup} disabled={saving} className="btn-accent">
            {saving ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-play-circle me-1" />}
            Generar ahora
          </button>
        </div>
      </div>

      <section className="sige-card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }} aria-labelledby="centro-recuperacion">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 680 }}>
            <h3 id="centro-recuperacion" style={{ fontWeight: 750, fontSize: '1rem', margin: 0, color: 'var(--text-primary)' }}>
              <i className="bi bi-life-preserver me-2" style={{ color: 'var(--accent)' }} />Centro de recuperación
            </h3>
            <p style={{ margin: '0.45rem 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.55 }}>
              Descarga una copia para conservarla fuera del sistema. Si ocurre una falla, usa Restaurar: SIGE verificará primero la integridad y recuperará únicamente datos o archivos ausentes, sin borrar ni sobrescribir lo actual.
            </p>
          </div>
          {ultimoRecuperable && (
            <span className="estado-badge" style={{ background: '#d1fae5', color: '#065f46' }}>
              <i className="bi bi-check-circle me-1" />Último respaldo disponible
            </span>
          )}
        </div>

        {ultimoRecuperable ? (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0, flex: '1 1 280px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', overflowWrap: 'anywhere' }}>{ultimoRecuperable.nombre}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>
                {ultimoRecuperable.colegio?.nombre ?? 'Colegio'} · {ultimoRecuperable.tamanoKB ?? 0} KB · {new Date(ultimoRecuperable.createdAt).toLocaleString('es-PE')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 420px' }}>
              <button onClick={() => verificar(ultimoRecuperable.id)} disabled={saving} className="btn-accent" style={{ background: 'var(--bg-secondary)', color: 'var(--accent)', border: '1px solid var(--border-color)' }}>
                <i className="bi bi-shield-check me-1" />Verificar
              </button>
              <button onClick={() => descargar(ultimoRecuperable.id, ultimoRecuperable.nombre)} disabled={saving} className="btn-accent">
                <i className="bi bi-download me-1" />Descargar copia
              </button>
              <button onClick={() => restaurar(ultimoRecuperable.id, ultimoRecuperable.colegio?.nombre ?? 'este colegio')} disabled={saving}
                className="btn-accent" style={{ background: '#5b21b6' }}>
                <i className="bi bi-arrow-counterclockwise me-1" />Restaurar respaldo
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '1rem', padding: '0.9rem 1rem', background: 'var(--bg-secondary)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Genera un respaldo completado para habilitar las opciones de descarga y restauración.
          </div>
        )}
      </section>

      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><i className="bi bi-archive me-2" />Historial de respaldos</span>
          <button onClick={purgarRotos} disabled={saving}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
            <i className="bi bi-eraser me-1" />Purgar rotos
          </button>
          <button onClick={diagnosticarStorage} disabled={saving}
            style={{ background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb,var(--accent) 30%,transparent)', borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700 }}>
            <i className="bi bi-heart-pulse me-1" />Probar Storage
          </button>
        </div>
        {backups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
            Sin respaldos generados aún
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead><tr><th>Archivo</th><th>Colegio</th><th>Tamaño</th><th>Estado</th><th>Fecha</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
              <tbody>
                {backups.map((b: any, i: number) => {
                  const conf = ESTADO_CONF[b.estado] ?? ESTADO_CONF.EN_PROCESO;
                  return (
                    <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{b.nombre}</td>
                      <td style={{ fontSize: '0.82rem' }}>{b.colegio?.nombre ?? '—'}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{b.tamanoKB ? `${b.tamanoKB} KB` : '—'}</td>
                      <td>
                        <span className="estado-badge" style={{ background: conf.bg, color: conf.text, cursor: b.estado === 'FALLIDO' && b.error ? 'help' : 'default' }} title={b.estado === 'FALLIDO' ? b.error : undefined}>
                          <i className={`bi ${conf.icon} me-1`} />{conf.label}
                        </span>
                        {b.estado === 'FALLIDO' && b.error && (
                          <div style={{ fontSize: '0.68rem', color: '#991b1b', marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.error}>
                            Histórico: {b.error}
                          </div>
                        )}
                        {b.estado === 'COMPLETADO' && b.error && (
                          <div style={{ fontSize: '0.68rem', color: '#92400e', marginTop: 2, maxWidth: 260 }} title={b.error}>
                            <i className="bi bi-exclamation-triangle me-1" />{b.error}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(b.createdAt).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap', minWidth: 300 }}>
                          {b.estado === 'COMPLETADO' && (
                            <>
                              <button onClick={() => verificar(b.id)} style={{ background: '#dbeafe', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#1e40af', fontSize: '0.75rem', fontWeight: 600 }}>
                                <i className="bi bi-shield-check me-1" />Verificar
                              </button>
                              <button onClick={() => descargar(b.id, b.nombre)} className="btn-accent" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                                <i className="bi bi-download me-1" />Descargar
                              </button>
                              <button onClick={() => restaurar(b.id, b.colegio?.nombre ?? 'este colegio')} disabled={saving} style={{ background: '#ede9fe', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#5b21b6', fontSize: '0.75rem', fontWeight: 700 }}>
                                <i className="bi bi-arrow-counterclockwise me-1" />Restaurar
                              </button>
                            </>
                          )}
                          <button onClick={() => eliminar(b.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#991b1b', fontSize: '0.75rem' }}>
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
