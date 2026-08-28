'use client';
// app/(dashboard)/padre/asistencia/page.tsx
//
// Antes usaba GET /asistencia/resumen/:id?mes&año — cambiado a GET
// /asistencia?estudianteId=X (el mismo endpoint general que ya usan
// Docente/Secretaría), que ahora además está correctamente restringido para
// que un padre solo pueda ver la asistencia de SUS hijos vinculados. Se
// calcula el resumen y el calendario en el frontend a partir de la lista
// completa — más simple y evita casos raros de zona horaria del endpoint de
// "resumen" mensual. Agregado: vista de calendario con el estado de cada
// día, además de la tabla de siempre.
import { useMemo, useState } from 'react';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData, useDashboardPadre } from '../../../../hooks/useApi';

const ESTADO_CONF: Record<string, { bg: string; text: string; icon: string; label: string; dot: string }> = {
  PRESENTE:    { bg: '#d1fae5', text: '#065f46', icon: 'bi-check-circle',  label: 'Presente',    dot: '#10b981' },
  AUSENTE:     { bg: '#fee2e2', text: '#991b1b', icon: 'bi-x-circle',      label: 'Ausente',     dot: '#ef4444' },
  TARDANZA:    { bg: '#fef3c7', text: '#92400e', icon: 'bi-clock',         label: 'Tardanza',    dot: '#f59e0b' },
  JUSTIFICADO: { bg: '#dbeafe', text: '#1e40af', icon: 'bi-shield-check',  label: 'Justificado', dot: '#3b82f6' },
  PERMISO:     { bg: '#ede9fe', text: '#5b21b6', icon: 'bi-door-open',     label: 'Permiso',     dot: '#8b5cf6' },
};

