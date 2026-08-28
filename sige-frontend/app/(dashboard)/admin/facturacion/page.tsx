'use client';
// app/(dashboard)/admin/facturacion/page.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import ModalVoucher from '../../../../components/ModalVoucher';
import { usePagosLicencia, useConfigPlataforma, useMutation, useData } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const ESTADO_CONF: Record<string, any> = {
  PENDIENTE:   { bg: '#fef3c7', text: '#92400e', label: 'Pendiente' },
  EN_REVISION: { bg: '#dbeafe', text: '#1e40af', label: 'En revisión' },
  APROBADO:    { bg: '#d1fae5', text: '#065f46', label: 'Aprobado' },
  RECHAZADO:   { bg: '#fee2e2', text: '#991b1b', label: 'Rechazado' },
};

export default function FacturacionAdminPage() {
  const { data: colegioData } = useData<any>('/colegios');
  const { data: configData } = useConfigPlataforma();
  const { data, mutate } = usePagosLicencia();
  const { loading, mutate: act } = useMutation();
  const [showPago, setShowPago] = useState(false);
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null);

  const colegio = (colegioData as any)?.data;
  const config  = (configData as any)?.data ?? {};
  const pagos   = (data as any)?.data ?? [];

  const licenciaFin = colegio?.licenciaFin ? new Date(colegio.licenciaFin) : null;
  const diasRestantes = licenciaFin ? Math.ceil((licenciaFin.getTime() - Date.now()) / 86400000) : null;
  const vencida = diasRestantes !== null && diasRestantes < 0;
  const porVencer = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 10;

  const verVoucher = async (id: string) => {
    try {
      const res = await api.get(`/pagos-licencia/${id}/voucher-url`);
      setVoucherUrl(res.data.data.url);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo abrir el voucher');
    }
  };

  return (
    <DashboardLayout title="Facturación" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR']}>
      {/* Estado de la licencia */}
      <div className="sige-card" style={{
        marginBottom: '1.25rem', borderLeft: `4px solid ${vencida ? '#ef4444' : porVencer ? '#f59e0b' : '#10b981'}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
      }}>
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Estado de tu suscripción</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: vencida ? '#ef4444' : porVencer ? '#f59e0b' : '#10b981' }}>
            {vencida ? 'Vencida' : porVencer ? `Vence en ${diasRestantes} días` : 'Al día'}
          </div>
          {licenciaFin && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Vigente hasta el {licenciaFin.toLocaleDateString('es-PE')}</div>
          )}
          {colegio?.plan?.nombre && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Plan: {colegio.plan.nombre}</div>}
        </div>
        <button onClick={() => setShowPago(true)} className="btn-accent">
          <i className="bi bi-upload me-1" />Registrar pago de suscripción
        </button>
      </div>

      {/* Dónde pagar */}
      <div className="sige-card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}><i className="bi bi-qr-code me-2" />¿Dónde pagar?</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.875rem' }}>
          {config.yapeNumero && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '1rem', textAlign: 'center' }}>
              {config.yapeQrUrl && <img src={config.yapeQrUrl} alt="QR Yape" style={{ width: 160, height: 160, borderRadius: 10, objectFit: 'contain', background: '#fff', border: '1px solid var(--border-color)', padding: 6, marginBottom: '0.6rem' }} />}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}><i className="bi bi-phone me-1" />YAPE</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{config.yapeNumero}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{config.yapeTitular}</div>
            </div>
          )}
          {config.plinNumero && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '1rem', textAlign: 'center' }}>
              {config.plinQrUrl && <img src={config.plinQrUrl} alt="QR Plin" style={{ width: 160, height: 160, borderRadius: 10, objectFit: 'contain', background: '#fff', border: '1px solid var(--border-color)', padding: 6, marginBottom: '0.6rem' }} />}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}><i className="bi bi-phone me-1" />PLIN</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{config.plinNumero}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{config.plinTitular}</div>
            </div>
          )}
          {config.bancoNombre && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '1rem', textAlign: 'center' }}>
              {config.bancoQrUrl && <img src={config.bancoQrUrl} alt="QR banco" style={{ width: 160, height: 160, borderRadius: 10, objectFit: 'contain', background: '#fff', border: '1px solid var(--border-color)', padding: 6, marginBottom: '0.6rem' }} />}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}><i className="bi bi-bank me-1" />{config.bancoNombre}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{config.cuentaBancaria}</div>
              {config.cuentaBancariaCCI && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CCI: {config.cuentaBancariaCCI}</div>}
            </div>
          )}
          {!config.yapeNumero && !config.plinNumero && !config.bancoNombre && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>El administrador de la plataforma aún no configuró sus datos de cobro.</div>
          )}
        </div>
      </div>

      {/* Historial */}
      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="sige-table">
            <thead><tr><th>Monto</th><th>Período</th><th>Estado</th><th>Fecha</th><th>Voucher</th></tr></thead>
            <tbody>
              {pagos.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin pagos registrados todavía</td></tr>
              ) : pagos.map((p: any) => {
                const conf = ESTADO_CONF[p.estado] ?? {};
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, color: '#059669' }}>S/ {Number(p.monto).toFixed(2)}</td>
                    <td>{p.periodoPago ?? '—'}</td>
                    <td><span className="estado-badge" style={{ background: conf.bg, color: conf.text }}>{conf.label}</span>
                      {p.estado === 'RECHAZADO' && p.observaciones && <div style={{ fontSize: '0.7rem', color: '#991b1b' }}>{p.observaciones}</div>}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString('es-PE')}</td>
                    <td>{p.voucherUrl && <button onClick={() => verVoucher(p.id)} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem' }}><i className="bi bi-image me-1" />Ver</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showPago && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowPago(false); }}>
            <motion.div className="sige-modal" style={{ maxWidth: 420 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <FormPago onCerrar={() => setShowPago(false)} onGuardado={() => { mutate(); setShowPago(false); }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {voucherUrl && <ModalVoucher url={voucherUrl} onCerrar={() => setVoucherUrl(null)} />}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function FormPago({ onCerrar, onGuardado }: any) {
  const { loading, mutate: act } = useMutation();
  const [monto, setMonto] = useState('');
  const [periodoPago, setPeriodoPago] = useState('');
  const [banco, setBanco] = useState('');
  const [operacion, setOperacion] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto) { toast.error('Ingresa el monto'); return; }
    await act(async () => {
      const fd = new FormData();
      fd.append('monto', monto);
      if (periodoPago) fd.append('periodoPago', periodoPago);
      if (banco) fd.append('banco', banco);
      if (operacion) fd.append('operacion', operacion);
      if (file) fd.append('voucher', file);
      await api.post('/pagos-licencia', fd);
      toast.success('Pago registrado — quedará en revisión');
      onGuardado();
    });
  };

  return (
    <form onSubmit={submit}>
      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem' }}><i className="bi bi-upload me-2" />Registrar pago de suscripción</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div><label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Monto pagado (S/) *</label><input type="number" step="0.10" className="sige-input" value={monto} onChange={e => setMonto(e.target.value)} required /></div>
        <div><label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Período (opcional)</label><input type="month" className="sige-input" value={periodoPago} onChange={e => setPeriodoPago(e.target.value)} /></div>
        <div><label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>N° de operación (opcional)</label><input type="text" className="sige-input" value={operacion} onChange={e => setOperacion(e.target.value)} /></div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Voucher (imagen)</label>
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} className="sige-input" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCerrar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancelar</button>
        <button type="submit" disabled={loading} className="btn-accent">{loading ? <span className="spinner-border spinner-border-sm" /> : 'Enviar'}</button>
      </div>
    </form>
  );
}
