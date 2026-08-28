'use client';
// app/(dashboard)/superadmin/facturacion/page.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import ModalVoucher from '../../../../components/ModalVoucher';
import { usePagosLicencia, useConfigPlataforma, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';
import { QrUploader } from '../../../../components/QrUploader';

const ESTADO_CONF: Record<string, any> = {
  PENDIENTE:   { bg: '#fef3c7', text: '#92400e', label: 'Pendiente' },
  EN_REVISION: { bg: '#dbeafe', text: '#1e40af', label: 'En revisión' },
  APROBADO:    { bg: '#d1fae5', text: '#065f46', label: 'Aprobado' },
  RECHAZADO:   { bg: '#fee2e2', text: '#991b1b', label: 'Rechazado' },
};

export default function FacturacionSuperadminPage() {
  const [tab, setTab] = useState<'pagos' | 'config'>('pagos');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const { data, mutate } = usePagosLicencia(`estado=${estadoFiltro}`);
  const { data: configData, mutate: mutateConfig } = useConfigPlataforma();
  const { loading, mutate: act } = useMutation();
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState<{ id: string; motivo: string } | null>(null);

  const pagos = (data as any)?.data ?? [];
  const config = (configData as any)?.data ?? {};

  const [form, setForm] = useState<any>(null);
  // BUG REAL: antes el efecto disparaba sobre `config` (que ya venía con un
  // `?? {}` de respaldo) — eso significa que en el PRIMER render, antes de
  // que la petición real llegara, `config` ya era un objeto vacío truthy, así
  // que `setForm({})` se ejecutaba de inmediato. Como el guard era `!form`,
  // una vez que `form` quedaba en `{}`, el efecto nunca se volvía a disparar
  // — así que cuando los datos REALES de Supabase llegaban un instante
  // después, el formulario se quedaba vacío para siempre. Ahora se dispara
  // sobre `configData` (el dato crudo de SWR, que es `undefined` hasta que
  // de verdad responde el backend), no sobre el objeto ya "rellenado".
  useEffect(() => { if (configData && !form) setForm(config); }, [configData]);

  const guardarConfig = async () => {
    await act(async () => {
      await api.patch('/plataforma/config', form);
      toast.success('Configuración de pago actualizada');
      mutateConfig();
    });
  };

  const subirQrPlataforma = async (tipo: 'yape' | 'plin' | 'banco', file: File) => {
    await act(async () => {
      const fd = new FormData();
      fd.append('imagen', file);
      fd.append('tipo', tipo);
      await api.post('/plataforma/config/qr', fd);
      toast.success('QR actualizado');
      mutateConfig();
    });
  };

  const verVoucher = async (id: string) => {
    try {
      const res = await api.get(`/pagos-licencia/${id}/voucher-url`);
      setVoucherUrl(res.data.data.url);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo abrir el voucher');
    }
  };

  const aprobar = async (id: string) => {
    await act(async () => {
      await api.patch(`/pagos-licencia/${id}/aprobar`);
      toast.success('Pago aprobado — la licencia se extendió 30 días');
      mutate();
    });
  };

  const rechazar = async () => {
    if (!motivoRechazo?.motivo.trim()) { toast.error('Indica el motivo'); return; }
    await act(async () => {
      await api.patch(`/pagos-licencia/${motivoRechazo.id}/rechazar`, { motivo: motivoRechazo.motivo });
      toast.success('Pago rechazado');
      setMotivoRechazo(null);
      mutate();
    });
  };

  return (
    <DashboardLayout title="Facturación / Pagos del SaaS" allowedRoles={['SUPERADMIN']}>
      <div className="sige-card" style={{ display: 'flex', padding: 6, marginBottom: '1.25rem', gap: 4, maxWidth: 420 }}>
        {[{ id: 'pagos', label: 'Pagos de colegios', icon: 'bi-receipt' }, { id: 'config', label: 'Datos de cobro', icon: 'bi-qr-code' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ flex: 1, padding: '0.55rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
              background: tab === t.id ? 'var(--accent)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--text-secondary)' }}>
            <i className={`bi ${t.icon} me-2`} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'config' && form && (
        <div className="sige-card" style={{ maxWidth: 560 }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}><i className="bi bi-qr-code me-2" />Datos de cobro de la plataforma</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Esto es lo que ven los administradores de cada colegio para pagar su suscripción a SIGE — no confundir con los datos de pago del colegio (esos son para que los padres paguen pensiones).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div><label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Número Yape</label><input className="sige-input" value={form.yapeNumero ?? ''} onChange={e => setForm((f: any) => ({ ...f, yapeNumero: e.target.value }))} /></div>
              <div><label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Titular Yape</label><input className="sige-input" value={form.yapeTitular ?? ''} onChange={e => setForm((f: any) => ({ ...f, yapeTitular: e.target.value }))} /></div>
            </div>
            <QrUploader label="QR de Yape (opcional)" urlActual={config.yapeQrUrl} onSubir={file => subirQrPlataforma('yape', file)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div><label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Número Plin</label><input className="sige-input" value={form.plinNumero ?? ''} onChange={e => setForm((f: any) => ({ ...f, plinNumero: e.target.value }))} /></div>
              <div><label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Titular Plin</label><input className="sige-input" value={form.plinTitular ?? ''} onChange={e => setForm((f: any) => ({ ...f, plinTitular: e.target.value }))} /></div>
            </div>
            <QrUploader label="QR de Plin (opcional)" urlActual={config.plinQrUrl} onSubir={file => subirQrPlataforma('plin', file)} />
            <div><label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Banco</label><input className="sige-input" value={form.bancoNombre ?? ''} onChange={e => setForm((f: any) => ({ ...f, bancoNombre: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div><label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>N° de cuenta</label><input className="sige-input" value={form.cuentaBancaria ?? ''} onChange={e => setForm((f: any) => ({ ...f, cuentaBancaria: e.target.value }))} /></div>
              <div><label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>CCI</label><input className="sige-input" value={form.cuentaBancariaCCI ?? ''} onChange={e => setForm((f: any) => ({ ...f, cuentaBancariaCCI: e.target.value }))} /></div>
            </div>
            <QrUploader label="QR del banco (opcional)" urlActual={config.bancoQrUrl} onSubir={file => subirQrPlataforma('banco', file)} />
          </div>
          <button onClick={guardarConfig} disabled={loading} className="btn-accent" style={{ marginTop: '1.25rem', width: '100%', justifyContent: 'center', padding: '0.6rem' }}>
            {loading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />Guardar</>}
          </button>
        </div>
      )}

      {tab === 'pagos' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {['', 'EN_REVISION', 'PENDIENTE', 'APROBADO', 'RECHAZADO'].map(e => (
              <button key={e} onClick={() => setEstadoFiltro(e)}
                style={{ padding: '0.4rem 1rem', borderRadius: 99, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                  background: estadoFiltro === e ? 'var(--accent)' : 'var(--bg-card)', color: estadoFiltro === e ? '#fff' : 'var(--text-secondary)',
                  border: estadoFiltro === e ? 'none' : '1px solid var(--border-color)' } as any}>
                {e === '' ? 'Todos' : ESTADO_CONF[e]?.label ?? e}
              </button>
            ))}
          </div>

          <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="sige-table">
                <thead><tr><th>Colegio</th><th>Monto</th><th>Período</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
                <tbody>
                  {pagos.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin pagos de suscripción todavía</td></tr>
                  ) : pagos.map((p: any) => {
                    const conf = ESTADO_CONF[p.estado] ?? {};
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.colegio?.nombre}</td>
                        <td style={{ fontWeight: 700, color: '#059669' }}>S/ {Number(p.monto).toFixed(2)}</td>
                        <td>{p.periodoPago ?? '—'}</td>
                        <td><span className="estado-badge" style={{ background: conf.bg, color: conf.text }}>{conf.label}</span></td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString('es-PE')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {p.voucherUrl && (
                              <button onClick={() => verVoucher(p.id)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-secondary)', cursor: 'pointer' }} title="Ver voucher"><i className="bi bi-image" /></button>
                            )}
                            {p.estado === 'EN_REVISION' && (
                              <>
                                <button onClick={() => aprobar(p.id)} disabled={loading} style={{ background: '#d1fae5', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#065f46', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}><i className="bi bi-check2 me-1" />Aprobar</button>
                                <button onClick={() => setMotivoRechazo({ id: p.id, motivo: '' })} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#991b1b', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}><i className="bi bi-x me-1" />Rechazar</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {voucherUrl && <ModalVoucher url={voucherUrl} onCerrar={() => setVoucherUrl(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {motivoRechazo && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setMotivoRechazo(null); }}>
            <motion.div className="sige-modal" style={{ maxWidth: 380 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem' }}>Motivo del rechazo</h3>
              <textarea className="sige-input" rows={3} value={motivoRechazo.motivo} onChange={e => setMotivoRechazo(m => m && ({ ...m, motivo: e.target.value }))} placeholder="Ej: El monto no coincide" />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button onClick={() => setMotivoRechazo(null)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={rechazar} disabled={loading} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }}>Rechazar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
