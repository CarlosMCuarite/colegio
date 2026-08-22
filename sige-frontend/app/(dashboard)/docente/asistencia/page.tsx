'use client';
// app/(dashboard)/docente/asistencia/page.tsx
//
// Antes solo mostraba los registros que YA existían (los que llegaron por
// escaneo QR) — un alumno que no pudo escanear (ej. perdió su carnet) no
// aparecía en ningún lado y no había forma de marcarlo. Ahora hay una vista
// "Por aula" (nueva, por defecto): lista a TODOS los matriculados del aula/
// sección — con su estado si ya escanearon, o un botón para marcarlos a mano
// si todavía no. La vista "Todos los registros" (la de antes) se mantiene
// como pestaña aparte para ver el historial completo del día.
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useData, useMutation } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const ESTADO_CONF: Record<string, { bg: string; text: string; label: string }> = {
  PRESENTE:    { bg: '#d1fae5', text: '#065f46', label: 'Presente' },
  TARDANZA:    { bg: '#fef3c7', text: '#92400e', label: 'Tardanza' },
  AUSENTE:     { bg: '#fee2e2', text: '#991b1b', label: 'Ausente' },
  JUSTIFICADO: { bg: '#dbeafe', text: '#1e40af', label: 'Justificado' },
};

export default function AsistenciaDocentePage() {
  const [tab, setTab] = useState<'aula' | 'todos'>('aula');
  return (
    <DashboardLayout title="Control de Asistencia" allowedRoles={['DOCENTE','AUXILIAR','TUTOR','COORDINADOR','PSICOLOGO','ENFERMERIA','SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      <div className="sige-card" style={{ display: 'flex', padding: 6, marginBottom: '1.25rem', gap: 4, maxWidth: 340 }}>
        {[{ id: 'aula', label: 'Por aula', icon: 'bi-door-open' }, { id: 'todos', label: 'Todos los registros', icon: 'bi-list-check' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
              background: tab === t.id ? 'var(--accent)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--text-secondary)' }}>
            <i className={`bi ${t.icon} me-1`} />{t.label}
          </button>
        ))}
      </div>
      {tab === 'aula' ? <VistaPorAula /> : <VistaTodosLosRegistros />}
    </DashboardLayout>
  );
}

