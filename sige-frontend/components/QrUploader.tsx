'use client';
// components/QrUploader.tsx
// Widget para subir/reemplazar/ver el QR de un método de pago. Se usa tanto
// en la Configuración del colegio (Yape/Plin/Banco para que paguen los
// padres) como en SuperAdmin → Facturación (para que paguen los colegios su
// licencia de SIGE).
import { useRef } from 'react';

export function QrUploader({ label, urlActual, onSubir }: { label: string; urlActual?: string | null; onSubir: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', background: 'var(--bg-secondary)', borderRadius: 10, padding: '0.75rem 0.9rem' }}>
      {urlActual ? (
        <img src={urlActual} alt="QR" style={{ width: 96, height: 96, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border-color)', background: '#fff', padding: 4 }} />
      ) : (
        <div style={{ width: 96, height: 96, borderRadius: 8, border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '1.5rem' }}>
          <i className="bi bi-qr-code" />
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{urlActual ? 'Toca para reemplazar' : 'Sin imagen — opcional'}</div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onSubir(f); }} />
      <button type="button" onClick={() => inputRef.current?.click()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '0.45rem 0.85rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
        <i className="bi bi-upload me-1" />{urlActual ? 'Cambiar' : 'Subir'}
      </button>
    </div>
  );
}
