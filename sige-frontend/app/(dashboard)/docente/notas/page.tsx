'use client';
// app/(dashboard)/docente/notas/page.tsx
// Nueva — el docente elige aula + curso + bimestre, y ve el roster completo
// para calificar de una vez (no uno por uno). El tipo de campo (letra o
// número) cambia automáticamente según el nivel del grado — inicial/primaria
// usan AD/A/B/C, secundaria usa 0-20 — así nadie tiene que acordarse de la
// escala correcta.
import { useEffect, useState } from 'react';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const BIMESTRES = [
  { valor: 'BIMESTRE_1', label: 'Bimestre 1' },
  { valor: 'BIMESTRE_2', label: 'Bimestre 2' },
  { valor: 'BIMESTRE_3', label: 'Bimestre 3' },
  { valor: 'BIMESTRE_4', label: 'Bimestre 4' },
];

export default function NotasDocentePage() {
  const [aulaId, setAulaId] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [periodo, setPeriodo] = useState('BIMESTRE_1');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});

  const { data: aulasData } = useData<any>('/asistencia/mis-aulas');
  const aulas = aulasData?.data ?? [];
  useEffect(() => { if (!aulaId && aulas.length > 0) setAulaId(aulas[0].id); }, [aulas, aulaId]);
  const aulaActual = aulas.find((a: any) => a.id === aulaId);

  const { data: cursosData } = useData<any>(aulaActual?.seccion?.nivelGrado?.id ? `/cursos?nivelGradoId=${aulaActual.seccion.nivelGrado.id}` : null);
  const cursos = cursosData?.data ?? [];
  useEffect(() => { setCursoId(''); }, [aulaId]);

  const { data: rosterData, isLoading, mutate } = useData<any>(
    aulaId && cursoId ? `/notas/roster/${aulaId}/${cursoId}/${periodo}` : null
  );
  const roster: any[] = rosterData?.data ?? [];
  const usaNumero = rosterData?.usaNumero ?? false;
  const literalesValidas: string[] = rosterData?.literalesValidas ?? ['AD', 'A', 'B', 'C'];

  useEffect(() => {
    if (!rosterData) return;
    const v: Record<string, string> = {};
    const o: Record<string, string> = {};
    for (const r of roster) {
      if (r.nota) {
        v[r.estudiante.id] = usaNumero ? String(r.nota.calificacionNumerica ?? '') : (r.nota.calificacionLiteral ?? '');
        o[r.estudiante.id] = r.nota.observacion ?? '';
      }
    }
    setValores(v);
    setObservaciones(o);
  }, [rosterData]);

  const { mutate: guardarNotas, loading: guardando } = useMutation();

  const guardarTodo = async () => {
    const notas = roster
      .filter((r: any) => valores[r.estudiante.id])
      .map((r: any) => {
        const val = valores[r.estudiante.id];
        return {
          estudianteId: r.estudiante.id,
          cursoId, periodo,
          calificacionLiteral: usaNumero ? null : val,
          calificacionNumerica: usaNumero ? Number(val) : null,
          observacion: observaciones[r.estudiante.id] || null,
        };
      });
    if (notas.length === 0) { toast.error('No hay ninguna calificación para guardar'); return; }
    await guardarNotas(async () => {
      await api.post('/notas/bulk', { notas });
      toast.success(`${notas.length} calificación${notas.length !== 1 ? 'es' : ''} guardada${notas.length !== 1 ? 's' : ''}`);
      mutate();
    });
  };

  return (
    <DashboardLayout title="Registro de Notas" allowedRoles={['DOCENTE','AUXILIAR','TUTOR','COORDINADOR']}>
      {aulas.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-door-closed" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
          No tienes ningún aula asignada todavía.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 200 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Aula</label>
              <select value={aulaId} onChange={e => setAulaId(e.target.value)} className="sige-input">
                {aulas.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}{a.seccion?.nivelGrado?.nombre ? ` — ${a.seccion.nivelGrado.nombre}` : ''}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 200 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Curso</label>
              <select value={cursoId} onChange={e => setCursoId(e.target.value)} className="sige-input">
                <option value="">Selecciona un curso...</option>
                {cursos.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 160 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Periodo</label>
              <select value={periodo} onChange={e => setPeriodo(e.target.value)} className="sige-input">
                {BIMESTRES.map(b => <option key={b.valor} value={b.valor}>{b.label}</option>)}
              </select>
            </div>
          </div>

          {!cursoId ? (
            <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              Selecciona un curso para ver la lista de alumnos.
            </div>
          ) : isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
          ) : roster.length === 0 ? (
            <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>Sin alumnos matriculados en esta aula.</div>
          ) : (
            <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="sige-table">
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th style={{ width: 130 }}>{usaNumero ? 'Nota (0-20)' : 'Calificación'}</th>
                      <th>Observación (opcional)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r: any) => (
                      <tr key={r.estudiante.id}>
                        <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {r.estudiante.fotoUrl
                            ? <img src={r.estudiante.fotoUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{r.estudiante.nombres?.[0]}{r.estudiante.apellidos?.[0]}</div>}
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.estudiante.nombres} {r.estudiante.apellidos}</span>
                        </td>
                        <td>
                          {usaNumero ? (
                            <input type="number" min={0} max={20} step={0.5} className="sige-input" style={{ width: 90 }}
                              value={valores[r.estudiante.id] ?? ''}
                              onChange={e => setValores(v => ({ ...v, [r.estudiante.id]: e.target.value }))} />
                          ) : (
                            <select className="sige-input" style={{ width: 90 }}
                              value={valores[r.estudiante.id] ?? ''}
                              onChange={e => setValores(v => ({ ...v, [r.estudiante.id]: e.target.value }))}>
                              <option value="">—</option>
                              {literalesValidas.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                          )}
                        </td>
                        <td>
                          <input type="text" className="sige-input" placeholder="Opcional"
                            value={observaciones[r.estudiante.id] ?? ''}
                            onChange={e => setObservaciones(o => ({ ...o, [r.estudiante.id]: e.target.value }))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '0.875rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-accent" onClick={guardarTodo} disabled={guardando}>
                  {guardando ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save me-1" />Guardar calificaciones</>}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
