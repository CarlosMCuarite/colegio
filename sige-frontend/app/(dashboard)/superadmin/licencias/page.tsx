'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useData, useMutation } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const ESTADO_CONF: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  ACTIVO:     { bg: '#d1fae5', text: '#065f46', label: 'Activa',     icon: 'bi-check-circle'  },
  PRUEBA:     { bg: '#fef3c7', text: '#92400e', label: 'Prueba',     icon: 'bi-hourglass-split' },
  SUSPENDIDO: { bg: '#fee2e2', text: '#991b1b', label: 'Suspendida', icon: 'bi-pause-circle'  },
  INACTIVO:   { bg: '#f1f5f9', text: '#475569', label: 'Vencida',    icon: 'bi-x-circle'      },
};

export default function LicenciasPage() {
  const { data: colegiosData, mutate: mutateColegios } = useData<any>('/colegios');
  const { data: planesData }                            = useData<any>('/membresias/planes');
  const { loading: saving, mutate: save }                = useMutation();
  const [historialDe, setHistorialDe] = useState<any>(null);
  const [renovarDe, setRenovarDe]     = useState<any>(null);

  const colegios  = Array.isArray((colegiosData as any)?.data) ? (colegiosData as any).data : [];
  const planes   = (planesData as any)?.data ?? [];

  const suspender = async (c: any) => {
    const motivo = prompt(`Motivo de suspensión para "${c.nombre}" (opcional):`);
    await save(async () => {
      await api.patch(`/membresias/licencias/${c.id}/suspender`, { motivo });
      toast.success('Licencia suspendida');
      mutateColegios();
    });
  };

  const reactivar = async (c: any) => {
    if (!confirm(`¿Reactivar la licencia de "${c.nombre}"?`)) return;
    await save(async () => {
      await api.patch(`/membresias/licencias/${c.id}/reactivar`);
      toast.success('Licencia reactivada');
      mutateColegios();
    });
  };

  const renovar = async (planId: string, meses: number) => {
    await save(async () => {
      await api.post(`/membresias/renovar/${renovarDe.id}`, { planId, meses });
      toast.success('Licencia renovada');
      mutateColegios();
      setRenovarDe(null);
    });
  };

  return (
    <DashboardLayout title="Gestión de Licencias" allowedRoles={['SUPERADMIN']}>
      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="sige-table">
            <thead>
              <tr><th>Colegio</th><th>Plan</th><th>Estado</th><th>Vence</th><th>Días restantes</th><th style={{ textAlign: 'right' }}>Acciones</th></tr>
            </thead>
            <tbody>
              {colegios.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin colegios</td></tr>
              ) : colegios.map((c: any, i: number) => {
                const conf = ESTADO_CONF[c.estado] ?? ESTADO_CONF.INACTIVO;
                const dias = c.licenciaFin ? Math.ceil((new Date(c.licenciaFin).getTime() - Date.now()) / 86400000) : null;
                return (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                    <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.nombre}</td>
                    <td style={{ fontSize: '0.82rem' }}>{c.plan?.nombre ?? '—'}</td>
                    <td><span className="estado-badge" style={{ background: conf.bg, color: conf.text }}><i className={`bi ${conf.icon} me-1`} />{conf.label}</span></td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.licenciaFin ? new Date(c.licenciaFin).toLocaleDateString('es-PE') : '—'}</td>
                    <td>
                      {dias !== null ? (
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: dias <= 0 ? '#ef4444' : dias <= 30 ? '#f59e0b' : '#10b981' }}>
                          {dias <= 0 ? 'Vencida' : `${dias} días`}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button onClick={() => setRenovarDe(c)} className="btn-accent" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                          <i className="bi bi-arrow-clockwise me-1" />Renovar
                        </button>
                        {c.estado === 'SUSPENDIDO' ? (
                          <button onClick={() => reactivar(c)} style={{ background: '#d1fae5', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#065f46', fontSize: '0.75rem', fontWeight: 600 }}>
                            <i className="bi bi-play-circle me-1" />Reactivar
                          </button>
                        ) : (
                          <button onClick={() => suspender(c)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#991b1b', fontSize: '0.75rem', fontWeight: 600 }}>
                            <i className="bi bi-pause-circle me-1" />Suspender
                          </button>
                        )}
                        <button onClick={() => setHistorialDe(c)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                          <i className="bi bi-clock-history" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {renovarDe && <ModalRenovar colegio={renovarDe} planes={planes} onRenovar={renovar} onCancelar={() => setRenovarDe(null)} saving={saving} />}
        {historialDe && <ModalHistorial colegio={historialDe} onCancelar={() => setHistorialDe(null)} />}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function ModalRenovar({ colegio, planes, onRenovar, onCancelar, saving }: any) {
  const [planId, setPlanId] = useState(colegio.planId ?? '');
  const [meses, setMeses]   = useState(12);
  const planesActivos = planes.filter((p: any) => p.activo);
  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="sige-modal" style={{ maxWidth: 400 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1rem' }}><i className="bi bi-arrow-clockwise me-2" />Renovar licencia</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{colegio.nombre}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.25rem' }}>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Plan</label>
            <select value={planId} onChange={e => setPlanId(e.target.value)} className="sige-input">
              {planesActivos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Meses</label>
            <select value={meses} onChange={e => setMeses(Number(e.target.value))} className="sige-input">
              {[1,3,6,12,24,36].map(m => <option key={m} value={m}>{m} mes{m > 1 ? 'es' : ''}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancelar</button>
          <button onClick={() => onRenovar(planId, meses)} className="btn-accent" disabled={saving || !planId}>{saving ? <span className="spinner-border spinner-border-sm" /> : 'Renovar'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModalHistorial({ colegio, onCancelar }: any) {
  const { data } = useData<any>(`/membresias/licencias/${colegio.id}`);
  const licencias = (data as any)?.data ?? [];
  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => { if (e.target === e.currentTarget) onCancelar(); }}>
      <motion.div className="sige-modal" style={{ maxWidth: 480 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Historial — {colegio.nombre}</h3>
          <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 360, overflowY: 'auto' }}>
          {licencias.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Sin historial registrado</p>
          ) : licencias.map((l: any) => {
            const conf = ESTADO_CONF[l.estado] ?? ESTADO_CONF.INACTIVO;
            return (
              <div key={l.id} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.625rem 0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span className="estado-badge" style={{ background: conf.bg, color: conf.text, fontSize: '0.7rem' }}>{l.estado}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(l.createdAt).toLocaleDateString('es-PE')}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {new Date(l.fechaInicio).toLocaleDateString('es-PE')} → {new Date(l.fechaFin).toLocaleDateString('es-PE')}
                </div>
                {l.motivo && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{l.motivo}</div>}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
