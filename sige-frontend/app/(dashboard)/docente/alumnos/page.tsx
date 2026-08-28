'use client';
// app/(dashboard)/docente/alumnos/page.tsx
// Nueva — antes el Docente no tenía forma de ver el listado de sus propios
// alumnos (solo podía buscarlos uno por uno por DNI dentro de Observaciones
// o Asistencia). Reusa /asistencia/mis-aulas (ya filtra correctamente las
// aulas del docente) + /estudiantes?seccionId=X para el roster.
import { useEffect, useState } from 'react';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData } from '../../../../hooks/useApi';

export default function MisAlumnosPage() {
  const [aulaId, setAulaId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const { data: aulasData, isLoading: cargandoAulas } = useData<any>('/asistencia/mis-aulas');
  const aulas = aulasData?.data ?? [];
  // BUG REAL encontrado: esto llamaba a setAulaId directo en el cuerpo del
  // render (no dentro de un useEffect) — React lo tolera casi siempre, pero
  // es un patrón fuera de las reglas de React ("el render debe ser puro")
  // que puede disparar renders de más o comportarse distinto entre
  // versiones de React. Se mueve a un useEffect, que es la forma correcta
  // de "reaccionar" a que ya llegaron las aulas.
  useEffect(() => { if (!aulaId && aulas.length > 0) setAulaId(aulas[0].id); }, [aulas, aulaId]);
  const aulaActual = aulas.find((a: any) => a.id === aulaId);

  const { data, isLoading } = useData<any>(aulaActual?.seccionId ? `/estudiantes?seccionId=${aulaActual.seccionId}&limit=100` : null);
  const alumnos = (data?.data ?? []).filter((e: any) =>
    !busqueda || `${e.nombres} ${e.apellidos} ${e.dni}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <DashboardLayout title="Mis Alumnos" allowedRoles={['DOCENTE','AUXILIAR','TUTOR','COORDINADOR','PSICOLOGO','ENFERMERIA']}>
      {!cargandoAulas && aulas.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-door-closed" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
          No tienes ningún aula asignada todavía.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <select className="sige-input" value={aulaId} onChange={e => setAulaId(e.target.value)} style={{ minWidth: 220, maxWidth: 280 }}>
              {aulas.map((a: any) => (
                <option key={a.id} value={a.id}>{a.nombre}{a.seccion?.nivelGrado?.nombre ? ` — ${a.seccion.nivelGrado.nombre}` : ''}</option>
              ))}
            </select>
            <input type="text" placeholder="Buscar por nombre o DNI..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="sige-input" style={{ maxWidth: 280 }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{alumnos.length} alumno{alumnos.length !== 1 ? 's' : ''}</span>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
          ) : alumnos.length === 0 ? (
            <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>Sin alumnos matriculados en esta aula.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem' }}>
              {alumnos.map((e: any) => (
                <div key={e.id} className="sige-card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {e.fotoUrl
                    ? <img src={e.fotoUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>{e.nombres?.[0]}{e.apellidos?.[0]}</div>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.nombres} {e.apellidos}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DNI {e.dni}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
