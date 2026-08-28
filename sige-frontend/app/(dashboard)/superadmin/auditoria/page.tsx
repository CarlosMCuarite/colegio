'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData } from '../../../../hooks/useApi';

const ACCION_CONF: Record<string, { bg: string; text: string }> = {
  CREAR:      { bg: '#d1fae5', text: '#065f46' },
  ACTUALIZAR: { bg: '#dbeafe', text: '#1e40af' },
  ELIMINAR:   { bg: '#fee2e2', text: '#991b1b' },
  LOGIN:      { bg: '#ede9fe', text: '#5b21b6' },
  LOGOUT:     { bg: '#f5f3ff', text: '#7c3aed' },
  EXPORTAR:   { bg: '#fef3c7', text: '#92400e' },
  APROBAR:    { bg: '#d1fae5', text: '#065f46' },
  RECHAZAR:   { bg: '#fee2e2', text: '#991b1b' },
  SUSPENDER:  { bg: '#fef3c7', text: '#92400e' },
};

export default function AuditoriaGlobalPage() {
  const [colegioFiltro, setColegioFiltro] = useState('');
  const [modulo, setModulo]               = useState('');
  const [accion, setAccion]               = useState('');
  const [desde, setDesde]                 = useState('');
  const [hasta, setHasta]                 = useState('');
  const [page, setPage]                   = useState(1);

  const params = new URLSearchParams({
    ...(colegioFiltro && { colegioId: colegioFiltro }),
    ...(modulo        && { modulo }),
    ...(accion        && { accion }),
    ...(desde         && { desde }),
    ...(hasta         && { hasta }),
    page:  String(page),
    limit: '60',
  }).toString();

  const { data, isLoading } = useData<any>(`/auditoria/global?${params}`);
  const { data: colegiosData } = useData<any>('/colegios');

  const registros = (data as any)?.data ?? [];
  const meta      = (data as any)?.meta ?? {};
  const colegios  = Array.isArray((colegiosData as any)?.data) ? (colegiosData as any).data : [];

  const limpiar = () => {
    setColegioFiltro(''); setModulo(''); setAccion('');
    setDesde(''); setHasta(''); setPage(1);
  };

  return (
    <DashboardLayout title="Auditoría Global" allowedRoles={['SUPERADMIN']}>

      {/* Filtros */}
      <div className="sige-card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 180 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Colegio</label>
          <select value={colegioFiltro} onChange={e => { setColegioFiltro(e.target.value); setPage(1); }} className="sige-input">
            <option value="">Todos los colegios</option>
            {colegios.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Módulo</label>
          <input type="text" value={modulo} onChange={e => { setModulo(e.target.value); setPage(1); }}
            className="sige-input" placeholder="Ej: AUTH" />
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Acción</label>
          <select value={accion} onChange={e => { setAccion(e.target.value); setPage(1); }} className="sige-input">
            <option value="">Todas</option>
            {Object.keys(ACCION_CONF).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Desde</label>
          <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPage(1); }} className="sige-input" />
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Hasta</label>
          <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPage(1); }} className="sige-input" />
        </div>
        <button onClick={limpiar}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 0.875rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          <i className="bi bi-arrow-counterclockwise me-1" />Limpiar
        </button>
      </div>

      {/* Contador */}
      {meta.total !== undefined && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          <strong>{meta.total.toLocaleString()}</strong> registros en total
        </p>
      )}

      {/* Tabla */}
      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner-border spinner-border-sm me-2" />Cargando auditoría global...
          </div>
        ) : registros.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="bi bi-shield-x" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />
            Sin registros de auditoría aún.<br />
            <span style={{ fontSize: '0.82rem' }}>Aparecerán aquí cuando los usuarios del sistema realicen acciones.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Colegio</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Módulo</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r: any, i: number) => {
                  const conf = ACCION_CONF[r.accion] ?? { bg: '#f1f5f9', text: '#475569' };
                  return (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(r.createdAt).toLocaleString('es-PE', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {r.colegio?.nombre ?? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Sistema</span>}
                      </td>
                      <td>
                        {r.usuario ? (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{r.usuario.nombres}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.usuario.rol}</div>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sistema</span>}
                      </td>
                      <td>
                        <span className="estado-badge" style={{ background: conf.bg, color: conf.text, fontSize: '0.72rem' }}>
                          {r.accion}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {r.modulo}
                        {r.recursoId && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                            #{r.recursoId.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {r.ip ?? '—'}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {meta.total > 60 && (
          <div style={{ padding: '0.875rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Pág. {page} de {Math.ceil(meta.total / 60)}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p-1)} className="btn-accent"
                style={{ padding: '0.3rem 0.7rem', opacity: page <= 1 ? 0.4 : 1 }}>
                <i className="bi bi-chevron-left" />
              </button>
              <button disabled={page * 60 >= meta.total} onClick={() => setPage(p => p+1)} className="btn-accent"
                style={{ padding: '0.3rem 0.7rem', opacity: page * 60 >= meta.total ? 0.4 : 1 }}>
                <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
