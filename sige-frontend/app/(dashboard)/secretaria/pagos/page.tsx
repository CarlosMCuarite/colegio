'use client';
// app/(dashboard)/secretaria/pagos/page.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { usePagos, useConceptosPago, useMutation } from '../../../../hooks/useApi';
import ModalVoucher from '../../../../components/ModalVoucher';

const MESES_LARGO = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function formatPeriodo(periodo?: string) {
  if (!periodo) return '';
  const [anio, mes] = periodo.split('-').map(Number);
  return mes ? `${MESES_LARGO[mes]} ${anio}` : periodo;
}
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const ESTADO_CONF: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  PENDIENTE:   { bg: '#fef3c7', text: '#92400e', icon: 'bi-clock',         label: 'Pendiente'   },
  EN_REVISION: { bg: '#dbeafe', text: '#1e40af', icon: 'bi-eye',           label: 'En revisión' },
  APROBADO:    { bg: '#d1fae5', text: '#065f46', icon: 'bi-check-circle',  label: 'Aprobado'    },
  RECHAZADO:   { bg: '#fee2e2', text: '#991b1b', icon: 'bi-x-circle',      label: 'Rechazado'   },
};

export default function PagosPage() {
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [periodoFiltro, setPeriodoFiltro] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPago, setSelectedPago] = useState<any>(null);
  const [showRechazo, setShowRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [showConceptos, setShowConceptos] = useState(false);
  const [showGenerar, setShowGenerar] = useState(false);
  const [pagoParaMonto, setPagoParaMonto] = useState<any>(null);
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null);

  const params = new URLSearchParams({ estado: estadoFiltro, q: busqueda, periodoPago: periodoFiltro, page: String(page), limit: '30' }).toString();
  const { data, isLoading, mutate } = usePagos(params);
  const { data: conceptosData, mutate: mutateConceptos } = useConceptosPago();
  const { loading: acting, mutate: act } = useMutation();

  const pagos = (data as any)?.data ?? [];
  const meta  = (data as any)?.meta ?? {};
  const conceptos = (conceptosData as any)?.data ?? [];
  const agregados = meta.agregados ?? [];
  const totalPorEstado = (estado: string) => Number(agregados.find((a: any) => a.estado === estado)?._sum?.monto ?? 0);
  const totalPaginas = Math.max(1, Math.ceil((meta.total ?? 0) / 30));

  const aprobar = async (id: string) => {
    await act(async () => {
      await api.patch(`/pagos/${id}/aprobar`);
      toast.success('Pago aprobado');
      mutate();
    });
  };

  const verVoucher = async (id: string) => {
    try {
      const res = await api.get(`/pagos/${id}/voucher-url`);
      setVoucherUrl(res.data.data.url);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo abrir el voucher');
    }
  };

  const rechazar = async () => {
    if (!motivoRechazo.trim()) { toast.error('Ingresa el motivo del rechazo'); return; }
    await act(async () => {
      await api.patch(`/pagos/${selectedPago.id}/rechazar`, { observaciones: motivoRechazo });
      toast.success('Pago rechazado');
      mutate();
      setShowRechazo(false);
      setSelectedPago(null);
      setMotivoRechazo('');
    });
  };

  return (
    <DashboardLayout title="Gestión de Pagos" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA','CONTADOR']}>
      {/* Acciones */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => setShowConceptos(true)}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.45rem 0.875rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
          <i className="bi bi-tags me-1" />Conceptos de pago
        </button>
        <button onClick={() => setShowGenerar(true)} className="btn-accent">
          <i className="bi bi-calendar-plus me-1" />Generar cargo del mes
        </button>
      </div>

      {/* Resumen de totales — clave para gestionar a escala (miles de alumnos) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {[
          { estado: 'PENDIENTE',   label: 'Por cobrar' },
          { estado: 'EN_REVISION', label: 'En revisión' },
          { estado: 'APROBADO',    label: 'Cobrado' },
        ].map(({ estado, label }) => {
          const conf = ESTADO_CONF[estado];
          return (
            <div key={estado} className="sige-card" style={{ padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: conf.text }}>S/ {totalPorEstado(estado).toFixed(2)}</div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {['', 'PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO'].map(e => (
          <button key={e} onClick={() => { setEstadoFiltro(e); setPage(1); }}
            style={{
              padding: '0.4rem 1rem', borderRadius: 99, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
              background: estadoFiltro === e ? 'var(--accent)' : 'var(--bg-card)',
              color: estadoFiltro === e ? '#fff' : 'var(--text-secondary)',
              border: estadoFiltro === e ? 'none' : '1px solid var(--border-color)',
            } as any}>
            {e === '' ? 'Todos' : ESTADO_CONF[e]?.label ?? e}
          </button>
        ))}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
          <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }} />
          <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1); }}
            placeholder="Buscar por padre, hijo o DNI..." className="sige-input" style={{ paddingLeft: '2rem', fontSize: '0.82rem' }} />
        </div>
        <input type="month" value={periodoFiltro} onChange={e => { setPeriodoFiltro(e.target.value); setPage(1); }}
          className="sige-input" style={{ width: 'auto', fontSize: '0.82rem' }} title="Filtrar por mes" />
        {(busqueda || periodoFiltro) && (
          <button onClick={() => { setBusqueda(''); setPeriodoFiltro(''); setPage(1); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>
            <i className="bi bi-x-lg me-1" />Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner-border spinner-border-sm me-2" />Cargando pagos...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead>
                <tr>
                  <th>Padre / Apoderado</th>
                  <th>Concepto</th>
                  <th>Monto</th>
                  <th>Período</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagos.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
                    Sin pagos en este estado
                  </td></tr>
                ) : pagos.map((p: any, i: number) => {
                  const conf = ESTADO_CONF[p.estado] ?? ESTADO_CONF.PENDIENTE;
                  return (
                    <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.padre?.apellidos}, {p.padre?.nombres}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {p.estudiante ? <><i className="bi bi-mortarboard me-1" />{p.estudiante.nombres} {p.estudiante.apellidos}</> : `DNI: ${p.padre?.dni}`}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{p.concepto?.nombre ?? p.tipo}</td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#059669' }}>S/ {Number(p.monto).toFixed(2)}</div>
                        {p.montoOriginal && Number(p.montoOriginal) !== Number(p.monto) && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>S/ {Number(p.montoOriginal).toFixed(2)}</div>
                        )}
                        {['PENDIENTE','RECHAZADO'].includes(p.estado) && (
                          <button onClick={() => setPagoParaMonto(p)} title="Ajustar monto (hermanos, beca, caso especial)"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.7rem', padding: 0 }}>
                            <i className="bi bi-pencil-square me-1" />Ajustar
                          </button>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatPeriodo(p.periodoPago) || '—'}</td>
                      <td>
                        <span className="estado-badge" style={{ background: conf.bg, color: conf.text }}>
                          <i className={`bi ${conf.icon} me-1`} />{conf.label}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(p.createdAt).toLocaleDateString('es-PE')}
                      </td>
                      <td style={{ minWidth: 230 }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap' }}>
                          {/* Ver voucher */}
                          {p.voucherUrl && (
                            <button onClick={() => verVoucher(p.id)}
                              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                              title="Ver voucher">
                              <i className="bi bi-image" />
                            </button>
                          )}
                          {/* Aprobar */}
                          {p.estado === 'EN_REVISION' && (
                            <button onClick={() => aprobar(p.id)} disabled={acting}
                              style={{ background: '#d1fae5', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#065f46', fontWeight: 600, fontSize: '0.8rem' }}>
                              <i className="bi bi-check-lg me-1" />Aprobar
                            </button>
                          )}
                          {/* Rechazar */}
                          {p.estado === 'EN_REVISION' && (
                            <button onClick={() => { setSelectedPago(p); setShowRechazo(true); }} disabled={acting}
                              style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#991b1b', fontWeight: 600, fontSize: '0.8rem' }}>
                              <i className="bi bi-x-lg me-1" />Rechazar
                            </button>
                          )}
                          {p.estado === 'PENDIENTE' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Esperando voucher del padre</span>
                          )}
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

      {totalPaginas > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.4rem 0.875rem', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.5 : 1, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            <i className="bi bi-chevron-left" />
          </button>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Página {page} de {totalPaginas} · {meta.total} pagos</span>
          <button onClick={() => setPage(p => Math.min(totalPaginas, p + 1))} disabled={page === totalPaginas}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.4rem 0.875rem', cursor: page === totalPaginas ? 'default' : 'pointer', opacity: page === totalPaginas ? 0.5 : 1, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      )}

      {/* Modal rechazo */}
      <AnimatePresence>
        {showRechazo && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="sige-modal" style={{ maxWidth: 400 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1rem' }}>
                <i className="bi bi-x-circle text-danger me-2" />Rechazar pago
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Padre: <strong>{selectedPago?.padre?.nombres} {selectedPago?.padre?.apellidos}</strong> — S/ {Number(selectedPago?.monto ?? 0).toFixed(2)}
              </p>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Motivo del rechazo *
              </label>
              <textarea
                value={motivoRechazo}
                onChange={e => setMotivoRechazo(e.target.value)}
                className="sige-input"
                style={{ minHeight: 80, resize: 'vertical' }}
                placeholder="Explica el motivo del rechazo..."
              />
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button onClick={() => { setShowRechazo(false); setMotivoRechazo(''); }}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  Cancelar
                </button>
                <button onClick={rechazar} disabled={acting} className="btn-accent" style={{ background: '#ef4444' }}>
                  {acting ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-x-lg me-1" />Rechazar</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConceptos && (
          <ModalConceptos conceptos={conceptos} onCerrar={() => setShowConceptos(false)} onCambio={mutateConceptos} />
        )}
        {showGenerar && (
          <ModalGenerar conceptos={conceptos} onCerrar={() => setShowGenerar(false)} onGenerado={() => { mutate(); setShowGenerar(false); }} />
        )}
        {pagoParaMonto && (
          <ModalEditarMonto pago={pagoParaMonto} onCerrar={() => setPagoParaMonto(null)} onGuardado={() => { mutate(); setPagoParaMonto(null); }} />
        )}
        {voucherUrl && (
          <ModalVoucher url={voucherUrl} onCerrar={() => setVoucherUrl(null)} />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function ModalEditarMonto({ pago, onCerrar, onGuardado }: any) {
  const { loading, mutate: act } = useMutation();
  const [monto, setMonto] = useState(String(pago.monto));
  const [motivo, setMotivo] = useState('');

  const guardar = async () => {
    if (!motivo.trim() || motivo.trim().length < 3) { toast.error('Indica el motivo del ajuste'); return; }
    await act(async () => {
      await api.patch(`/pagos/${pago.id}/monto`, { monto: Number(monto), motivo });
      toast.success('Monto actualizado');
      onGuardado();
    });
  };

  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <motion.div className="sige-modal" style={{ maxWidth: 400 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.4rem', fontSize: '1rem' }}><i className="bi bi-pencil-square me-2" />Ajustar monto</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          {pago.estudiante ? `${pago.estudiante.nombres} ${pago.estudiante.apellidos}` : pago.padre?.nombres} — {pago.concepto?.nombre} · {pago.periodoPago}.
          Útil para descuento por hermanos, becas o convenios particulares.
        </p>
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nuevo monto (S/) *</label>
          <input type="number" min="0" step="0.10" value={monto} onChange={e => setMonto(e.target.value)} className="sige-input" autoFocus />
        </div>
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Motivo *</label>
          <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} className="sige-input" placeholder="Ej: Descuento 2do hermano" />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>Cancelar</button>
          <button onClick={guardar} disabled={loading} className="btn-accent">
            {loading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />Guardar</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const MESES_NOMBRE = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_ANO_ESCOLAR = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // marzo-diciembre

function ModalConceptos({ conceptos, onCerrar, onCambio }: any) {
  const { loading, mutate: act } = useMutation();
  const [nuevo, setNuevo] = useState({ nombre: '', tipo: 'PENSION', monto: '', nivelAplicable: '' });
  const [meses, setMeses] = useState<number[]>(MESES_ANO_ESCOLAR);

  const toggleMes = (m: number) => setMeses(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b));

  const crear = async () => {
    if (!nuevo.nombre.trim() || !nuevo.monto) { toast.error('Completa el nombre y el monto'); return; }
    if (!meses.length) { toast.error('Selecciona al menos un mes'); return; }
    await act(async () => {
      await api.post('/conceptos-pago', {
        ...nuevo, monto: Number(nuevo.monto),
        nivelAplicable: nuevo.nivelAplicable || null,
        mesesAplicables: meses,
      });
      toast.success('Concepto creado');
      setNuevo({ nombre: '', tipo: 'PENSION', monto: '', nivelAplicable: '' });
      setMeses(MESES_ANO_ESCOLAR);
      onCambio();
    });
  };

  const toggleActivo = async (id: string, activo: boolean) => {
    await api.patch(`/conceptos-pago/${id}/estado`, { activo: !activo });
    onCambio();
  };

  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <motion.div className="sige-modal" style={{ maxWidth: 480 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, margin: 0, fontSize: '1rem' }}><i className="bi bi-tags me-2" />Conceptos de pago</h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
        </div>

        <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: 8 }}>
          {conceptos.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Aún no has creado ningún concepto</div>
          ) : conceptos.map((c: any) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: c.activo ? 'var(--text-primary)' : 'var(--text-muted)' }}>{c.nombre}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {c.tipo} · S/ {Number(c.monto).toFixed(2)} · {c.nivelAplicable ? c.nivelAplicable : 'Todos los niveles'} · {(c.mesesAplicables ?? []).length === 12 ? 'Todo el año' : (c.mesesAplicables ?? []).map((m: number) => MESES_NOMBRE[m]).join(', ')}
                </div>
              </div>
              <button onClick={() => toggleActivo(c.id, c.activo)}
                style={{ fontSize: '0.72rem', fontWeight: 600, background: c.activo ? '#fee2e2' : '#d1fae5', color: c.activo ? '#991b1b' : '#065f46', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                {c.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>

        <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Nuevo concepto</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input type="text" value={nuevo.nombre} onChange={e => setNuevo(p => ({ ...p, nombre: e.target.value }))} className="sige-input" placeholder="Ej: Pensión mensual" />
          <select value={nuevo.tipo} onChange={e => setNuevo(p => ({ ...p, tipo: e.target.value }))} className="sige-input">
            {['PENSION','MATRICULA','MATERIALES','UNIFORME','OTRO'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input type="number" min="0" step="0.10" value={nuevo.monto} onChange={e => setNuevo(p => ({ ...p, monto: e.target.value }))} className="sige-input" placeholder="Monto (S/)" />
          <select value={nuevo.nivelAplicable} onChange={e => setNuevo(p => ({ ...p, nivelAplicable: e.target.value }))} className="sige-input">
            <option value="">Todos los niveles</option>
            <option value="INICIAL">Inicial</option>
            <option value="PRIMARIA">Primaria</option>
            <option value="SECUNDARIA">Secundaria</option>
          </select>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Meses en que se cobra (ej. la pensión suele ir de marzo a diciembre):</label>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {MESES_NOMBRE.slice(1).map((nombre, i) => {
              const m = i + 1;
              const activo = meses.includes(m);
              return (
                <button key={m} type="button" onClick={() => toggleMes(m)}
                  style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', border: activo ? 'none' : '1px solid var(--border-color)', background: activo ? 'var(--accent)' : 'var(--bg-card)', color: activo ? '#fff' : 'var(--text-secondary)' }}>
                  {nombre}
                </button>
              );
            })}
          </div>
        </div>
        <button onClick={crear} disabled={loading} className="btn-accent" style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-plus-lg me-1" />Crear concepto</>}
        </button>
      </motion.div>
    </motion.div>
  );
}

function ModalGenerar({ conceptos, onCerrar, onGenerado }: any) {
  const { loading, mutate: act } = useMutation();
  const [conceptoId, setConceptoId] = useState('');
  const ahora = new Date();
  const [periodo, setPeriodo] = useState(`${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`);

  const generar = async () => {
    if (!conceptoId) { toast.error('Selecciona un concepto'); return; }
    await act(async () => {
      const res: any = await api.post('/pagos/generar', { conceptoId, periodoPago: periodo });
      const n = res.data?.generados ?? 0;
      toast.success(n > 0 ? `Se generaron ${n} cargo(s) pendiente(s)` : (res.data?.mensaje || 'No había nada nuevo que generar'));
      onGenerado();
    });
  };

  const conceptosActivos = conceptos.filter((c: any) => c.activo);

  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <motion.div className="sige-modal" style={{ maxWidth: 420 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1rem' }}><i className="bi bi-calendar-plus me-2" />Generar cargo del mes</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Crea la deuda pendiente para todos los padres con un hijo matriculado. Cada padre podrá ver cuánto debe y subir su voucher.
        </p>
        {conceptosActivos.length === 0 ? (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Primero crea un concepto de pago (ej. "Pensión mensual") desde el botón "Conceptos de pago".
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Concepto *</label>
              <select value={conceptoId} onChange={e => setConceptoId(e.target.value)} className="sige-input">
                <option value="">Selecciona un concepto</option>
                {conceptosActivos.map((c: any) => <option key={c.id} value={c.id}>{c.nombre} — S/ {Number(c.monto).toFixed(2)}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Período (mes)</label>
              <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} className="sige-input" />
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>Cancelar</button>
          {conceptosActivos.length > 0 && (
            <button onClick={generar} disabled={loading} className="btn-accent">
              {loading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />Generar</>}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
