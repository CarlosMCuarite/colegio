'use client';
import { motion } from 'framer-motion';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useData } from '../../../hooks/useApi';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const ESTADO_COLOR: Record<string, string> = { ACTIVO: '#10b981', SUSPENDIDO: '#ef4444', INACTIVO: '#64748b', PRUEBA: '#f59e0b' };
const COLORS = ['#4f46e5','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#06b6d4'];

function KpiCard({ label, value, icon, color, bg, href, sub }: any) {
  const content = (
    <motion.div className="kpi-card executive-kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ cursor: href ? 'pointer' : 'default' }} whileHover={href ? { y: -2 } : {}}>
      <div className="kpi-icon" style={{ background: bg, color }}><i className={`bi ${icon}`} /></div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
          {typeof value === 'number' ? value.toLocaleString('es-PE') : value}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
    </motion.div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}

export default function SuperadminDashboard() {
  const { data, isLoading } = useData<any>('/dashboard/superadmin');

  const d = (data as any)?.data;

  if (isLoading) return (
    <DashboardLayout title="Panel Superadministrador" allowedRoles={['SUPERADMIN']}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '1rem' }}>
        {[...Array(8)].map((_, i) => <div key={i} className="sige-card animate-pulse" style={{ height: 90 }} />)}
      </div>
    </DashboardLayout>
  );

  const kpis = [
    { label: 'Colegios', value: d?.kpis?.totalColegios ?? 0, icon: 'bi-building', color: '#4f46e5', bg: '#eef2ff', href: '/superadmin/colegios',
      sub: `${d?.kpis?.colegiosActivos ?? 0} activos · ${d?.kpis?.colegiosSuspendidos ?? 0} susp. · ${d?.kpis?.colegiosEnPrueba ?? 0} prueba` },
    { label: 'Licencias activas', value: d?.kpis?.licenciasActivas ?? 0, icon: 'bi-patch-check', color: '#10b981', bg: '#d1fae5', href: '/superadmin/facturacion',
      sub: `${d?.kpis?.licenciasPorVencer ?? 0} por vencer · ${d?.kpis?.licenciasVencidas ?? 0} vencidas` },
    { label: 'Ingresos por suscripción', value: `S/ ${Number(d?.kpis?.ingresosSuscripcion ?? 0).toLocaleString('es-PE')}`, icon: 'bi-cash-stack', color: '#059669', bg: '#d1fae5', href: '/superadmin/facturacion', sub: 'histórico aprobado' },
    { label: 'Usuarios activos', value: d?.kpis?.totalUsuarios ?? 0, icon: 'bi-person-gear', color: '#8b5cf6', bg: '#ede9fe', href: null,
      sub: `${d?.kpis?.totalEstudiantes ?? 0} estudiantes · ${d?.kpis?.totalPadres ?? 0} padres` },
    { label: 'MRR', value: `S/ ${Number(d?.kpis?.mrr ?? 0).toLocaleString('es-PE')}`, icon: 'bi-graph-up-arrow', color: '#dc2626', bg: '#fee2e2', href: null, sub: 'ingreso mensual recurrente' },
  ];

  const barEstado = (d?.colegiosPorEstado ?? []).map((e: any) => ({ name: e.estado, total: e._count, fill: ESTADO_COLOR[e.estado] ?? '#64748b' }));
  const pieRoles  = (d?.graficos?.usuariosPorRol ?? []).map((r: any) => ({ name: r.rol, value: r.total }));
  const lineMatriculas = (d?.graficos?.matriculasPorMes ?? []).map((m: any) => ({ mes: m.mes, total: Number(m.total) }));
  const asistenciaHoy  = d?.graficos?.asistenciaGlobal ?? [];
  const lineIngresos   = (d?.graficos?.ingresosPorMes ?? []).map((m: any) => ({ mes: m.mes, total: Number(m.total ?? 0) }));

  const totalAlertas = (d?.alertas?.colegiosVencidos?.length ?? 0) + (d?.alertas?.colegiosPorVencer?.length ?? 0)
    + (d?.alertas?.pagosPendientesRevision ?? 0) + (d?.alertas?.backupsFallidos24h ?? 0);
  const salud = totalAlertas === 0 ? 'Operación saludable' : totalAlertas <= 3 ? 'Atención preventiva' : 'Requiere intervención';
  const saludClase = totalAlertas === 0 ? 'healthy' : totalAlertas <= 3 ? 'warning' : 'critical';

  return (
    <DashboardLayout title="Panel Superadministrador" allowedRoles={['SUPERADMIN']}>
      <motion.section className="executive-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <span className="executive-eyebrow"><i className="bi bi-stars" /> Centro de comando SIGE</span>
          <h1>Vista ejecutiva de la plataforma</h1>
          <p>Ingresos, adopción, continuidad y riesgos operativos en una sola lectura.</p>
        </div>
        <div className="executive-hero-actions">
          <div className={`platform-health ${saludClase}`}><span />{salud}<strong>{totalAlertas} alertas</strong></div>
          <Link href="/superadmin/monitoreo" className="executive-action">Ver monitoreo <i className="bi bi-arrow-up-right" /></Link>
        </div>
      </motion.section>

      <div className="executive-kpi-grid">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {totalAlertas > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sige-card" style={{ marginBottom: '1.25rem', borderLeft: '3px solid #f59e0b' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.875rem', color: 'var(--text-primary)' }}>
            <i className="bi bi-bell me-2" style={{ color: '#f59e0b' }} />Centro de alertas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {(d?.alertas?.colegiosVencidos ?? []).length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)' }}><strong>{d.alertas.colegiosVencidos.length}</strong> colegio(s) con licencia vencida</span>
                <Link href="/superadmin/facturacion" style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Ver →</Link>
              </div>
            )}
            {(d?.alertas?.colegiosPorVencer ?? []).length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)' }}><strong>{d.alertas.colegiosPorVencer.length}</strong> licencia(s) vencen en los próximos 30 días</span>
                <Link href="/superadmin/facturacion" style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Ver →</Link>
              </div>
            )}
            {(d?.alertas?.pagosPendientesRevision ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)' }}><strong>{d.alertas.pagosPendientesRevision}</strong> pago(s) de suscripción esperando revisión</span>
                <Link href="/superadmin/facturacion" style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Ver →</Link>
              </div>
            )}
            {(d?.alertas?.backupsFallidos24h ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)' }}><strong>{d.alertas.backupsFallidos24h}</strong> backup(s) fallidos en las últimas 24h</span>
                <Link href="/superadmin/backups" style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Ver →</Link>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <div className="executive-chart-grid">
        <div className="sige-card executive-chart-card">
          <h3 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-primary)' }}><i className="bi bi-building me-2" />Colegios por estado</h3>
          {barEstado.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin colegios</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barEstado} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="total" radius={[4,4,0,0]}>{barEstado.map((e: any, i: number) => <Cell key={i} fill={e.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {barEstado.map((e: any) => (
                  <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: e.fill }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{e.name}: <strong>{e.total}</strong></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="sige-card executive-chart-card">
          <h3 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-primary)' }}><i className="bi bi-people me-2" />Usuarios por rol</h3>
          {pieRoles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin datos</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie data={pieRoles} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                    {pieRoles.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                {pieRoles.map((r: any, i: number) => (
                  <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                    <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{r.name}</span><strong>{r.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="executive-chart-grid">
        <div className="sige-card executive-chart-card">
          <h3 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-primary)' }}><i className="bi bi-graph-up me-2" />Crecimiento — Matrículas últimos meses</h3>
          {lineMatriculas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin matrículas registradas</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineMatriculas} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="total" name="Matrículas" stroke="#4f46e5" strokeWidth={2} dot={{ fill: '#4f46e5', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="sige-card executive-chart-card">
          <h3 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-primary)' }}><i className="bi bi-cash-coin me-2" />Ingresos por suscripción — últimos 12 meses</h3>
          {lineIngresos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin pagos de suscripción aprobados todavía</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineIngresos} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`S/ ${v}`, 'Ingresos']} />
                <Line type="monotone" dataKey="total" name="Ingresos (S/)" stroke="#059669" strokeWidth={2} dot={{ fill: '#059669', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="sige-card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-primary)' }}><i className="bi bi-calendar-check me-2" />Asistencia global hoy</h3>
        {asistenciaHoy.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin registros hoy</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            {asistenciaHoy.map((a: any) => {
              const conf: Record<string, any> = {
                PRESENTE: { color: '#10b981', icon: 'bi-check-circle', label: 'Presentes' },
                AUSENTE: { color: '#ef4444', icon: 'bi-x-circle', label: 'Ausentes' },
                TARDANZA: { color: '#f59e0b', icon: 'bi-clock', label: 'Tardanzas' },
                JUSTIFICADO: { color: '#3b82f6', icon: 'bi-shield-check', label: 'Justificados' },
                PERMISO: { color: '#8b5cf6', icon: 'bi-door-open', label: 'Permisos' },
              };
              const c = conf[a.estado] ?? { color: '#64748b', icon: 'bi-dash', label: a.estado };
              return (
                <div key={a.estado} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: '1rem', width: 20 }} />
                  <span style={{ flex: 1, fontSize: '0.85rem' }}>{c.label}</span>
                  <span style={{ fontWeight: 700, color: c.color, fontSize: '1rem' }}>{a._count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>


      <h3 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Accesos rápidos</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { href: '/superadmin/colegios', icon: 'bi-building', label: 'Colegios', color: '#4f46e5', bg: '#eef2ff' },
          { href: '/superadmin/membresias', icon: 'bi-credit-card', label: 'Membresías', color: '#10b981', bg: '#d1fae5' },
          { href: '/superadmin/auditoria', icon: 'bi-shield-check', label: 'Auditoría', color: '#3b82f6', bg: '#dbeafe' },
          { href: '/superadmin/configuracion', icon: 'bi-gear', label: 'Configuración', color: '#f59e0b', bg: '#fef3c7' },
        ].map((a) => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
            <div className="sige-card" style={{ textAlign: 'center', padding: '1rem 0.75rem', cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.625rem' }}>
                <i className={`bi ${a.icon}`} style={{ color: a.color, fontSize: '1.1rem' }} />
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {(d?.ultimaAuditoria ?? []).length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Actividad reciente</h3>
            <Link href="/superadmin/auditoria" style={{ fontSize: '0.78rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Ver todo →</Link>
          </div>
          <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="sige-table">
                <thead><tr><th>Fecha</th><th>Colegio</th><th>Usuario</th><th>Acción</th><th>Módulo</th></tr></thead>
                <tbody>
                  {(d.ultimaAuditoria as any[]).map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(r.createdAt).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
                      <td style={{ fontSize: '0.78rem' }}>{r.colegio?.nombre ?? <span style={{ color: 'var(--accent)' }}>Sistema</span>}</td>
                      <td><div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{r.usuario?.nombres ?? '—'}</div></td>
                      <td><span className="estado-badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '0.7rem' }}>{r.accion}</span></td>
                      <td style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{r.modulo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
