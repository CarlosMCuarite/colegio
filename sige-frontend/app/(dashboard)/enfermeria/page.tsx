'use client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useData } from '@/hooks/useApi';

export default function InicioEnfermeriaPage() {
  const { data } = useData<any>('/observaciones?tipo=SALUD&limit=5');
  const recientes: any[] = data?.data ?? [];

  return (
    <DashboardLayout title="Enfermería" allowedRoles={['ENFERMERIA']}>
      <div className="sige-card" style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <i className="bi bi-heart-pulse" style={{ fontSize: '1.8rem' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Panel de Enfermería</div>
            <div style={{ fontSize: '0.82rem', opacity: 0.9 }}>Registra atenciones, incidentes de salud y da seguimiento a los estudiantes.</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <a href="/enfermeria/registro" className="sige-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <i className="bi bi-clipboard2-pulse" style={{ fontSize: '1.4rem', color: '#0ea5e9' }} />
          <div style={{ fontWeight: 700, marginTop: 8 }}>Registro de Enfermería</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Ver y crear atenciones a estudiantes</div>
        </a>
        <a href="/docente/permisos" className="sige-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <i className="bi bi-door-open" style={{ fontSize: '1.4rem', color: '#0ea5e9' }} />
          <div style={{ fontWeight: 700, marginTop: 8 }}>Permisos de Salida</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Solicitar salida por motivo de salud</div>
        </a>
      </div>

      <div className="sige-card">
        <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}><i className="bi bi-clock-history me-2" />Últimas atenciones</h3>
        {recientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin registros todavía</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {recientes.map((r: any) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                <span><strong>{r.estudiante?.nombres} {r.estudiante?.apellidos}</strong> — {r.descripcion?.slice(0, 60)}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{new Date(r.fecha).toLocaleDateString('es-PE')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
