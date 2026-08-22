'use client';
// components/HorarioGrid.tsx
// Vista de tabla semanal para horarios: filas = bloques de hora, columnas =
// días de la semana. Cada curso asignado se pinta con un color estable
// (derivado del nombre de la materia) respetando la hora de inicio/fin.
import { useMemo } from 'react';

// IMPORTANTE: esta numeración debe coincidir EXACTAMENTE con la que usa el
// formulario de creación (Lunes=1 ... Domingo=7). Un desfase aquí hace que
// un horario creado para "Lunes" aparezca en la columna de otro día.
const DIAS_SEMANA = [
  { num: 1, label: 'Lunes' },
  { num: 2, label: 'Martes' },
  { num: 3, label: 'Miércoles' },
  { num: 4, label: 'Jueves' },
  { num: 5, label: 'Viernes' },
  { num: 6, label: 'Sábado' },
  { num: 7, label: 'Domingo' },
];

const PALETA = [
  { bg: '#fce7f3', text: '#9d174d' }, { bg: '#fef9c3', text: '#854d0e' },
  { bg: '#dbeafe', text: '#1e40af' }, { bg: '#dcfce7', text: '#166534' },
  { bg: '#fed7aa', text: '#9a3412' }, { bg: '#e0e7ff', text: '#3730a3' },
  { bg: '#f3e8ff', text: '#6b21a8' }, { bg: '#cffafe', text: '#155e75' },
];

function colorPara(materia: string) {
  let hash = 0;
  for (let i = 0; i < materia.length; i++) hash = materia.charCodeAt(i) + ((hash << 5) - hash);
  return PALETA[Math.abs(hash) % PALETA.length];
}

/** Convierte "HH:MM" a minutos desde medianoche, para ordenar y comparar */
function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export default function HorarioGrid({ horarios }: { horarios: any[] }) {
  // Bloques de hora únicos, ordenados — cada horario define su propia fila
  const bloques = useMemo(() => {
    const set = new Map<string, { inicio: string; fin: string }>();
    horarios.forEach(h => set.set(`${h.horaInicio}-${h.horaFin}`, { inicio: h.horaInicio, fin: h.horaFin }));
    return Array.from(set.values()).sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio));
  }, [horarios]);

  // Solo mostrar columnas de días que realmente tengan al menos un horario
  const diasUsados = useMemo(() => {
    const numeros = new Set(horarios.map(h => h.diaSemana));
    return DIAS_SEMANA.filter(d => numeros.has(d.num));
  }, [horarios]);

  if (horarios.length === 0) return null;

  const buscarCelda = (dia: number, inicio: string, fin: string) =>
    horarios.find(h => h.diaSemana === dia && h.horaInicio === inicio && h.horaFin === fin);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead>
          <tr>
            <th style={{ padding: '0.5rem', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', minWidth: 100 }}>Hora</th>
            {diasUsados.map(d => (
              <th key={d.num} style={{ padding: '0.5rem', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', minWidth: 130 }}>
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloques.map(b => {
            const celdasDelBloque = diasUsados.map(d => buscarCelda(d.num, b.inicio, b.fin)).filter(Boolean);
            const esRecreo = celdasDelBloque.length > 0 && celdasDelBloque.every((h: any) => h.tipoBloque === 'RECREO');

            if (esRecreo) {
              return (
                <tr key={`${b.inicio}-${b.fin}`}>
                  <td style={{ padding: '0.5rem', border: '1px solid var(--border-color)', fontWeight: 700, fontFamily: 'monospace', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {b.inicio}–{b.fin}
                  </td>
                  <td colSpan={diasUsados.length} style={{ border: '1px solid var(--border-color)', padding: '0.4rem' }}>
                    <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '0.4rem', textAlign: 'center', fontWeight: 800, letterSpacing: '0.05em', fontSize: '0.78rem' }}>
                      <i className="bi bi-cup-hot me-2" />RECREO
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={`${b.inicio}-${b.fin}`}>
                <td style={{ padding: '0.5rem', border: '1px solid var(--border-color)', fontWeight: 700, fontFamily: 'monospace', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {b.inicio}–{b.fin}
                </td>
                {diasUsados.map(d => {
                  const h = buscarCelda(d.num, b.inicio, b.fin);
                  if (!h) return <td key={d.num} style={{ border: '1px solid var(--border-color)' }} />;
                  const c = colorPara(h.materia);
                  return (
                    <td key={d.num} style={{ border: '1px solid var(--border-color)', padding: 2 }}>
                      <div style={{ background: c.bg, color: c.text, borderRadius: 6, padding: '0.4rem 0.5rem', fontWeight: 700, textAlign: 'center' }}>
                        <div>{h.materia}</div>
                        {(h.docente || h.docenteNombre) && (
                          <div style={{ fontWeight: 500, fontSize: '0.7rem', marginTop: 2 }}>
                            {h.docente ? `${h.docente.nombres} ${h.docente.apellidos}` : h.docenteNombre}
                          </div>
                        )}
                        {h.aula?.nombre && <div style={{ fontWeight: 500, fontSize: '0.7rem' }}>{h.aula.nombre}</div>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
