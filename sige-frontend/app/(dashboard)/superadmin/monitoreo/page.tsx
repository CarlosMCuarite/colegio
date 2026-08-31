'use client';
// app/(dashboard)/superadmin/monitoreo/page.tsx
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData } from '../../../../hooks/useApi';

const ACCION_LABEL: Record<string, string> = {
  CREAR: 'creó', ACTUALIZAR: 'actualizó', ELIMINAR: 'eliminó', LOGIN: 'inició sesión',
  LOGOUT: 'cerró sesión', EXPORTAR: 'exportó', APROBAR: 'aprobó', RECHAZAR: 'rechazó',
  SUSPENDER: 'suspendió', RESTAURAR: 'restauró', RENOVAR: 'renovó',
};

function fmtUptime(seg: number) {
  const d = Math.floor(seg / 86400), h = Math.floor((seg % 86400) / 3600), m = Math.floor((seg % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export default function MonitoreoPage() {
  const { data, isLoading } = useData<any>('/dashboard/monitoreo', { refreshInterval: 5000 });
  const d = (data as any)?.data;

  if (isLoading || !d) {
    return (
      <DashboardLayout title="Monitoreo del sistema" allowedRoles={['SUPERADMIN']}>
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <span className="spinner-border spinner-border-sm me-2" />Cargando estado del sistema...
        </div>
      </DashboardLayout>
    );
  }

  const dbColor = d.baseDatos.ok ? (d.baseDatos.latenciaMs < 300 ? '#10b981' : '#f59e0b') : '#ef4444';
  const dbLabel = d.baseDatos.ok ? (d.baseDatos.latenciaMs < 300 ? 'Óptima' : 'Lenta') : 'Sin conexión';
  const capacityColor = (pct: number) => pct >= 85 ? '#ef4444' : pct >= 65 ? '#f59e0b' : '#2563eb';

  return (
    <DashboardLayout title="Monitoreo del sistema" allowedRoles={['SUPERADMIN']}>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Vista operativa en vivo · se actualiza automáticamente cada 5 segundos.
      </p>

      {/* Estado general */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="sige-card" style={{ boxShadow: `inset 0 3px 0 ${dbColor}` }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}><i className="bi bi-database me-1" />Base de datos</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: dbColor }}>{dbLabel}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{d.baseDatos.latenciaMs} ms de latencia</div>
        </div>
        <div className="sige-card" style={{ boxShadow: 'inset 0 3px 0 #4f46e5' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}><i className="bi bi-hdd-stack me-1" />Servidor</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{fmtUptime(d.servidor.uptimeSegundos)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>en línea · {d.servidor.memoriaUsadaMB} / {d.servidor.memoriaTotalMB} MB · Node {d.servidor.nodeVersion}</div>
        </div>
        <div className="sige-card" style={{ boxShadow: 'inset 0 3px 0 #10b981' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}><i className="bi bi-people me-1" />Usuarios en línea</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{d.usuarios.activosUltimos15min}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{d.usuarios.activosUltimaHora} activos en la última hora</div>
        </div>
        <div className="sige-card" style={{ boxShadow: `inset 0 3px 0 ${d.colegiosSuspendidos > 0 ? '#ef4444' : '#10b981'}` }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}><i className="bi bi-building-slash me-1" />Colegios suspendidos</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: d.colegiosSuspendidos > 0 ? '#ef4444' : 'var(--text-primary)' }}>{d.colegiosSuspendidos}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Base de datos PostgreSQL', icon: 'bi-database-fill', value: d.baseDatos },
          { label: 'Supabase Storage', icon: 'bi-cloud-fill', value: d.almacenamiento },
        ].map(({ label, icon, value }) => {
          const pct = Number(value?.porcentaje ?? 0);
          const color = capacityColor(pct);
          return <div key={label} className="sige-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
              <div><div className="enterprise-eyebrow"><i className={`bi ${icon} me-1`} />Capacidad</div><strong>{label}</strong></div>
              <span style={{ color, fontSize: '1.15rem', fontWeight: 900 }}>{pct}%</span>
            </div>
            <div style={{ height: 9, borderRadius: 99, background: `${color}20`, overflow: 'hidden', margin: '.85rem 0 .5rem' }}>
              <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: 99, background: color, transition: 'width .45s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '.76rem' }}>
              <span>{Number(value?.usadoMB ?? 0).toFixed(2)} MB usados</span><span>{value?.limiteMB ?? 0} MB disponibles</span>
            </div>
            {value?.archivos !== undefined && <div style={{ marginTop: '.65rem', fontSize: '.76rem', color: 'var(--text-secondary)' }}><i className="bi bi-files me-1" />{value.archivos} archivos en {value.buckets?.length ?? 0} buckets</div>}
            {pct >= 85 && <div style={{ marginTop: '.65rem', color: '#b91c1c', fontSize: '.76rem', fontWeight: 700 }}><i className="bi bi-exclamation-triangle me-1" />Capacidad crítica: libera espacio o amplía el plan.</div>}
          </div>;
        })}
      </div>

      {/* Accesos recientes */}
      <div className="sige-card" style={{ marginBottom: '1.25rem' }}>
        <div className="enterprise-section-title">
          <div>
            <div className="enterprise-eyebrow">Sesiones</div>
            <h3><i className="bi bi-person-check me-2" />Últimos accesos detectados</h3>
          </div>
          <span className="estado-badge" style={{ background: '#dcfce7', color: '#166534' }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#22c55e', marginRight: 6 }} />En vivo
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="sige-table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Colegio</th><th>Último acceso</th></tr></thead>
            <tbody>
              {(d.usuarios.ultimosAccesos ?? []).map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}>
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                        : <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{u.nombres?.[0]}{u.apellidos?.[0]}</span>}
                      <div><strong>{u.nombres} {u.apellidos}</strong><div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{u.email}</div></div>
                    </div>
                  </td>
                  <td><span className="estado-badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{u.rol}</span></td>
                  <td>{u.colegio?.nombre ?? 'Plataforma SIGE'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleString('es-PE') : '—'}</td>
                </tr>
              ))}
              {(d.usuarios.ultimosAccesos ?? []).length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Todavía no hay accesos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backups */}
      <div className="sige-card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.875rem' }}><i className="bi bi-archive me-2" />Backups automáticos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          {[{ label: 'Últimas 24h', v: d.backups.ultimas24h }, { label: 'Últimos 7 días', v: d.backups.ultimos7d }].map(({ label, v }) => (
            <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '0.875rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: v.tasaExito === null ? 'var(--text-muted)' : v.tasaExito >= 90 ? '#10b981' : v.tasaExito >= 50 ? '#f59e0b' : '#ef4444' }}>
                  {v.tasaExito === null ? '—' : `${v.tasaExito}%`}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{v.exitosos} ok · {v.fallidos} fallidos · {v.total} total</span>
              </div>
            </div>
          ))}
        </div>
        {d.backups.fallosRecientes.length > 0 && (
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Fallos recientes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {d.backups.fallosRecientes.map((b: any) => (
                <div key={b.id} style={{ fontSize: '0.78rem', display: 'flex', gap: '0.6rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: '#ef4444' }}><i className="bi bi-x-circle" /></span>
                  <span style={{ fontWeight: 600 }}>{b.colegio?.nombre}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{new Date(b.createdAt).toLocaleString('es-PE')}</span>
                  {b.error && <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {b.error}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actividad reciente */}
      <div className="sige-card">
        <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.875rem' }}><i className="bi bi-activity me-2" />Actividad reciente en la plataforma</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 400, overflowY: 'auto' }}>
          {d.actividadReciente.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem' }}>Sin actividad registrada</div>
          ) : d.actividadReciente.map((a: any) => (
            <div key={a.id} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.8rem', alignItems: 'baseline', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-muted)', minWidth: 130, fontSize: '0.72rem' }}>{new Date(a.createdAt).toLocaleString('es-PE')}</span>
              <span style={{ color: 'var(--text-primary)' }}>
                <strong>{a.usuario ? `${a.usuario.nombres} ${a.usuario.apellidos}` : 'Sistema'}</strong>
                {' '}{ACCION_LABEL[a.accion] ?? a.accion.toLowerCase()} en <strong>{a.modulo}</strong>
                {a.colegio?.nombre && <span style={{ color: 'var(--text-muted)' }}> · {a.colegio.nombre}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
