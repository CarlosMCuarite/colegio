'use client';
import { useState } from 'react';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import HorarioGrid from '../../../../components/HorarioGrid';
import { useHorarios } from '../../../../hooks/useApi';
const DIAS = ['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
export default function HorariosPadrePage() {
  const [vista, setVista] = useState<'tabla' | 'lista'>('tabla');
  const { data, isLoading } = useHorarios();
  const agrupado = (data as any)?.agrupado ?? {};
  const lista     = (data as any)?.data ?? [];
  const imprimir = () => window.print();
  return (
    <DashboardLayout title="Horarios" allowedRoles={['PADRE']}>
      <div className="horario-print-root">
      <div className="print-oculto" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => setVista('tabla')}
          style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: vista === 'tabla' ? 'var(--accent)' : 'var(--bg-card)', color: vista === 'tabla' ? '#fff' : 'var(--text-secondary)' }}>
          <i className="bi bi-table me-1" />Tabla
        </button>
        <button onClick={() => setVista('lista')}
          style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: vista === 'lista' ? 'var(--accent)' : 'var(--bg-card)', color: vista === 'lista' ? '#fff' : 'var(--text-secondary)' }}>
          <i className="bi bi-list-ul me-1" />Lista
        </button>
        </div>
        <button onClick={imprimir} className="btn-accent"><i className="bi bi-printer me-1" />Imprimir horario</button>
      </div>
      <h2 className="solo-print" style={{ display: 'none', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Horario de clases</h2>

      {isLoading ? <div className="sige-card" style={{textAlign:'center',padding:'2rem',color:'var(--text-muted)'}}><div className="spinner-border spinner-border-sm" /></div> : vista === 'tabla' ? (
        lista.length === 0 ? (
          <div className="sige-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <i className="bi bi-calendar-x" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
            Sin horarios registrados
          </div>
        ) : (
          <div className="sige-card">
            <HorarioGrid horarios={lista} />
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Object.entries(agrupado).map(([dia, items]: any) => (
            <div key={dia} className="sige-card">
              <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                <i className="bi bi-calendar3 me-2" />{dia}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {items.map((h: any) => (
                  <div key={h.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)', minWidth: 100 }}>{h.horaInicio} – {h.horaFin}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{h.materia}</span>
                    {h.docenteNombre && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{h.docenteNombre}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(agrupado).length === 0 && (
            <div className="sige-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <i className="bi bi-calendar-x" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
              Sin horarios registrados
            </div>
          )}
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
