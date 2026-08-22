'use client';
// components/DirectorioEstudiantes.tsx
// Busca en TODO el colegio (no solo el aula del usuario) — pensado para
// roles como Psicología o Auxiliar, que necesitan ubicar a cualquier
// estudiante rápido, no solo a los de un aula fija como un Docente/Tutor.
import { useState } from 'react';
import { useData } from '@/hooks/useApi';

export default function DirectorioEstudiantes() {
  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState('');
  const { data, isLoading } = useData<any>(buscando ? `/estudiantes?q=${encodeURIComponent(buscando)}&limit=30` : null);
  const resultados = data?.data ?? [];

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <input
          type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') setBuscando(busqueda); }}
          placeholder="Buscar por nombre, apellido o DNI..." className="sige-input" style={{ maxWidth: 360 }}
        />
        <button className="btn-accent" onClick={() => setBuscando(busqueda)} disabled={busqueda.trim().length < 2}>
          <i className="bi bi-search me-1" />Buscar
        </button>
      </div>

      {!buscando ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-people" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
          Escribe un nombre o DNI para buscar a cualquier estudiante del colegio.
        </div>
      ) : isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
      ) : resultados.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>Sin resultados para "{buscando}"</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {resultados.map((e: any) => {
            const m = e.matriculas?.[0];
            return (
              <div key={e.id} className="sige-card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {e.fotoUrl
                  ? <img src={e.fotoUrl} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>{e.nombres?.[0]}{e.apellidos?.[0]}</div>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{e.nombres} {e.apellidos}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DNI {e.dni}</div>
                  {m && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.nivelGrado?.nombre} "{m.seccion?.nombre}"</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
