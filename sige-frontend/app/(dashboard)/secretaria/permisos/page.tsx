'use client';
// app/(dashboard)/secretaria/permisos/page.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData, useMutation } from '../../../../hooks/useApi';
import { useAuth } from '../../../../lib/auth';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const ESTADO_CONF: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  SOLICITADO:  { bg: '#fef3c7', text: '#92400e', icon: 'bi-clock',         label: 'Solicitado'  },
  VALIDADO:    { bg: '#dbeafe', text: '#1e40af', icon: 'bi-shield-check',  label: 'Validado'    },
  AUTORIZADO:  { bg: '#d1fae5', text: '#065f46', icon: 'bi-check-circle',  label: 'Autorizado'  },
  DENEGADO:    { bg: '#fee2e2', text: '#991b1b', icon: 'bi-x-circle',      label: 'Denegado'    },
  EJECUTADO:   { bg: '#f0fdf4', text: '#166534', icon: 'bi-door-open',     label: 'Ejecutado'   },
};

export default function PermisosPage() {
  const { user } = useAuth();
  const puedeAprobarSalida = user && ['SUPERADMIN','ADMINISTRADOR','DIRECTOR'].includes(user.rol);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [modalTipo, setModalTipo] = useState<'validar' | 'autorizar' | 'denegar' | 'crear' | null>(null);

  const params = new URLSearchParams({ estado: estadoFiltro }).toString();
  const { data, isLoading, mutate } = useData<any>(`/permisos?${params}`);
  const { loading: acting, mutate: act } = useMutation();

  const permisos = data?.data ?? [];

  const abrirModal = (permiso: any, tipo: typeof modalTipo) => {
    setSelected(permiso);
    setModalTipo(tipo);
  };

  const crear = async (estudianteId: string, motivo: string, descripcion: string) => {
    await act(async () => {
      await api.post('/permisos', { estudianteId, motivo, descripcion: descripcion || undefined });
      toast.success('Permiso registrado');
      mutate();
      setModalTipo(null);
    });
  };

  const validar = async (telefonoContactado: string, llamadaConfirmada: boolean) => {
    await act(async () => {
      await api.patch(`/permisos/${selected.id}/validar`, { telefonoContactado, llamadaConfirmada });
      toast.success('Permiso validado');
      mutate();
      setModalTipo(null);
    });
  };

  const autorizar = async (obs: string) => {
    await act(async () => {
      await api.patch(`/permisos/${selected.id}/autorizar`, { autorizado: true, observaciones: obs });
      toast.success('✅ Permiso autorizado — el padre ha sido notificado');
      mutate();
      setModalTipo(null);
    });
  };

  const denegar = async (obs: string) => {
    if (!obs.trim()) { toast.error('Ingresa el motivo del rechazo'); return; }
    await act(async () => {
      await api.patch(`/permisos/${selected.id}/autorizar`, { autorizado: false, observaciones: obs });
      toast.success('Permiso denegado');
      mutate();
      setModalTipo(null);
    });
  };

  const ejecutar = async (id: string) => {
    await act(async () => {
      await api.patch(`/permisos/${id}/ejecutar`);
      toast.success('Permiso ejecutado — estudiante salió');
      mutate();
    });
  };

  return (
    <DashboardLayout title="Permisos de Salida" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['', 'SOLICITADO', 'VALIDADO', 'AUTORIZADO', 'DENEGADO', 'EJECUTADO'].map(e => {
            const conf = ESTADO_CONF[e];
            return (
              <button key={e}
                onClick={() => setEstadoFiltro(e)}
                style={{
                  padding: '0.35rem 0.875rem', borderRadius: 99, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                  background: estadoFiltro === e ? 'var(--accent)' : 'var(--bg-card)',
                  color: estadoFiltro === e ? '#fff' : 'var(--text-secondary)',
                  boxShadow: estadoFiltro === e ? '0 2px 8px rgba(79,70,229,0.3)' : 'none',
                  border: estadoFiltro !== e ? '1px solid var(--border-color)' : 'none',
                } as any}>
                {e === '' ? 'Todos' : conf.label}
              </button>
            );
          })}
        </div>
        <button className="btn-accent" onClick={() => abrirModal(null, 'crear')}>
          <i className="bi bi-plus-lg me-1" />Nuevo Permiso
        </button>
      </div>

      {/* Tarjetas */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div className="spinner-border spinner-border-sm me-2" />Cargando permisos...
        </div>
      ) : permisos.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-door-closed" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />
          Sin permisos en este estado
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {permisos.map((p: any, i: number) => {
            const conf = ESTADO_CONF[p.estado] ?? ESTADO_CONF.SOLICITADO;
            return (
              <motion.div key={p.id} className="sige-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

                  {/* Info estudiante */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        <i className="bi bi-person me-1" />{p.estudiante?.nombres} {p.estudiante?.apellidos}
                      </span>
                      <span className="estado-badge" style={{ background: conf.bg, color: conf.text }}>
                        <i className={`bi ${conf.icon} me-1`} />{conf.label}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.4rem 0' }}>
                      <strong>Motivo:</strong> {p.motivo}
                    </p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span><i className="bi bi-person-workspace me-1" />Solicitado por: {p.solicitadoPor?.nombres} ({p.solicitadoPor?.rol})</span>
                      <span><i className="bi bi-clock me-1" />{new Date(p.fechaSolicitud).toLocaleString('es-PE')}</span>
                      {p.llamadaConfirmada && <span style={{ color: '#10b981' }}><i className="bi bi-telephone-check me-1" />Llamada confirmada</span>}
                      {p.telefonoContactado && <span><i className="bi bi-telephone me-1" />{p.telefonoContactado}</span>}
                    </div>
                  </div>

                  {/* Acciones según estado */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {p.estado === 'SOLICITADO' && (
                      <button onClick={() => abrirModal(p, 'validar')} className="btn-accent" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}>
                        <i className="bi bi-telephone me-1" />Validar (llamar padre)
                      </button>
                    )}
                    {p.estado === 'VALIDADO' && (
                      <>
                        <button onClick={() => abrirModal(p, 'autorizar')} className="btn-accent" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem', background: '#10b981' }}>
                          <i className="bi bi-check-circle me-1" />Autorizar
                        </button>
                        <button onClick={() => abrirModal(p, 'denegar')} className="btn-accent" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem', background: '#ef4444' }}>
                          <i className="bi bi-x-circle me-1" />Denegar
                        </button>
                      </>
                    )}
                    {p.estado === 'AUTORIZADO' && (
                      puedeAprobarSalida ? (
                        <button onClick={() => ejecutar(p.id)} disabled={acting} className="btn-accent" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem', background: '#8b5cf6' }}>
                          <i className="bi bi-door-open me-1" />Marcar Salida
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          <i className="bi bi-hourglass-split me-1" />Esperando aprobación final de Dirección
                        </span>
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modales */}
      <AnimatePresence>
        {modalTipo === 'crear' && (
          <ModalCrear onConfirm={crear} onCancelar={() => setModalTipo(null)} saving={acting} />
        )}
        {modalTipo === 'validar' && (
          <ModalValidar onConfirm={validar} onCancelar={() => setModalTipo(null)} saving={acting} permiso={selected} />
        )}
        {modalTipo === 'autorizar' && (
          <ModalAutDen titulo="Autorizar Permiso" color="#10b981" icono="bi-check-circle"
            onConfirm={autorizar} onCancelar={() => setModalTipo(null)} saving={acting} permiso={selected} requerido={false} />
        )}
        {modalTipo === 'denegar' && (
          <ModalAutDen titulo="Denegar Permiso" color="#ef4444" icono="bi-x-circle"
            onConfirm={denegar} onCancelar={() => setModalTipo(null)} saving={acting} permiso={selected} requerido={true} />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function ModalCrear({ onConfirm, onCancelar, saving }: any) {
  const [busqueda, setBusqueda] = useState('');
  const [nivelGradoId, setNivelGradoId] = useState('');
  const [estudiante, setEstudiante] = useState<any>(null);
  const [motivo, setMotivo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const { data: nivelesData } = useData<any>('/niveles-grados');
  const niveles = nivelesData?.data ?? [];
  const params = new URLSearchParams({ q: busqueda, nivelGradoId, limit: '8' }).toString();
  const { data } = useData<any>(busqueda.trim().length >= 2 || nivelGradoId ? `/estudiantes?${params}` : '');
  const resultados = data?.data ?? [];

  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="sige-modal" style={{ maxWidth: 440 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '1rem' }}>
          <i className="bi bi-door-open me-2" style={{ color: 'var(--accent)' }} />Nuevo Permiso de Salida
        </h3>

        {!estudiante ? (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Buscar estudiante</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 8 }}>
              <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} className="sige-input" placeholder="Nombre, apellido o DNI..." autoFocus />
              <select className="sige-input" value={nivelGradoId} onChange={e => setNivelGradoId(e.target.value)} aria-label="Filtrar por grado">
                <option value="">Todos los grados</option>
                {niveles.map((n: any) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
              </select>
            </div>
            {(busqueda.trim().length >= 2 || nivelGradoId) && (
              <div style={{ marginTop: '0.5rem', maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                {resultados.length === 0 ? (
                  <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>Sin resultados</div>
                ) : resultados.map((e: any) => (
                  <button key={e.id} type="button" onClick={() => setEstudiante(e)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                    <i className="bi bi-person-badge" style={{ color: 'var(--text-muted)' }} />
                    <span style={{ flex: 1 }}>{e.nombres} {e.apellidos}<small style={{ display: 'block', color: 'var(--text-muted)' }}>{e.matriculas?.[0]?.nivelGrado?.nombre ?? 'Sin matrícula'} · DNI {e.dni}</small></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}><i className="bi bi-person-badge me-2" />{estudiante.nombres} {estudiante.apellidos}<small style={{ display: 'block', marginLeft: 24, color: 'var(--text-muted)' }}>{estudiante.matriculas?.[0]?.nivelGrado?.nombre ?? 'Sin matrícula vigente'}</small></span>
              <button type="button" onClick={() => setEstudiante(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem' }}>Cambiar</button>
            </div>
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Motivo *</label>
              <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} className="sige-input" placeholder="Ej: Cita médica" />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Detalle (opcional)</label>
              <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} className="sige-input" style={{ minHeight: 60, resize: 'vertical' }} />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>Cancelar</button>
          {estudiante && (
            <button onClick={() => motivo.trim().length >= 5 ? onConfirm(estudiante.id, motivo, descripcion) : toast.error('El motivo debe tener al menos 5 caracteres')}
              disabled={saving} className="btn-accent">
              {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />Registrar Permiso</>}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModalValidar({ onConfirm, onCancelar, saving, permiso }: any) {
  const [tel, setTel]   = useState('');
  const [conf, setConf] = useState(false);
  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="sige-modal" style={{ maxWidth: 420 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '1rem' }}>
          <i className="bi bi-telephone me-2" style={{ color: '#3b82f6' }} />Validar — Contactar al Padre
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Estudiante: <strong>{permiso?.estudiante?.nombres} {permiso?.estudiante?.apellidos}</strong><br />
          Motivo: {permiso?.motivo}
        </p>
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Teléfono contactado</label>
          <input type="tel" value={tel} onChange={e => setTel(e.target.value)} className="sige-input" placeholder="999 999 999" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1.25rem' }}>
          <input type="checkbox" checked={conf} onChange={e => setConf(e.target.checked)} />
          <span style={{ fontSize: '0.875rem' }}>El padre confirmó la autorización de salida por llamada</span>
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>Cancelar</button>
          <button onClick={() => onConfirm(tel, conf)} disabled={saving} className="btn-accent">
            {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />Registrar Validación</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModalAutDen({ titulo, color, icono, onConfirm, onCancelar, saving, permiso, requerido }: any) {
  const [obs, setObs] = useState('');
  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="sige-modal" style={{ maxWidth: 420 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '1rem' }}>
          <i className={`bi ${icono} me-2`} style={{ color }} />{titulo}
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          <strong>{permiso?.estudiante?.nombres} {permiso?.estudiante?.apellidos}</strong><br />
          {permiso?.motivo}
        </p>
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
            Observaciones {requerido ? '*' : '(opcional)'}
          </label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} className="sige-input" style={{ minHeight: 72, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>Cancelar</button>
          <button onClick={() => onConfirm(obs)} disabled={saving} className="btn-accent" style={{ background: color }}>
            {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className={`bi ${icono} me-1`} />{titulo}</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
