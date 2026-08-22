'use client';
// app/(dashboard)/padre/page.tsx
import { useState, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDashboardPadre, useMutation } from '@/hooks/useApi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function PadreDashboard() {
  const { data, isLoading, mutate } = useDashboardPadre();
  const { loading: saving, mutate: save } = useMutation();
  const [showVincular, setShowVincular] = useState(false);
  const [dniHijo, setDniHijo] = useState('');

  const solicitarVinculo = async (e: React.FormEvent) => {
    e.preventDefault();
    await save(async () => {
      const res = await api.post('/padres/solicitar-vinculo', { estudianteDni: dniHijo });
      toast.success(res.data?.mensaje ?? 'Solicitud enviada');
      setDniHijo(''); setShowVincular(false); mutate();
    });
  };

  if (isLoading) return (
    <DashboardLayout title="Mi Panel" allowedRoles={['PADRE']}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {[...Array(3)].map((_, i) => <div key={i} className="sige-card animate-pulse" style={{ height: 120 }} />)}
      </div>
    </DashboardLayout>
  );

  const d = (data as any)?.data;
  const estudiantes = d?.estudiantes ?? [];
  const asistenciaHoy = d?.asistenciaHoy ?? [];
  const pagosPendientes = d?.pagosPendientes ?? [];
  const comunicados = d?.comunicados ?? [];
  const eventos = d?.eventos ?? [];
  const observaciones = d?.observaciones ?? [];
  const notifNoLeidas = d?.totalNotifNoLeidas ?? 0;

  return (
    <DashboardLayout title="Mi Panel Familiar" allowedRoles={['PADRE']}>

      {/* Bienvenida */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="sige-card"
        style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg, var(--accent), #7c3aed)', border: 'none' }}
      >
        <div style={{ color: '#fff' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>
            ¡Bienvenido/a, {d?.padre?.nombres}!
          </h2>
          <p style={{ opacity: 0.85, fontSize: '0.875rem', margin: 0 }}>
            {notifNoLeidas > 0
              ? `Tienes ${notifNoLeidas} notificación(es) sin leer.`
              : 'Todo al día. Sin notificaciones pendientes.'}
          </p>
        </div>
      </motion.div>

      {/* Mis hijos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Mis hijos
        </h3>
        <button onClick={() => setShowVincular(true)}
          style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, padding: '0.35rem 0.75rem', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600 }}>
          <i className="bi bi-person-plus me-1" />Vincular hijo
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {estudiantes.map((est: any, i: number) => {
          const matricula = est.matriculas?.[0];
          const asistHoy  = asistenciaHoy.find((a: any) => a.estudianteId === est.id);
          const estadoColor: Record<string, string> = { PRESENTE: '#10b981', AUSENTE: '#ef4444', TARDANZA: '#f59e0b' };
          return (
            <motion.div key={est.id} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.08 }} className="sige-card">
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <FotoHijo estudiante={est} onSubida={() => mutate()} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {est.nombres} {est.apellidos}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {matricula?.nivelGrado?.nombre} {matricula?.seccion ? `— Sección ${matricula.seccion.nombre}` : ''}
                  </div>
                  {asistHoy && (
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600,
                      color: estadoColor[asistHoy.estado] ?? '#64748b',
                      background: `${estadoColor[asistHoy.estado] ?? '#64748b'}18`,
                      padding: '2px 8px', borderRadius: 99, display: 'inline-block', marginTop: 4,
                    }}>
                      {asistHoy.estado === 'PRESENTE' ? '✓ Asistió hoy' : asistHoy.estado === 'TARDANZA' ? '⏰ Tardanza' : '✗ Ausente'}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>

        {/* Pagos pendientes */}
        <div className="sige-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              <i className="bi bi-cash-stack me-2" style={{ color: '#f59e0b' }} />Pagos pendientes
            </h3>
            {d?.totalDeuda > 0 && (
              <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.9rem' }}>
                S/ {Number(d.totalDeuda).toFixed(2)}
              </span>
            )}
          </div>
          {pagosPendientes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <i className="bi bi-check-circle" style={{ fontSize: '1.5rem', color: '#10b981', display: 'block', marginBottom: 6 }} />
              ¡Sin pagos pendientes!
            </div>
          ) : pagosPendientes.map((p: any) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.concepto?.nombre ?? p.tipo}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.periodoPago}</div>
              </div>
              <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.9rem' }}>S/ {Number(p.monto).toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* Observaciones recientes */}
        <div className="sige-card">
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            <i className="bi bi-exclamation-triangle me-2" style={{ color: '#ef4444' }} />Observaciones
          </h3>
          {observaciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <i className="bi bi-emoji-smile" style={{ fontSize: '1.5rem', color: '#10b981', display: 'block', marginBottom: 6 }} />
              Sin observaciones recientes
            </div>
          ) : observaciones.map((o: any) => (
            <div key={o.id} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: o.tipo === 'DISCIPLINARIA' ? '#ef4444' : o.tipo === 'POSITIVA' ? '#10b981' : '#f59e0b' }}>
                  {o.tipo}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {new Date(o.fecha).toLocaleDateString('es-PE')}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0 }}>{o.descripcion}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Comunicados y Eventos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="sige-card">
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            <i className="bi bi-megaphone me-2" style={{ color: 'var(--accent)' }} />Comunicados
          </h3>
          {comunicados.slice(0,4).map((c: any) => (
            <div key={c.id} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{c.titulo}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {new Date(c.createdAt).toLocaleDateString('es-PE')}
              </div>
            </div>
          ))}
          {comunicados.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin comunicados recientes.</p>}
        </div>

        <div className="sige-card">
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            <i className="bi bi-calendar-event me-2" style={{ color: '#10b981' }} />Próximos eventos
          </h3>
          {eventos.slice(0,4).map((ev: any) => (
            <div key={ev.id} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 40, textAlign: 'center', background: 'var(--accent-soft)', borderRadius: 8, padding: '2px 0' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {new Date(ev.fechaInicio).toLocaleString('es-PE', { month: 'short' })}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                  {new Date(ev.fechaInicio).getDate()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.titulo}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ev.lugar}</div>
              </div>
            </div>
          ))}
          {eventos.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin eventos próximos.</p>}
        </div>
      </div>

      {estudiantes.length === 0 && (
        <div className="sige-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
          <i className="bi bi-person-plus" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
          Aún no tienes hijos vinculados. Usa el botón "Vincular hijo" con el DNI de tu hijo/a.
        </div>
      )}

      <AnimatePresence>
        {showVincular && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowVincular(false); }}>
            <motion.div className="sige-modal" style={{ maxWidth: 400 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <form onSubmit={solicitarVinculo}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Vincular a un hijo/a</h3>
                  <button type="button" onClick={() => setShowVincular(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Ingresa el DNI de tu hijo/a. El administrador revisará y aprobará tu solicitud.
                </p>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>DNI del estudiante *</label>
                <input type="text" value={dniHijo} onChange={e => setDniHijo(e.target.value)} required className="sige-input" placeholder="Ej: 12345678" />
                <button type="submit" className="btn-accent" disabled={saving} style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem', padding: '0.6rem' }}>
                  {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-send me-1" />Enviar solicitud</>}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function FotoHijo({ estudiante, onSubida }: { estudiante: any; onSubida: () => void }) {
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('foto', file);
      await api.post(`/estudiantes/${estudiante.id}/foto`, fd);
      toast.success('Foto actualizada');
      onSubida();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo subir la foto');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <button onClick={() => inputRef.current?.click()} disabled={subiendo}
      title="Subir foto de tu hijo/a (para el carnet)"
      style={{
        width: 48, height: 48, borderRadius: '50%', flexShrink: 0, position: 'relative',
        background: estudiante.fotoUrl ? `url(${estudiante.fotoUrl}) center/cover` : 'var(--accent-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', border: 'none', cursor: 'pointer', padding: 0, overflow: 'hidden',
      }}>
      {!estudiante.fotoUrl && `${estudiante.nombres?.[0] ?? ''}${estudiante.apellidos?.[0] ?? ''}`}
      <span style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-card)' }}>
        {subiendo ? <span className="spinner-border spinner-border-sm" style={{ width: 8, height: 8, borderWidth: 1 }} /> : <i className="bi bi-camera-fill" style={{ fontSize: 8, color: '#fff' }} />}
      </span>
      <input ref={inputRef} type="file" accept="image/*" onChange={subir} style={{ display: 'none' }} />
    </button>
  );
}
