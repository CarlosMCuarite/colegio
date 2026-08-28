'use client';
// app/(dashboard)/padre/documentos/page.tsx
//
// Hub unificado: documentos formales, comprobantes de pago y comunicados.
// Cambios de esta vuelta:
//  - Los vouchers ahora se ven en un modal estilizado (ModalVoucher, el mismo
//    que ya usa Facturación) en vez de abrir la imagen cruda en pestaña nueva.
//  - Los comunicados ahora se pueden abrir y leer completos en un modal —
//    antes solo aparecía la fila, sin forma de ver el contenido.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import ModalVoucher from '../../../../components/ModalVoucher';
import { useData } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

type Filtro = 'TODOS' | 'DOCUMENTO' | 'PAGO' | 'COMUNICADO';

export default function DocumentosPadrePage() {
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null);
  const [comunicadoId, setComunicadoId] = useState<string | null>(null);

  const { data: docsData, isLoading: l1 } = useData<any>('/documentos?limit=30');
  const { data: pagosData, isLoading: l2 } = useData<any>('/pagos?limit=30');
  const { data: comData, isLoading: l3 } = useData<any>('/comunicados?limit=30');

  const isLoading = l1 || l2 || l3;
  const documentos = docsData?.data ?? [];
  const pagos = (pagosData?.data ?? []).filter((p: any) => p.voucherUrl || p.estado === 'APROBADO');
  const comunicados = comData?.data ?? [];

  const verVoucherPago = async (id: string) => {
    try {
      const res = await api.get(`/pagos/${id}/voucher-url`);
      setVoucherUrl(res.data.data.url);
    } catch {
      toast.error('No se pudo abrir el comprobante');
    }
  };

  type Item = { id: string; tipo: 'DOCUMENTO'|'PAGO'|'COMUNICADO'; fecha: string; titulo: string; sub: string; badge: { bg: string; text: string; label: string }; onClick?: () => void; href?: string };
  const items: Item[] = [
    ...documentos.map((d: any): Item => ({
      id: `doc-${d.id}`, tipo: 'DOCUMENTO', fecha: d.createdAt, titulo: d.nombre, sub: d.tipo,
      badge: d.estado === 'LISTO' || d.estado === 'ENTREGADO'
        ? { bg: '#d1fae5', text: '#065f46', label: d.estado === 'ENTREGADO' ? 'Entregado' : 'Listo' }
        : { bg: '#fef3c7', text: '#92400e', label: 'En proceso' },
      href: d.archivoUrl ?? undefined,
    })),
    ...pagos.map((p: any): Item => ({
      id: `pago-${p.id}`, tipo: 'PAGO', fecha: p.createdAt,
      titulo: `Pago — ${p.concepto?.nombre ?? p.tipo}`,
      sub: `S/ ${Number(p.monto).toFixed(2)} · ${p.estudiante?.nombres ?? ''} ${p.estudiante?.apellidos ?? ''}`,
      badge: p.estado === 'APROBADO' ? { bg: '#d1fae5', text: '#065f46', label: 'Aprobado' } : { bg: '#dbeafe', text: '#1e40af', label: 'En revisión' },
      onClick: p.voucherUrl ? () => verVoucherPago(p.id) : undefined,
    })),
    ...comunicados.map((c: any): Item => ({
      id: `com-${c.id}`, tipo: 'COMUNICADO', fecha: c.publicadoEn ?? c.createdAt,
      titulo: c.titulo, sub: c.paraElColegio ? 'Para todo el colegio' : 'Del aula de tu hijo(a)',
      badge: { bg: '#ede9fe', text: '#6d28d9', label: 'Comunicado' },
      onClick: () => setComunicadoId(c.id),
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const filtrados = filtro === 'TODOS' ? items : items.filter(i => i.tipo === filtro);
  const ICONOS: Record<string, string> = { DOCUMENTO: 'bi-file-earmark-text', PAGO: 'bi-cash-stack', COMUNICADO: 'bi-megaphone' };

  return (
    <DashboardLayout title="Mis Documentos" allowedRoles={['PADRE']}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {(['TODOS','DOCUMENTO','PAGO','COMUNICADO'] as Filtro[]).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ padding: '0.4rem 0.9rem', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
              background: filtro === f ? 'var(--accent)' : 'var(--bg-card)', color: filtro === f ? '#fff' : 'var(--text-secondary)' }}>
            {f === 'TODOS' ? 'Todos' : f === 'DOCUMENTO' ? 'Documentos' : f === 'PAGO' ? 'Comprobantes de pago' : 'Comunicados'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
      ) : filtrados.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-folder2" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />Nada por aquí todavía
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {filtrados.map(item => (
            <div key={item.id} className="sige-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div
                onClick={item.onClick}
                style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', minWidth: 0, cursor: item.onClick ? 'pointer' : 'default', flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`bi ${ICONOS[item.tipo]}`} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.titulo}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.sub} · {new Date(item.fecha).toLocaleDateString('es-PE')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, background: item.badge.bg, color: item.badge.text, padding: '3px 9px', borderRadius: 99 }}>{item.badge.label}</span>
                {item.href && <a href={item.href} target="_blank" rel="noreferrer" className="btn-accent" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}><i className="bi bi-download me-1" />Ver</a>}
                {item.tipo === 'PAGO' && item.onClick && <button onClick={item.onClick} className="btn-accent" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}><i className="bi bi-eye me-1" />Ver voucher</button>}
                {item.tipo === 'COMUNICADO' && <button onClick={item.onClick} className="btn-accent" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}><i className="bi bi-eye me-1" />Leer</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {voucherUrl && <ModalVoucher url={voucherUrl} onCerrar={() => setVoucherUrl(null)} />}
        {comunicadoId && <ModalComunicado id={comunicadoId} onCerrar={() => setComunicadoId(null)} />}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function ModalComunicado({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  const { data, isLoading } = useData<any>(`/comunicados/${id}`);
  const c = data?.data;
  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <motion.div className="sige-modal" style={{ maxWidth: 520 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        {isLoading || !c ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner-border spinner-border-sm" /></div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 99 }}>
                  <i className="bi bi-megaphone me-1" />{c.paraElColegio ? 'Todo el colegio' : 'Aula de tu hijo(a)'}
                </span>
                <h3 style={{ fontWeight: 700, fontSize: '1.05rem', margin: '0.5rem 0 0' }}>{c.titulo}</h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {new Date(c.publicadoEn ?? c.createdAt).toLocaleString('es-PE')}
                  {c.creadoPor && ` · ${c.creadoPor.nombres} ${c.creadoPor.apellidos}`}
                </div>
              </div>
              <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{c.contenido}</p>
            {c.archivoUrl && (
              <a href={c.archivoUrl} target="_blank" rel="noreferrer" className="btn-accent" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '0.5rem' }}>
                <i className="bi bi-paperclip me-1" />Ver archivo adjunto
              </a>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
