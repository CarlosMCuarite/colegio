'use client';
// app/(dashboard)/secretaria/actas/page.tsx
// Nueva — no hay un flujo único documentado de cómo cada colegio maneja
// esto, así que se dejó lo estándar: el Acta de Evaluación es la lista de
// notas finales (promedio de los 4 bimestres) de un aula+curso, y el Acta
// de Recuperación es la lista de quienes no llegaron al mínimo (11 / B),
// donde se puede registrar el resultado del examen de recuperación.
import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useNivelesGrados, useData, useMutation } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const NOTA_MINIMA = 11;
const COLOR_LITERAL: Record<string, string> = { AD: '#10b981', A: '#3b82f6', B: '#f59e0b', C: '#ef4444' };

export default function ActasPage() {
  const [nivelGradoId, setNivelGradoId] = useState('');
  const [aulaId, setAulaId] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [vista, setVista] = useState<'evaluacion' | 'recuperacion'>('evaluacion');

  const { data: nivelesData } = useNivelesGrados();
  const niveles = (nivelesData as any)?.data ?? [];
  const nivelSeleccionado = niveles.find((n: any) => n.id === nivelGradoId);
  const { data: aulasData } = useData<any>('/horarios/aulas-disponibles');
  // El endpoint /horarios/aulas-disponibles no trae el id del nivelGrado
  // dentro de "seccion.nivelGrado" (solo el nombre) — así que se filtra
  // comparando contra las secciones del grado seleccionado (eso sí lo
  // trae completo /aulas/niveles-grados).
  const aulasDelGrado = (aulasData?.data ?? []).filter((a: any) => nivelSeleccionado?.secciones?.some((s: any) => s.id === a.seccionId));
  const { data: cursosData } = useData<any>(nivelGradoId ? `/cursos?nivelGradoId=${nivelGradoId}` : null);
  const cursos = cursosData?.data ?? [];

  const { data: actaData, isLoading } = useData<any>(aulaId && cursoId ? `/notas?aulaId=${aulaId}&cursoId=${cursoId}` : null);
  const notasPorEstudiante = (() => {
    const map = new Map<string, { estudiante: any; bimestres: any[] }>();
    for (const n of actaData?.data ?? []) {
      if (!map.has(n.estudianteId)) map.set(n.estudianteId, { estudiante: n.estudiante, bimestres: [] });
      map.get(n.estudianteId)!.bimestres.push(n);
    }
    return Array.from(map.values()).map(e => {
      const numeros = e.bimestres.filter((b: any) => b.calificacionNumerica != null).map((b: any) => Number(b.calificacionNumerica)).filter((x: number) => !isNaN(x));
      const promedio = numeros.length ? Math.round((numeros.reduce((a: number, b: number) => a + b, 0) / numeros.length) * 100) / 100 : null;
      return { ...e, promedio, requiereRecuperacion: promedio != null && promedio < NOTA_MINIMA };
    }).sort((a, b) => a.estudiante.apellidos.localeCompare(b.estudiante.apellidos));
  })();

  const cursoSeleccionado = cursos.find((c: any) => c.id === cursoId);
  const usaNumero = cursoSeleccionado?.nivelGrado?.nivel === 'SECUNDARIA' || nivelSeleccionado?.nivel === 'SECUNDARIA';

  const { mutate: guardarRecu, loading: guardandoRecu } = useMutation();
  const [notaRecu, setNotaRecu] = useState<Record<string, string>>({});

  const registrarRecuperacion = async (estudianteId: string) => {
    // BUG REAL encontrado: si el campo quedaba vacío, `Number('')` da 0 (no
    // NaN) — así que se podía registrar sin querer una nota de 0 con solo
    // hacer clic en "Guardar" sin haber escrito nada.
    const texto = (notaRecu[estudianteId] ?? '').trim();
    if (!texto) { toast.error('Escribe la nota del examen de recuperación'); return; }
    const nota = Number(texto);
    if (isNaN(nota) || nota < 0 || nota > 20) { toast.error('Ingresa una nota válida (0-20)'); return; }
    await guardarRecu(async () => {
      await api.post('/notas/recuperaciones', { estudianteId, cursoId, notaFinal: nota, aprobado: nota >= NOTA_MINIMA, fechaExamen: new Date().toISOString() });
      toast.success('Recuperación registrada');
    });
  };

  return (
    <DashboardLayout title="Actas de Evaluación" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem', maxWidth: 640 }}>
        El acta se genera a partir de las notas ya registradas por el docente — el promedio es el de los 4 bimestres.
        La nota mínima aprobatoria es {NOTA_MINIMA} (equivalente a B).
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }} className="carnet-oculto-print">
        <div style={{ minWidth: 180 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Grado</label>
          <select value={nivelGradoId} onChange={e => { setNivelGradoId(e.target.value); setAulaId(''); setCursoId(''); }} className="sige-input">
            <option value="">Selecciona...</option>
            {niveles.map((n: any) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 180 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Aula</label>
          <select value={aulaId} onChange={e => setAulaId(e.target.value)} className="sige-input" disabled={!nivelGradoId}>
            <option value="">Selecciona...</option>
            {aulasDelGrado.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 180 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Curso</label>
          <select value={cursoId} onChange={e => setCursoId(e.target.value)} className="sige-input" disabled={!nivelGradoId}>
            <option value="">Selecciona...</option>
            {cursos.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      {aulaId && cursoId && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }} className="carnet-oculto-print">
          {[{ id: 'evaluacion', label: 'Acta de Evaluación' }, { id: 'recuperacion', label: 'Acta de Recuperación' }].map(t => (
            <button key={t.id} onClick={() => setVista(t.id as any)}
              style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                background: vista === t.id ? 'var(--accent)' : 'var(--bg-card)', color: vista === t.id ? '#fff' : 'var(--text-secondary)' }}>{t.label}</button>
          ))}
          <button onClick={() => window.print()} style={{ marginLeft: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
            <i className="bi bi-printer me-1" />Imprimir
          </button>
        </div>
      )}

      {!aulaId || !cursoId ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>Selecciona grado, aula y curso para generar el acta.</div>
      ) : isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
      ) : notasPorEstudiante.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>No hay notas registradas todavía para este curso.</div>
      ) : vista === 'evaluacion' ? (
        <div className="sige-card boletin-print-root" style={{ padding: '1.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>
            Acta de Evaluación — {cursoSeleccionado?.nombre} — {nivelSeleccionado?.nombre}
          </div>
          <table className="sige-table">
            <thead><tr><th>N°</th><th>Apellidos y Nombres</th><th>DNI</th><th style={{ textAlign: 'center' }}>Promedio</th><th style={{ textAlign: 'center' }}>Condición</th></tr></thead>
            <tbody>
              {notasPorEstudiante.map((e, i) => (
                <tr key={e.estudiante.id}>
                  <td>{i + 1}</td>
                  <td>{e.estudiante.apellidos}, {e.estudiante.nombres}</td>
                  <td>{e.estudiante.dni}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{e.promedio ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {e.promedio == null ? '—' : e.requiereRecuperacion
                      ? <span style={{ color: '#ef4444', fontWeight: 700 }}>Requiere recuperación</span>
                      : <span style={{ color: '#10b981', fontWeight: 700 }}>Aprobado</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="sige-card boletin-print-root" style={{ padding: '1.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>
            Acta de Recuperación — {cursoSeleccionado?.nombre} — {nivelSeleccionado?.nombre}
          </div>
          {notasPorEstudiante.filter(e => e.requiereRecuperacion).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Ningún estudiante requiere recuperación en este curso.</div>
          ) : (
            <table className="sige-table">
              <thead><tr><th>Apellidos y Nombres</th><th style={{ textAlign: 'center' }}>Promedio</th><th style={{ textAlign: 'center' }}>Nota de recuperación</th><th className="carnet-oculto-print" /></tr></thead>
              <tbody>
                {notasPorEstudiante.filter(e => e.requiereRecuperacion).map(e => (
                  <tr key={e.estudiante.id}>
                    <td>{e.estudiante.apellidos}, {e.estudiante.nombres}</td>
                    <td style={{ textAlign: 'center' }}>{e.promedio}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" min={0} max={20} className="sige-input carnet-oculto-print" style={{ width: 80, display: 'inline-block' }}
                        value={notaRecu[e.estudiante.id] ?? ''} onChange={ev => setNotaRecu(v => ({ ...v, [e.estudiante.id]: ev.target.value }))} />
                    </td>
                    <td className="carnet-oculto-print">
                      <button onClick={() => registrarRecuperacion(e.estudiante.id)} disabled={guardandoRecu} className="btn-accent" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>Guardar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
