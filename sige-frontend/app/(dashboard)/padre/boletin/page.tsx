'use client';
// app/(dashboard)/padre/boletin/page.tsx
// Nueva — boletín de notas del hijo, imprimible (usa la ventana de impresión
// del navegador en vez de generar un PDF en el servidor — mismo criterio
// que ya usamos para Horarios, más simple y ya se ve profesional).
import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useData, useDashboardPadre } from '@/hooks/useApi';

const BIMESTRE_LABEL: Record<string, string> = { BIMESTRE_1: 'B1', BIMESTRE_2: 'B2', BIMESTRE_3: 'B3', BIMESTRE_4: 'B4' };
const COLOR_LITERAL: Record<string, string> = { AD: '#10b981', A: '#3b82f6', B: '#f59e0b', C: '#ef4444' };

export default function BoletinPadrePage() {
  const [estudianteIdx, setEstudianteIdx] = useState(0);
  const { data, isLoading: cargandoHijos } = useDashboardPadre();
  const d = (data as any)?.data;
  const estudiantes = d?.estudiantes ?? [];
  const estudiante = estudiantes[estudianteIdx];

  const { data: boletinData, isLoading, error } = useData<any>(estudiante ? `/notas/boletin/${estudiante.id}` : null);
  const b = boletinData?.data;

  return (
    <DashboardLayout title="Boletín de Notas" allowedRoles={['PADRE']}>
      {cargandoHijos ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
      ) : estudiantes.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No tienes hijos vinculados todavía.</div>
      ) : (
        <>
          <div className="carnet-oculto-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            {estudiantes.length > 1 ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {estudiantes.map((e: any, i: number) => (
                  <button key={e.id} onClick={() => setEstudianteIdx(i)}
                    style={{ padding: '0.4rem 1rem', borderRadius: 99, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                      background: estudianteIdx === i ? 'var(--accent)' : 'var(--bg-card)', color: estudianteIdx === i ? '#fff' : 'var(--text-secondary)',
                      border: estudianteIdx !== i ? '1px solid var(--border-color)' : 'none' }}>{e.nombres}</button>
                ))}
              </div>
            ) : <div />}
            {b && (
              <button onClick={() => window.print()} className="btn-accent"><i className="bi bi-printer me-1" />Imprimir boletín</button>
            )}
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
          ) : error ? (
            <div className="sige-card" style={{ textAlign: 'center', padding: '2rem', color: '#991b1b' }}>
              <i className="bi bi-exclamation-triangle me-2" />No se pudo cargar el boletín. Es posible que el colegio no tenga matrícula activa este año o cursos configurados todavía.
            </div>
          ) : !b || b.cursos.length === 0 ? (
            <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              <i className="bi bi-journal-x" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
              Todavía no hay cursos configurados para el grado de {estudiante.nombres}.
            </div>
          ) : (
            <div className="sige-card boletin-print-root" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Boletín de Notas</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Año escolar {b.anoEscolar}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{b.estudiante.nombres} {b.estudiante.apellidos}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{b.grado} "{b.seccion}" — DNI {b.estudiante.dni}</div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="sige-table">
                  <thead>
                    <tr>
                      <th>Curso</th>
                      <th style={{ textAlign: 'center' }}>B1</th>
                      <th style={{ textAlign: 'center' }}>B2</th>
                      <th style={{ textAlign: 'center' }}>B3</th>
                      <th style={{ textAlign: 'center' }}>B4</th>
                      <th style={{ textAlign: 'center' }}>Promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.cursos.map((c: any) => (
                      <tr key={c.curso.id}>
                        <td style={{ fontWeight: 600 }}>{c.curso.nombre}</td>
                        {['BIMESTRE_1', 'BIMESTRE_2', 'BIMESTRE_3', 'BIMESTRE_4'].map(periodo => {
                          const n = c.bimestres[periodo];
                          return (
                            <td key={periodo} style={{ textAlign: 'center' }}>
                              {n ? (
                                <span style={{ fontWeight: 700, color: b.usaNumero ? 'inherit' : COLOR_LITERAL[n.literal] }}>
                                  {b.usaNumero ? n.numerica : n.literal}
                                </span>
                              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>
                          {c.promedio != null ? (b.usaNumero ? c.promedio : c.promedioLiteral) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!b.usaNumero && (
                <div style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <span><span style={{ color: COLOR_LITERAL.AD, fontWeight: 700 }}>AD</span> Logro destacado</span>
                  <span><span style={{ color: COLOR_LITERAL.A, fontWeight: 700 }}>A</span> Logro esperado</span>
                  <span><span style={{ color: COLOR_LITERAL.B, fontWeight: 700 }}>B</span> En proceso</span>
                  <span><span style={{ color: COLOR_LITERAL.C, fontWeight: 700 }}>C</span> En inicio</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