// ── Vista "Por aula": roster completo + marcar a mano ────────────────────────
function VistaPorAula() {
  const hoy = new Date().toISOString().split('T')[0];
  const [fecha, setFecha] = useState(hoy);
  const [aulaId, setAulaId] = useState('');
  const { data: aulasData, isLoading: cargandoAulas } = useData<any>('/asistencia/mis-aulas');
  const aulas = aulasData?.data ?? [];

  // Selecciona la primera aula automáticamente cuando cargan. BUG REAL
  // encontrado: esto llamaba a setAulaId directo en el cuerpo del render en
  // vez de en un useEffect — fuera de las reglas de React, puede disparar
  // renders de más. Corregido igual que en Mis Alumnos.
  useEffect(() => { if (!aulaId && aulas.length > 0) setAulaId(aulas[0].id); }, [aulas, aulaId]);

  const { data, isLoading, mutate } = useData<any>(aulaId ? `/asistencia/aula/${aulaId}?fecha=${fecha}` : null);
  const { mutate: marcar, loading: marcando } = useMutation();
  const alumnos = data?.data?.alumnos ?? [];
  const aulaInfo = data?.data?.aula;

  const marcarAlumno = async (estudianteId: string, estado: string) => {
    await marcar(async () => {
      await api.post(`/asistencia/aula/${aulaId}/marcar`, { estudianteId, estado, fecha });
      mutate();
    });
  };

  if (!cargandoAulas && aulas.length === 0) {
    return (
      <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
        <i className="bi bi-door-closed" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
        No tienes ningún aula asignada como docente o tutor todavía.
      </div>
    );
  }

  const sinMarcar = alumnos.filter((a: any) => !a.asistencia).length;

  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Aula</label>
          <select className="sige-input" value={aulaId} onChange={e => setAulaId(e.target.value)} style={{ minWidth: 220 }}>
            {aulas.map((a: any) => (
              <option key={a.id} value={a.id}>{a.nombre}{a.seccion?.nivelGrado?.nombre ? ` — ${a.seccion.nivelGrado.nombre}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} max={hoy} className="sige-input" style={{ width: 'auto' }} />
        </div>
        {sinMarcar > 0 && (
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#92400e', background: '#fef3c7', padding: '6px 12px', borderRadius: 99 }}>
            <i className="bi bi-exclamation-circle me-1" />{sinMarcar} sin marcar todavía
          </span>
        )}
      </div>

      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
        ) : alumnos.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Esta aula no tiene alumnos matriculados este año.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead><tr><th>Estudiante</th><th>DNI</th><th>Estado</th><th>Hora</th><th>Marcar</th></tr></thead>
              <tbody>
                {alumnos.map(({ estudiante, asistencia }: any) => {
                  const conf = asistencia ? (ESTADO_CONF[asistencia.estado] ?? {}) : null;
                  return (
                    <tr key={estudiante.id} style={!asistencia ? { background: 'rgba(251, 191, 36, 0.06)' } : undefined}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.875rem' }}>
                        {estudiante.fotoUrl
                          ? <img src={estudiante.fotoUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                          : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>{estudiante.nombres?.[0]}{estudiante.apellidos?.[0]}</div>}
                        {estudiante.apellidos}, {estudiante.nombres}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{estudiante.dni}</td>
                      <td>
                        {conf
                          ? <span className="estado-badge" style={{ background: conf.bg, color: conf.text }}>{conf.label}</span>
                          : <span className="estado-badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>Sin marcar</span>}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {asistencia?.horaLlegada ? new Date(asistencia.horaLlegada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {['PRESENTE', 'TARDANZA', 'AUSENTE'].map(e => (
                            <button key={e} disabled={marcando} onClick={() => marcarAlumno(estudiante.id, e)}
                              title={ESTADO_CONF[e].label}
                              style={{
                                width: 30, height: 30, borderRadius: 6, cursor: 'pointer',
                                border: asistencia?.estado === e ? `2px solid ${ESTADO_CONF[e].text}` : '1px solid var(--border-color)',
                                background: asistencia?.estado === e ? ESTADO_CONF[e].bg : 'var(--bg-secondary)',
                                color: asistencia?.estado === e ? ESTADO_CONF[e].text : 'var(--text-muted)',
                              }}>
                              <i className={`bi ${e === 'PRESENTE' ? 'bi-check-lg' : e === 'TARDANZA' ? 'bi-clock' : 'bi-x-lg'}`} />
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ── Vista "Todos los registros": la de siempre, historial del día completo ──
function VistaTodosLosRegistros() {
  const hoy = new Date().toISOString().split('T')[0];
  const [fecha, setFecha] = useState(hoy);
  const { data, isLoading, mutate } = useData<any>(`/asistencia?fecha=${fecha}&limit=100`);
  const { loading: saving, mutate: save } = useMutation();

  const asistencias = (data as any)?.data ?? [];

  const justificar = async (id: string, justificacion: string) => {
    await save(async () => {
      await api.patch(`/asistencia/${id}`, { estado: 'JUSTIFICADO', justificacion });
      toast.success('Asistencia justificada');
      mutate();
    });
  };

  const corregir = async (id: string, estado: string) => {
    await save(async () => {
      await api.patch(`/asistencia/${id}`, { estado });
      toast.success('Asistencia corregida');
      mutate();
    });
  };

  return (
    <>
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', alignItems:'flex-end' }}>
        <div>
          <label style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} max={hoy} className="sige-input" style={{ width:'auto' }} />
        </div>
        <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', paddingBottom:8 }}>
          {asistencias.length} registros
        </div>
      </div>

      <div className="sige-card" style={{ padding:0, overflow:'hidden' }}>
        {isLoading ? <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div> : (
          <div style={{ overflowX:'auto' }}>
            <table className="sige-table">
              <thead><tr><th>Estudiante</th><th>Estado</th><th>Hora</th><th>Acciones</th></tr></thead>
              <tbody>
                {asistencias.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>Sin registros para esta fecha</td></tr>
                ) : asistencias.map((a: any) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight:600, fontSize:'0.875rem' }}>{a.estudiante?.apellidos}, {a.estudiante?.nombres}</td>
                    <td>
                      <span className="estado-badge" style={{
                        background: a.estado==='PRESENTE'?'#d1fae5':a.estado==='AUSENTE'?'#fee2e2':a.estado==='TARDANZA'?'#fef3c7':'#dbeafe',
                        color:      a.estado==='PRESENTE'?'#065f46':a.estado==='AUSENTE'?'#991b1b':a.estado==='TARDANZA'?'#92400e':'#1e40af',
                      }}>{a.estado}</span>
                    </td>
                    <td style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>
                      {a.horaLlegada ? new Date(a.horaLlegada).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '—'}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:'0.4rem' }}>
                        {a.estado === 'AUSENTE' && (
                          <button onClick={() => {
                            const mot = prompt('Motivo de justificación:');
                            if (mot) justificar(a.id, mot);
                          }} style={{ background:'#dbeafe', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer', color:'#1e40af', fontSize:'0.75rem', fontWeight:600 }}>
                            Justificar
                          </button>
                        )}
                        <select onChange={e => { if (e.target.value) { corregir(a.id, e.target.value); e.target.value=''; } }}
                          style={{ fontSize:'0.75rem', padding:'3px 6px', borderRadius:6, border:'1px solid var(--border-color)', background:'var(--bg-secondary)', color:'var(--text-secondary)', cursor:'pointer' }}>
                          <option value="">Corregir...</option>
                          {['PRESENTE','AUSENTE','TARDANZA'].filter(e => e !== a.estado).map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
