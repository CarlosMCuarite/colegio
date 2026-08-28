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

  const dispararBackup = async () => {
    await save(async () => {
      await api.post('/backups', colegioSel ? { colegioId: colegioSel } : {});
      toast.success(colegioSel ? 'Backup del colegio generado' : 'Backup de todos los colegios activos generado');
      mutate();
    });
  };

  const descargar = async (id: string, nombre: string) => {
    try {
      const res = await api.get(`/backups/${id}/descargar`);
      const a = document.createElement('a');
      a.href = res.data.url;
      a.download = nombre;
      a.click();
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
        toast.success(`✅ Verificado: JSON válido con ${v.registrosEnJson} registros · ${v.archivosRespaldados} carpeta(s) de archivos respaldados`, { duration: 8000 });
      } else {
        toast.error('⚠️ Este backup no pasó la verificación — el JSON no es válido o no se pudo leer');
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

  return (
    <DashboardLayout title="Backups del Sistema" allowedRoles={['SUPERADMIN']}>

      <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--accent)' }}>
        <i className="bi bi-shield-check me-2" />
        Los respaldos incluyen todos los datos del colegio (estudiantes, padres, matrículas,
        asistencias, pagos, comunicados, documentos, eventos, encuestas, horarios y usuarios)
        junto con las URLs de sus archivos alojados en Supabase Storage. Se generan
        automáticamente cada hora y se conservan las últimas 7 versiones por colegio.
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

      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><i className="bi bi-archive me-2" />Historial de respaldos</span>
          <button onClick={purgarRotos} disabled={saving}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
            <i className="bi bi-eraser me-1" />Purgar rotos
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
                            {b.error}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(b.createdAt).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          {b.estado === 'COMPLETADO' && (
                            <>
                              <button onClick={() => verificar(b.id)} style={{ background: '#dbeafe', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#1e40af', fontSize: '0.75rem', fontWeight: 600 }}>
                                <i className="bi bi-shield-check me-1" />Verificar
                              </button>
                              <button onClick={() => descargar(b.id, b.nombre)} className="btn-accent" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                                <i className="bi bi-download me-1" />Descargar
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