export default function AsistenciaPadrePage() {
  const [estudianteIdx, setEstudianteIdx] = useState(0);
  const [vista, setVista] = useState<'calendario' | 'lista'>('calendario');
  const { data, isLoading: cargandoHijos } = useDashboardPadre();
  const d = (data as any)?.data;
  const estudiantes = d?.estudiantes ?? [];
  const estudiante  = estudiantes[estudianteIdx];

  const { data: asistData, isLoading: cargandoAsistencia, error: errorAsistencia } = useData<any>(
    estudiante ? `/asistencia?estudianteId=${estudiante.id}&limit=120` : null
  );
  const registros: any[] = asistData?.data ?? [];

  const resumen = useMemo(() => {
    const r = { presentes: 0, ausentes: 0, tardanzas: 0, justificados: 0 };
    for (const a of registros) {
      if (a.estado === 'PRESENTE') r.presentes++;
      else if (a.estado === 'AUSENTE') r.ausentes++;
      else if (a.estado === 'TARDANZA') r.tardanzas++;
      else if (a.estado === 'JUSTIFICADO') r.justificados++;
    }
    return r;
  }, [registros]);

  const [mesCalendario, setMesCalendario] = useState(() => { const h = new Date(); return { anio: h.getFullYear(), mes: h.getMonth() }; });
  const porFecha = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of registros) map.set(new Date(a.fecha).toISOString().slice(0, 10), a);
    return map;
  }, [registros]);

  const cambiarMes = (delta: number) => setMesCalendario(m => {
    const nueva = new Date(m.anio, m.mes + delta, 1);
    return { anio: nueva.getFullYear(), mes: nueva.getMonth() };
  });

  const diasDelMes = useMemo(() => {
    const primerDia = new Date(mesCalendario.anio, mesCalendario.mes, 1);
    const totalDias = new Date(mesCalendario.anio, mesCalendario.mes + 1, 0).getDate();
    const offset = (primerDia.getDay() + 6) % 7; // lunes=0
    const dias: (number | null)[] = Array(offset).fill(null);
    for (let i = 1; i <= totalDias; i++) dias.push(i);
    return dias;
  }, [mesCalendario]);

  const nombreMes = new Date(mesCalendario.anio, mesCalendario.mes, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  return (
    <DashboardLayout title="Asistencia" allowedRoles={['PADRE']}>
      {cargandoHijos ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <span className="spinner-border spinner-border-sm me-2" />Cargando...
        </div>
      ) : estudiantes.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-person-x" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
          No tienes hijos matriculados vinculados a tu cuenta todavía.
        </div>
      ) : (
        <>
          {/* Selector de hijo — visible incluso con 2 o más */}
          {estudiantes.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {estudiantes.map((e: any, i: number) => (
                <button key={e.id} onClick={() => setEstudianteIdx(i)}
                  style={{ padding: '0.4rem 1rem', borderRadius: 99, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                    background: estudianteIdx === i ? 'var(--accent)' : 'var(--bg-card)',
                    color: estudianteIdx === i ? '#fff' : 'var(--text-secondary)',
                    border: estudianteIdx !== i ? '1px solid var(--border-color)' : 'none',
                  }}>{e.nombres}</button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {[{ id: 'calendario', label: 'Calendario', icon: 'bi-calendar3' }, { id: 'lista', label: 'Lista', icon: 'bi-list-ul' }].map(t => (
              <button key={t.id} onClick={() => setVista(t.id as any)}
                style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                  background: vista === t.id ? 'var(--accent)' : 'var(--bg-card)', color: vista === t.id ? '#fff' : 'var(--text-secondary)' }}>
                <i className={`bi ${t.icon} me-1`} />{t.label}
              </button>
            ))}
          </div>

          {cargandoAsistencia ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <span className="spinner-border spinner-border-sm me-2" />Cargando asistencia...
            </div>
          ) : errorAsistencia ? (
            <div className="sige-card" style={{ textAlign: 'center', padding: '2rem', color: '#991b1b' }}>
              <i className="bi bi-exclamation-triangle me-2" />No se pudo cargar la asistencia. Intenta recargar la página.
            </div>
          ) : (
            <>
              {/* Resumen (de los últimos registros cargados) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { key: 'presentes',    label: 'Presentes',    color: '#10b981' },
                  { key: 'ausentes',     label: 'Ausentes',     color: '#ef4444' },
                  { key: 'tardanzas',    label: 'Tardanzas',    color: '#f59e0b' },
                  { key: 'justificados', label: 'Justificados', color: '#3b82f6' },
                ].map(item => (
                  <div key={item.key} className="sige-card" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: item.color }}>{(resumen as any)[item.key] ?? 0}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {registros.length === 0 ? (
                <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  <i className="bi bi-calendar-x" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
                  Todavía no hay registros de asistencia para {estudiante.nombres}.
                </div>
              ) : vista === 'calendario' ? (
                <div className="sige-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button onClick={() => cambiarMes(-1)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 6, width: 32, height: 32, cursor: 'pointer' }}><i className="bi bi-chevron-left" /></button>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'capitalize' }}>{nombreMes}</div>
                    <button onClick={() => cambiarMes(1)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 6, width: 32, height: 32, cursor: 'pointer' }}><i className="bi bi-chevron-right" /></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{d}</div>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                    {diasDelMes.map((dia, i) => {
                      if (dia === null) return <div key={i} />;
                      const fechaStr = `${mesCalendario.anio}-${String(mesCalendario.mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                      const registro = porFecha.get(fechaStr);
                      const conf = registro ? ESTADO_CONF[registro.estado] : null;
                      return (
                        <div key={i} title={conf?.label ?? ''} style={{
                          aspectRatio: '1', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          background: conf ? conf.bg : 'var(--bg-secondary)', color: conf ? conf.text : 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600,
                        }}>
                          {dia}
                          {conf && <div style={{ width: 5, height: 5, borderRadius: '50%', background: conf.dot, marginTop: 2 }} />}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    {Object.values(ESTADO_CONF).map(c => (
                      <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot }} />{c.label}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="sige-table">
                      <thead><tr><th>Fecha</th><th>Estado</th><th>Hora llegada</th><th>Observación</th></tr></thead>
                      <tbody>
                        {registros.map((a: any) => {
                          const conf = ESTADO_CONF[a.estado] ?? ESTADO_CONF.AUSENTE;
                          return (
                            <tr key={a.id}>
                              <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                {new Date(a.fecha).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                              </td>
                              <td><span className="estado-badge" style={{ background: conf.bg, color: conf.text }}><i className={`bi ${conf.icon} me-1`} />{conf.label}</span></td>
                              <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {a.horaLlegada ? new Date(a.horaLlegada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.motivoAusencia || a.justificacion || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
