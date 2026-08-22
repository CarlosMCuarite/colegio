'use client';
// app/(dashboard)/director/reportes/page.tsx
// Nueva — el diferenciador es "Alumnos en riesgo": cruza asistencia, notas
// y pagos en un solo reporte, en vez de revisar 3 módulos por separado
// para encontrar a los mismos alumnos que necesitan atención.
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useData } from '@/hooks/useApi';

const COLOR_FACTOR: Record<string, string> = {
  'Inasistencias frecuentes': '#f59e0b',
  'Notas bajo el mínimo': '#ef4444',
  'Sin pago aprobado este mes': '#8b5cf6',
};

export default function ReportesPage() {
  const { data: resumenData, isLoading: cargandoResumen } = useData<any>('/reportes/resumen');
  const resumen = resumenData?.data;
  const { data: riesgoData, isLoading: cargandoRiesgo } = useData<any>('/reportes/alumnos-riesgo');
  const alumnosRiesgo = riesgoData?.data ?? [];

  return (
    <DashboardLayout title="Reportes del Colegio" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR']}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {cargandoResumen ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
        ) : (
          <>
            <div className="sige-card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{resumen?.totalEstudiantes ?? '—'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Estudiantes matriculados</div>
            </div>
            <div className="sige-card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: (resumen?.asistenciaPromedioPct ?? 100) >= 90 ? '#10b981' : '#f59e0b' }}>
                {resumen?.asistenciaPromedioPct != null ? `${resumen.asistenciaPromedioPct}%` : '—'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Asistencia del mes</div>
            </div>
            <div className="sige-card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{resumen?.notaPromedioGeneral ?? '—'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Promedio de notas (año)</div>
            </div>
            <div className="sige-card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b' }}>{resumen?.pagosPendientesMes ?? '—'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Pagos pendientes (mes)</div>
            </div>
          </>
        )}
      </div>

      <div className="sige-card">
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem' }}><i className="bi bi-exclamation-diamond me-2" style={{ color: '#ef4444' }} />Alumnos que necesitan atención</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Cruza inasistencias del mes (20%+), notas bajo el mínimo (11) y pagos sin aprobar este mes — para ver de un
          vistazo quiénes tienen más de un factor de riesgo a la vez.
        </p>
        {cargandoRiesgo ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
        ) : alumnosRiesgo.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <i className="bi bi-emoji-smile" style={{ fontSize: '1.6rem', display: 'block', marginBottom: 8 }} />
            Ningún alumno con factores de riesgo detectados ahora mismo.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {alumnosRiesgo.map((a: any) => (
              <div key={a.estudiante.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.7rem', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                {a.estudiante.fotoUrl
                  ? <img src={a.estudiante.fotoUrl} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>{a.estudiante.nombres?.[0]}{a.estudiante.apellidos?.[0]}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.estudiante.nombres} {a.estudiante.apellidos}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.grado} "{a.seccion}"</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {a.factores.map((f: string) => (
                      <span key={f} style={{ fontSize: '0.68rem', fontWeight: 700, color: COLOR_FACTOR[f] ?? '#64748b', background: `${COLOR_FACTOR[f] ?? '#64748b'}18`, padding: '2px 8px', borderRadius: 99 }}>{f}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {a.pctAusencia > 0 && <div>{a.pctAusencia}% ausencias</div>}
                  {a.promedioNotas != null && <div>Prom. {a.promedioNotas}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
