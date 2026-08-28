'use client';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useData } from '../../../hooks/useApi';

export default function InicioAuxiliarPage() {
  const { data: permisosData } = useData<any>('/permisos?limit=5');
  const { data: obsData } = useData<any>('/observaciones?tipo=DISCIPLINARIA&limit=5');
  const permisos: any[] = permisosData?.data ?? [];
  const observaciones: any[] = obsData?.data ?? [];

  return (
    <DashboardLayout title="Auxiliar" allowedRoles={['AUXILIAR']}>
      <div className="sige-card" style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <i className="bi bi-shield-check" style={{ fontSize: '1.8rem' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Panel de Auxiliar</div>
            <div style={{ fontSize: '0.82rem', opacity: 0.9 }}>Disciplina, orden y control de permisos de salida.</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <a href="/auxiliar/directorio" className="sige-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <i className="bi bi-people" style={{ fontSize: '1.4rem', color: '#f59e0b' }} />
          <div style={{ fontWeight: 700, marginTop: 8 }}>Directorio de Estudiantes</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Ubicar a cualquier alumno del colegio</div>
        </a>
        <a href="/docente/asistencia" className="sige-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <i className="bi bi-calendar-check" style={{ fontSize: '1.4rem', color: '#f59e0b' }} />
          <div style={{ fontWeight: 700, marginTop: 8 }}>Asistencia por aula</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Apoyar el control de asistencia</div>
        </a>
        <a href="/docente/observaciones" className="sige-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <i className="bi bi-exclamation-triangle" style={{ fontSize: '1.4rem', color: '#f59e0b' }} />
          <div style={{ fontWeight: 700, marginTop: 8 }}>Registrar incidencia</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Observación disciplinaria</div>
        </a>
        <a href="/docente/permisos" className="sige-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <i className="bi bi-door-open" style={{ fontSize: '1.4rem', color: '#f59e0b' }} />
          <div style={{ fontWeight: 700, marginTop: 8 }}>Permisos de Salida</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Ver y solicitar permisos</div>
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="sige-card">
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}><i className="bi bi-door-open me-2" />Últimos permisos</h3>
          {permisos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin registros</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {permisos.map((p: any) => (
                <div key={p.id} style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 5 }}>
                  <span>{p.estudiante?.nombres} {p.estudiante?.apellidos}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{p.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="sige-card">
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}><i className="bi bi-exclamation-triangle me-2" />Últimas incidencias</h3>
          {observaciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin registros</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {observaciones.map((o: any) => (
                <div key={o.id} style={{ fontSize: '0.82rem', borderBottom: '1px solid var(--border-color)', paddingBottom: 5 }}>
                  <strong>{o.estudiante?.nombres} {o.estudiante?.apellidos}</strong> — {o.descripcion?.slice(0, 50)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
