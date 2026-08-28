'use client';
// app/(dashboard)/admin/auditoria/page.tsx
import { useState } from 'react';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useAuditoria } from '../../../../hooks/useApi';

const ACCION_CONF: Record<string, { bg: string; text: string }> = {
  CREAR:     { bg: '#d1fae5', text: '#065f46' },
  LEER:      { bg: '#f0fdf4', text: '#166534' },
  ACTUALIZAR:{ bg: '#dbeafe', text: '#1e40af' },
  ELIMINAR:  { bg: '#fee2e2', text: '#991b1b' },
  LOGIN:     { bg: '#ede9fe', text: '#5b21b6' },
  LOGOUT:    { bg: '#f5f3ff', text: '#7c3aed' },
  EXPORTAR:  { bg: '#fef3c7', text: '#92400e' },
  APROBAR:   { bg: '#d1fae5', text: '#065f46' },
  RECHAZAR:  { bg: '#fee2e2', text: '#991b1b' },
  SUSPENDER: { bg: '#fef3c7', text: '#92400e' },
  RESTAURAR: { bg: '#dbeafe', text: '#1e40af' },
};

export default function AuditoriaPage() {
  const [modulo, setModulo]   = useState('');
  const [accion, setAccion]   = useState('');
  const [desde, setDesde]     = useState('');
  const [hasta, setHasta]     = useState('');
  const [page, setPage]       = useState(1);

  const params = new URLSearchParams({ modulo, accion, desde, hasta, page: String(page), limit: '50' }).toString();
  const { data, isLoading } = useAuditoria(params);

  const registros = (data as any)?.data ?? [];
  const meta      = (data as any)?.meta ?? {};

  return (
    <DashboardLayout title="Auditoría del Sistema" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR']}>

      {/* Filtros */}
      <div className="sige-card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Módulo</label>
          <input type="text" value={modulo} onChange={e => { setModulo(e.target.value); setPage(1); }}
            className="sige-input" placeholder="Ej: ESTUDIANTES" />
        </div>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Acción</label>
          <select value={accion} onChange={e => { setAccion(e.target.value); setPage(1); }} className="sige-input">
            <option value="">Todas</option>
            {Object.keys(ACCION_CONF).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Desde</label>
          <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPage(1); }} className="sige-input" />
        </div>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Hasta</label>
          <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPage(1); }} className="sige-input" />
        </div>
        <button onClick={() => { setModulo(''); setAccion(''); setDesde(''); setHasta(''); setPage(1); }}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 0.875rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          <i className="bi bi-arrow-counterclockwise me-1" />Limpiar
        </button>
      </div>

      {/* Total */}
      {meta.total > 0 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          {meta.total.toLocaleString()} registros encontrados
        </p>
      )}

      {/* Tabla */}
      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner-border spinner-border-sm me-2" />Cargando auditoría...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Módulo</th>
                  <th>IP</th>
                  <th>Colegio</th>
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    <i className="bi bi-shield-x" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
                    Sin registros para los filtros seleccionados
                  </td></tr>
                ) : registros.map((r: any) => {
                  const conf = ACCION_CONF[r.accion] ?? { bg: '#f1f5f9', text: '#475569' };
                  return (
                    <tr key={r.id}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(r.createdAt).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          {r.usuario ? `${r.usuario.nombres} ${r.usuario.apellidos}` : <span style={{ color: 'var(--text-muted)' }}>Sistema</span>}
                        </div>
                        {r.usuario?.rol && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.usuario.rol}</div>}
                      </td>
                      <td>
                        <span className="estado-badge" style={{ background: conf.bg, color: conf.text }}>
                          {r.accion}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {r.modulo}
                        {r.recursoId && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}> #{r.recursoId.slice(0, 8)}</span>}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.ip ?? '—'}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.colegio?.nombre ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {meta.total > 50 && (
          <div style={{ padding: '0.875rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Página {page} de {Math.ceil(meta.total / 50)}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p-1)} className="btn-accent"
                style={{ padding: '0.3rem 0.7rem', opacity: page <= 1 ? 0.4 : 1 }}>
                <i className="bi bi-chevron-left" />
              </button>
              <button disabled={page * 50 >= meta.total} onClick={() => setPage(p => p+1)} className="btn-accent"
                style={{ padding: '0.3rem 0.7rem', opacity: page * 50 >= meta.total ? 0.4 : 1 }}>
                <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
