'use client';
// app/(dashboard)/padre/hijos/page.tsx
import { useState, useRef } from 'react';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useDashboardPadre } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

export default function MisHijosPage() {
  const { data, isLoading, mutate } = useDashboardPadre();
  // Bug real encontrado: esta página leía `data.estudiantes`, pero la respuesta
  // real del backend es `{ ok:true, data: { estudiantes:[...], ... } }` — un
  // nivel más anidado. Por eso SIEMPRE salía vacío aunque el hijo ya estuviera
  // vinculado (la página de Inicio sí lo hacía bien con `data.data.estudiantes`,
  // por eso ahí sí aparecía).
  const estudiantes = (data as any)?.data?.estudiantes ?? [];

  return (
    <DashboardLayout title="Mis Hijos" allowedRoles={['PADRE']}>
      {isLoading ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <span className="spinner-border spinner-border-sm me-2" />Cargando...
        </div>
      ) : estudiantes.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-person-x" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
          No tienes hijos vinculados a tu cuenta todavía.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {estudiantes.map((est: any) => (
            <TarjetaHijo key={est.id} estudiante={est} onActualizado={() => mutate()} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

function TarjetaHijo({ estudiante, onActualizado }: { estudiante: any; onActualizado: () => void }) {
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('foto', file);
      await api.post(`/estudiantes/${estudiante.id}/foto`, fd);
      toast.success('Foto actualizada — se usará en el carnet de tu hijo/a');
      onActualizado();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo subir la foto');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="sige-card">
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => inputRef.current?.click()} disabled={subiendo} title="Cambiar foto"
          style={{
            width: 76, height: 76, borderRadius: 12, flexShrink: 0, position: 'relative', border: 'none', cursor: 'pointer', padding: 0, overflow: 'hidden',
            background: estudiante.fotoUrl ? `url(${estudiante.fotoUrl}) center/cover` : 'var(--accent-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)',
          }}>
          {!estudiante.fotoUrl && `${estudiante.nombres?.[0] ?? ''}${estudiante.apellidos?.[0] ?? ''}`}
          <span style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-card)' }}>
            {subiendo ? <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10, borderWidth: 1 }} /> : <i className="bi bi-camera-fill" style={{ fontSize: 10, color: '#fff' }} />}
          </span>
          <input ref={inputRef} type="file" accept="image/*" onChange={subirFoto} style={{ display: 'none' }} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{estudiante.nombres} {estudiante.apellidos}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {estudiante.matriculas?.[0]?.nivelGrado?.nombre ?? 'Sin matrícula'}
            {estudiante.matriculas?.[0]?.seccion?.nombre ? ` — Sección ${estudiante.matriculas[0].seccion.nombre}` : ''}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>DNI: {estudiante.dni}</div>
        </div>
      </div>

      <button onClick={() => inputRef.current?.click()} disabled={subiendo}
        style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
        <i className="bi bi-camera me-2" />{estudiante.fotoUrl ? 'Cambiar foto' : 'Subir foto'} (para el carnet escolar)
      </button>
    </div>
  );
}
