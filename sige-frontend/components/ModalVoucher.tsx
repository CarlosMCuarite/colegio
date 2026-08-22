'use client';
// components/ModalVoucher.tsx
// Muestra el comprobante de pago (voucher) en un modal, en vez de abrir una
// pestaña nueva. Todos los vouchers se guardan como imagen web (jpg/png/webp)
// por la limitación de la base de datos, así que siempre se puede mostrar
// directo con <img>.
import { motion } from 'framer-motion';

interface Props {
  url: string;
  onCerrar: () => void;
}

export default function ModalVoucher({ url, onCerrar }: Props) {
  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <motion.div className="sige-modal" style={{ maxWidth: 480, padding: '1rem' }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}><i className="bi bi-receipt me-2" />Comprobante de pago</h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
        </div>
        <img src={url} alt="Voucher" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border-color)', display: 'block' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
          <a href={url} target="_blank" rel="noreferrer" className="btn-accent" style={{ textDecoration: 'none' }}>
            <i className="bi bi-arrows-fullscreen me-1" />Abrir en pestaña nueva
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
