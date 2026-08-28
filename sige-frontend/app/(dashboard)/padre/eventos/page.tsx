'use client';
import { useMemo } from 'react';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useEventos } from '../../../../hooks/useApi';

const TIPO_COLOR: Record<string,string> = { FERIADO:'#ef4444', SUSPENSION_CLASES:'#f59e0b', REUNION:'#3b82f6', ACTIVIDAD:'#10b981', OTRO:'#64748b' };

export default function EventosPadrePage() {
  // OJO: `desde` tiene que quedar fijo durante la vida del componente. Antes
  // se llamaba a `new Date().toISOString()` directo en cada render, lo que
  // generaba una URL distinta cada vez → SWR la trataba como un recurso
  // nuevo → pedía de nuevo → nuevo render → nueva fecha → bucle infinito de
  // peticiones (eso era el "Demasiadas solicitudes" en cadena).
  //
  // Bug nuevo encontrado: usar el INSTANTE exacto de "ahora" (ISO con hora)
  // como filtro rompía eventos de día completo. Un evento creado con el
  // selector de fecha (sin hora) se guarda como medianoche UTC de ese día
  // (ej: 13 ago → "2026-08-13T00:00:00Z"). Como Perú va 5 horas detrás de
  // UTC, para cuando en Perú es de noche del día anterior ya es después de
  // esa medianoche UTC en términos absolutos → el evento queda "en el
  // pasado" y desaparece de la lista aunque el día todavía no llegue en
  // Perú. La solución es filtrar desde el INICIO DEL DÍA DE HOY (medianoche
  // UTC de la fecha calendario actual), no desde el instante exacto.
  const desde = useMemo(() => {
    const hoy = new Date();
    return new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())).toISOString();
  }, []);
  const { data } = useEventos(`desde=${desde}&limit=30`);
  const eventos = (data as any)?.data ?? [];
  return (
    <DashboardLayout title="Eventos del Colegio" allowedRoles={['PADRE']}>
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
                    <span style={{ background: `${color}18`, color, padding: '1px 8px', borderRadius: 99, fontWeight: 600 }}>{ev.tipo.replace('_',' ')}</span>
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
