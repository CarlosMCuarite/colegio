'use client';
// app/(dashboard)/admin/page.tsx
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDashboardEjecutivo } from '@/hooks/useApi';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const COLORS = ['#4f46e5','#10b981','#f59e0b','#ef4444','#3b82f6'];

const ESTADO_LABELS: Record<string, string> = {
  PRESENTE: 'Presentes', AUSENTE: 'Ausentes', TARDANZA: 'Tardanzas',
  JUSTIFICADO: 'Justificados', PERMISO: 'Permisos',
};

export default function AdminDashboard() {
  const { data, isLoading } = useDashboardEjecutivo();

  if (isLoading) return (
    <DashboardLayout title="Dashboard" allowedRoles={['ADMINISTRADOR','DIRECTOR']}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '1rem' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="sige-card animate-pulse" style={{ height: 100, background: 'var(--bg-secondary)' }} />
        ))}
      </div>
    </DashboardLayout>
  );

  const d = (data as any)?.data;
  const asistenciaHoy = d?.asistencia?.hoy ?? [];
  const asistenciaSemana = d?.asistencia?.semana ?? [];

  const kpiItems = [
    { label: 'Estudiantes Activos', value: d?.kpis?.totalEstudiantes ?? 0, icon: 'bi-person-badge', color: '#4f46e5', bg: '#eef2ff' },
    { label: 'Docentes', value: d?.kpis?.totalDocentes ?? 0, icon: 'bi-mortarboard', color: '#06b6d4', bg: '#ecfeff' },
    { label: 'Padres', value: d?.kpis?.totalPadres ?? 0, icon: 'bi-people', color: '#8b5cf6', bg: '#ede9fe' },
    { label: 'Usuarios Activos', value: d?.kpis?.usuariosActivos ?? 0, icon: 'bi-person-gear', color: '#64748b', bg: '#f1f5f9' },
    { label: 'Matrículas', value: d?.kpis?.matriculasAno ?? 0, icon: 'bi-file-earmark-text', color: '#10b981', bg: '#d1fae5' },
    { label: 'Ingresos del Mes', value: `S/ ${(d?.finanzas?.ingresosMes?.monto ?? 0).toFixed(2)}`, icon: 'bi-cash-stack', color: '#f59e0b', bg: '#fef3c7' },
    { label: 'Cobros Pendientes', value: `S/ ${(d?.finanzas?.pendientesCobrar?.monto ?? 0).toFixed(2)}`, icon: 'bi-exclamation-circle', color: '#ef4444', bg: '#fee2e2' },
    { label: 'Documentos Pendientes', value: d?.kpis?.documentosPendientes ?? 0, icon: 'bi-folder2', color: '#3b82f6', bg: '#dbeafe' },
    { label: 'Permisos Pendientes', value: d?.kpis?.permisosPendientes ?? 0, icon: 'bi-door-open', color: '#8b5cf6', bg: '#ede9fe' },
  ];

  // Datos para pie de estudiantes por estado
  const pieData = (d?.estudiantes?.porEstado ?? []).map((e: any) => ({
    name: e.estado, value: e._count,
  }));

  return (
    <DashboardLayout title="Dashboard Ejecutivo" allowedRoles={['ADMINISTRADOR','DIRECTOR']}>
      <PlanActivoCard colegio={d?.colegio} licencia={d?.licencia} />
      {/* Alerta licencia */}
      {d?.licencia?.alerta && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
        >
          <i className="bi bi-exclamation-triangle" style={{ color: '#d97706', fontSize: '1.1rem' }} />
          <span style={{ color: '#92400e', fontSize: '0.875rem', fontWeight: 500 }}>
            ⚠️ Tu licencia vence en <strong>{d.licencia.diasRestantes} días</strong>. Contacta con soporte para renovar.
          </span>
        </motion.div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {kpiItems.map((k, i) => (
          <motion.div
            key={k.label}
            className="kpi-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <div className="kpi-icon" style={{ background: k.bg, color: k.color }}>
              <i className={`bi ${k.icon}`} />
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{k.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{k.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

        {/* Asistencia semanal */}
        <div className="sige-card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            <i className="bi bi-calendar-check me-2" />Asistencia — Últimos 7 días
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={asistenciaSemana}>
              <defs>
                <linearGradient id="gPresente" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gAusente" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="presente" name="Presentes" stroke="#4f46e5" fill="url(#gPresente)" strokeWidth={2} />
              <Area type="monotone" dataKey="ausente"  name="Ausentes"  stroke="#ef4444" fill="url(#gAusente)"  strokeWidth={2} />
              <Area type="monotone" dataKey="tardanza" name="Tardanzas" stroke="#f59e0b" fill="none" strokeWidth={2} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución estudiantes */}
        <div className="sige-card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            <i className="bi bi-pie-chart me-2" />Estudiantes por estado
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {pieData.map((_: any, index: number) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Asistencia hoy + Almacenamiento */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

        {/* Asistencia hoy */}
        <div className="sige-card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            <i className="bi bi-calendar-day me-2" />Asistencia de hoy
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {asistenciaHoy.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin registros aún</p>
            ) : asistenciaHoy.map((a: any) => {
              const config: Record<string, { color: string; icon: string }> = {
                PRESENTE:    { color: '#10b981', icon: 'bi-check-circle' },
                AUSENTE:     { color: '#ef4444', icon: 'bi-x-circle' },
                TARDANZA:    { color: '#f59e0b', icon: 'bi-clock' },
                JUSTIFICADO: { color: '#3b82f6', icon: 'bi-shield-check' },
                PERMISO:     { color: '#8b5cf6', icon: 'bi-door-open' },
              };
              const cfg = config[a.estado] ?? { color: '#64748b', icon: 'bi-dash' };
              return (
                <div key={a.estado} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <i className={`bi ${cfg.icon}`} style={{ color: cfg.color, fontSize: '1rem', width: 20 }} />
                  <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {ESTADO_LABELS[a.estado] ?? a.estado}
                  </span>
                  <span style={{ fontWeight: 700, color: cfg.color }}>{a._count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Almacenamiento + Eventos próximos */}
        <div className="sige-card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            <i className="bi bi-calendar-event me-2" />Próximos eventos
          </h3>
          {(d?.eventosProximos ?? []).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin eventos próximos</p>
          ) : (d?.eventosProximos ?? []).map((ev: any) => (
            <div key={ev.id} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 42, textAlign: 'center', background: 'var(--accent-soft)', borderRadius: 8, padding: '4px 0' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {new Date(ev.fechaInicio).toLocaleString('es-PE', { month: 'short' })}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                  {new Date(ev.fechaInicio).getDate()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.titulo}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ev.tipo}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

function PlanActivoCard({ colegio, licencia }: any) {
  if (!colegio) return null;
  const dias = licencia?.diasRestantes;
  let color = '#10b981', bg = '#d1fae5', label = 'Vigente';
  if (colegio.estado === 'SUSPENDIDO') { color = '#ef4444'; bg = '#fee2e2'; label = 'Suspendido'; }
  else if (dias !== null && dias !== undefined && dias <= 0) { color = '#ef4444'; bg = '#fee2e2'; label = 'Vencido'; }
  else if (dias !== null && dias !== undefined && dias <= 15) { color = '#ef4444'; bg = '#fee2e2'; label = `Vence en ${dias} días`; }
  else if (dias !== null && dias !== undefined && dias <= 30) { color = '#f59e0b'; bg = '#fef3c7'; label = `Vence en ${dias} días`; }
  else if (dias !== null && dias !== undefined) { label = `${dias} días restantes`; }

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="sige-card"
      style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', borderLeft: `4px solid ${color}` }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className="bi bi-patch-check" style={{ color, fontSize: '1.2rem' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Plan Activo</div>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{colegio.planNombre ?? 'Sin plan'}</div>
      </div>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color, background: bg, padding: '4px 12px', borderRadius: 99 }}>{label}</span>
    </motion.div>
  );
}
