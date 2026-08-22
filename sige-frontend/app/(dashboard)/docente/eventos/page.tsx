'use client';
// app/(dashboard)/docente/eventos/page.tsx
//
// Nueva — antes el Docente no tenía forma de ver el calendario de eventos
// del colegio. Reusa la misma lógica que Padre (ya corregida para
// zonas horarias), con sus propios roles permitidos.
import { useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useEventos } from '@/hooks/useApi';

const TIPO_COLOR: Record<string, string> = { FERIADO: '#ef4444', SUSPENSION_CLASES: '#f59e0b', REUNION: '#3b82f6', ACTIVIDAD: '#10b981', OTRO: '#64748b' };

export default function EventosDocentePage() {
  const desde = useMemo(() => {
    const hoy = new Date();
    return new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())).toISOString();
  }, []);
  const { data } = useEventos(`desde=${desde}&limit=30`);
  const eventos = (data as any)?.data ?? [];
  return (
    <DashboardLayout title="Eventos del Colegio" allowedRoles={['DOCENTE','AUXILIAR','TUTOR','COORDINADOR','PSICOLOGO','ENFERMERIA']}>
      {eventos.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-calendar-x" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />Sin eventos próximos
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {eventos.map((ev: any) => {
            const color = TIPO_COLOR[ev.tipo] ?? '#64748b';
            return (
              <div key={ev.id} className="sige-card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 52, textAlign: 'center', background: `${color}18`, borderRadius: 10, padding: '0.5rem 0', border: `1px solid ${color}30` }}>
                  <div style={{ fontSize: '0.62rem', color, fontWeight: 700, textTransform: 'uppercase' }}>
                    {new Date(ev.fechaInicio).toLocaleString('es-PE', { month: 'short' })}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1 }}>{new Date(ev.fechaInicio).getDate()}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 3 }}>{ev.titulo}</div>
                  {ev.descripcion && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>{ev.descripcion}</p>}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                    <span style={{ background: `${color}18`, color, padding: '1px 8px', borderRadius: 99, fontWeight: 600 }}>{ev.tipo.replace('_', ' ')}</span>
                    {ev.lugar && <span><i className="bi bi-geo-alt me-1" />{ev.lugar}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
