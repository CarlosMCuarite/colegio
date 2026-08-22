'use client';
import { useState, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { usePagos, useMutation, useData } from '@/hooks/useApi';
import ModalVoucher from '@/components/ModalVoucher';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const ESTADO_CONF: Record<string, { bg: string; text: string; label: string }> = {
  PENDIENTE:   { bg: '#fef3c7', text: '#92400e', label: 'Pendiente'   },
  EN_REVISION: { bg: '#dbeafe', text: '#1e40af', label: 'En revisión' },
  APROBADO:    { bg: '#d1fae5', text: '#065f46', label: 'Aprobado'    },
  RECHAZADO:   { bg: '#fee2e2', text: '#991b1b', label: 'Rechazado'   },
};

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function formatPeriodo(periodo?: string) {
  if (!periodo) return '';
  const [anio, mes] = periodo.split('-').map(Number);
  return mes ? `${MESES[mes]} ${anio}` : periodo;
}

export default function PagosPadrePage() {
  const { data, isLoading, mutate } = usePagos();
  const { data: colegioData } = useData<any>('/colegios');
  const colegio = colegioData?.data;
  const { loading: saving, mutate: save } = useMutation();
  const [showModal, setShowModal] = useState(false);
  const [pagoParaVoucher, setPagoParaVoucher] = useState<any>(null);
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null);
  const pagos = (data as any)?.data ?? [];
  const totalDeuda = pagos.filter((p: any) => ['PENDIENTE','EN_REVISION'].includes(p.estado)).reduce((s: number, p: any) => s + Number(p.monto), 0);
  const pendientesSinVoucher = pagos.filter((p: any) => ['PENDIENTE','RECHAZADO'].includes(p.estado));
  const tieneDatosPago = colegio && (colegio.yapeNumero || colegio.plinNumero || colegio.cuentaBancaria);

  const verVoucher = async (id: string) => {
    try {
      const res = await api.get(`/pagos/${id}/voucher-url`);
      setVoucherUrl(res.data.data.url);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo abrir el voucher');
    }
  };

  const subirVoucher = async (form: any, file: File | null) => {
    await save(async () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, String(v)); });
      if (file) fd.append('voucher', file);
      await api.post('/pagos', fd);
      toast.success('Voucher enviado — en revisión');
      mutate(); setShowModal(false);
    });
  };

  const subirVoucherCargo = async (pagoId: string, banco: string, operacion: string, file: File) => {
    await save(async () => {
      const fd = new FormData();
      fd.append('voucher', file);
      if (banco) fd.append('banco', banco);
      if (operacion) fd.append('operacion', operacion);
      await api.patch(`/pagos/${pagoId}/subir-voucher`, fd);
      toast.success('Voucher enviado — en revisión');
      mutate(); setPagoParaVoucher(null);
    });
  };

  return (
    <DashboardLayout title="Mis Pagos" allowedRoles={['PADRE']}>
      {/* Cómo pagar — datos que configuró el colegio */}
      {tieneDatosPago && (
        <div className="sige-card" style={{ marginBottom: '1rem', background: 'linear-gradient(135deg, #f5f3ff, #eff6ff)' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', margin: '0 0 0.75rem' }}><i className="bi bi-wallet2 me-2" />¿Dónde pagar?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {colegio.yapeNumero && (
              <div style={{ background: '#fff', borderRadius: 10, padding: '0.9rem', textAlign: 'center' }}>
                {colegio.yapeQrUrl && <img src={colegio.yapeQrUrl} alt="QR Yape" style={{ width: 150, height: 150, borderRadius: 10, objectFit: 'contain', border: '1px solid var(--border-color)', padding: 6, marginBottom: '0.5rem' }} />}
                <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700 }}><i className="bi bi-phone me-1" />YAPE</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{colegio.yapeNumero}</div>
                {colegio.yapeTitular && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{colegio.yapeTitular}</div>}
              </div>
            )}
            {colegio.plinNumero && (
              <div style={{ background: '#fff', borderRadius: 10, padding: '0.9rem', textAlign: 'center' }}>
                {colegio.plinQrUrl && <img src={colegio.plinQrUrl} alt="QR Plin" style={{ width: 150, height: 150, borderRadius: 10, objectFit: 'contain', border: '1px solid var(--border-color)', padding: 6, marginBottom: '0.5rem' }} />}
                <div style={{ fontSize: '0.72rem', color: '#00a3d1', fontWeight: 700 }}><i className="bi bi-phone me-1" />PLIN</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{colegio.plinNumero}</div>
                {colegio.plinTitular && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{colegio.plinTitular}</div>}
              </div>
            )}
            {colegio.cuentaBancaria && (
              <div style={{ background: '#fff', borderRadius: 10, padding: '0.9rem', textAlign: 'center' }}>
                {colegio.bancoQrUrl && <img src={colegio.bancoQrUrl} alt="QR banco" style={{ width: 150, height: 150, borderRadius: 10, objectFit: 'contain', border: '1px solid var(--border-color)', padding: 6, marginBottom: '0.5rem' }} />}
                <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}><i className="bi bi-bank me-1" />{colegio.bancoNombre || 'BANCO'}</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{colegio.cuentaBancaria}</div>
                {colegio.cuentaBancariaCCI && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CCI: {colegio.cuentaBancariaCCI}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        {totalDeuda > 0 && (
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#92400e', fontWeight: 600 }}>
            <i className="bi bi-exclamation-triangle me-2" />Total pendiente: <strong>S/ {totalDeuda.toFixed(2)}</strong>
          </div>
        )}
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          <i className="bi bi-upload me-1" />Subir otro comprobante
        </button>
      </div>

      {/* Cargos pendientes de pago — cada uno con su propio botón de subir voucher */}
      {pendientesSinVoucher.length > 0 && (
        <div className="sige-card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', margin: '0 0 0.75rem' }}><i className="bi bi-cash-coin me-2" />Pagos por realizar</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {pendientesSinVoucher.map((p: any) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.6rem 0.875rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.concepto?.nombre ?? p.tipo} {p.periodoPago ? `— ${formatPeriodo(p.periodoPago)}` : ''}</div>
                  {p.estudiante && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}><i className="bi bi-mortarboard me-1" />{p.estudiante.nombres} {p.estudiante.apellidos}</div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    S/ {Number(p.monto).toFixed(2)}
                    {p.estado === 'RECHAZADO' && <span style={{ color: '#991b1b', fontWeight: 600 }}> · Rechazado{p.observaciones ? `: ${p.observaciones}` : ''}</span>}
                  </div>
                </div>
                <button onClick={() => setPagoParaVoucher(p)} className="btn-accent" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
                  <i className="bi bi-upload me-1" />Subir voucher
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead><tr><th>Concepto</th><th>Monto</th><th>Período</th><th>Estado</th><th>Fecha</th><th>Voucher</th></tr></thead>
              <tbody>
                {pagos.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin pagos registrados</td></tr>
                ) : pagos.map((p: any, i: number) => {
                  const conf = ESTADO_CONF[p.estado] ?? ESTADO_CONF.PENDIENTE;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.concepto?.nombre ?? p.tipo}</td>
                      <td style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem' }}>S/ {Number(p.monto).toFixed(2)}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{formatPeriodo(p.periodoPago) || '—'}</td>
                      <td><span className="estado-badge" style={{ background: conf.bg, color: conf.text }}>{conf.label}</span></td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString('es-PE')}</td>
                      <td>{p.voucherUrl && <button onClick={() => verVoucher(p.id)} style={{ color: 'var(--accent)', fontSize: '0.82rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><i className="bi bi-image me-1" />Ver</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div className="sige-modal" style={{ maxWidth: 440 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <VoucherForm onGuardar={subirVoucher} onCancelar={() => setShowModal(false)} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pagoParaVoucher && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setPagoParaVoucher(null); }}>
            <motion.div className="sige-modal" style={{ maxWidth: 420 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <ModalSubirVoucherCargo pago={pagoParaVoucher} onGuardar={subirVoucherCargo} onCancelar={() => setPagoParaVoucher(null)} saving={saving} />
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

function ModalSubirVoucherCargo({ pago, onGuardar, onCancelar, saving }: any) {
  const [banco, setBanco] = useState('');
  const [operacion, setOperacion] = useState('');
  const [file, setFile] = useState<File | null>(null);

  return (
    <form onSubmit={e => { e.preventDefault(); if (!file) { toast.error('Adjunta la foto del voucher'); return; } onGuardar(pago.id, banco, operacion, file); }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Subir Voucher</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.6rem 0.875rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{pago.concepto?.nombre ?? pago.tipo} {pago.periodoPago ? `— ${formatPeriodo(pago.periodoPago)}` : ''}</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#059669' }}>S/ {Number(pago.monto).toFixed(2)}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Banco</label>
            <input type="text" value={banco} onChange={e => setBanco(e.target.value)} className="sige-input" placeholder="BCP, Interbank..." />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>N° Operación</label>
            <input type="text" value={operacion} onChange={e => setOperacion(e.target.value)} className="sige-input" />
          </div>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Foto del voucher *</label>
          <div onClick={() => document.getElementById('voucher-cargo-input')?.click()}
            style={{ border: '2px dashed var(--border-color)', borderRadius: 8, padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-secondary)' }}>
            {file ? (
              <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.875rem' }}><i className="bi bi-check-circle me-1" />{file.name}</div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}><i className="bi bi-cloud-upload" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 6 }} />Click para adjuntar imagen</div>
            )}
            <input id="voucher-cargo-input" type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Enviando...</> : <><i className="bi bi-upload me-1" />Enviar comprobante</>}
        </button>
      </div>
    </form>
  );
}

function VoucherForm({ onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({ tipo: 'PENSION', monto: '', periodoPago: '', banco: '', operacion: '' });
  const [file, setFile] = useState<File | null>(null);
  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onGuardar(form, file); }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Subir Comprobante de Pago</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Tipo de pago *</label>
          <select value={form.tipo} onChange={set('tipo')} required className="sige-input">
            {['MATRICULA','PENSION','CONCEPTO_ESPECIAL','OTRO'].map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Monto (S/) *</label>
            <input type="number" value={form.monto} onChange={set('monto')} required step="0.01" min="0" className="sige-input" placeholder="0.00" />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Período</label>
            <input type="month" value={form.periodoPago} onChange={set('periodoPago')} className="sige-input" />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Banco</label>
            <input type="text" value={form.banco} onChange={set('banco')} className="sige-input" placeholder="BCP, Interbank..." />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>N° Operación</label>
            <input type="text" value={form.operacion} onChange={set('operacion')} className="sige-input" />
          </div>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Foto del voucher</label>
          <div onClick={() => document.getElementById('voucher-input')?.click()}
            style={{ border: '2px dashed var(--border-color)', borderRadius: 8, padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-secondary)' }}>
            {file ? (
              <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.875rem' }}><i className="bi bi-check-circle me-1" />{file.name}</div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}><i className="bi bi-cloud-upload" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 6 }} />Click para adjuntar imagen</div>
            )}
            <input id="voucher-input" type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Enviando...</> : <><i className="bi bi-upload me-1" />Enviar comprobante</>}
        </button>
      </div>
    </form>
  );
}
