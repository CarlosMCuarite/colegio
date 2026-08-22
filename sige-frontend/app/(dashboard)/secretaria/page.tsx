'use client';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useData, useDashboardEjecutivo } from '@/hooks/useApi';
import Link from 'next/link';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
const ESTADO_PAGO_LABELS: Record<string, string> = { PENDIENTE: 'Por cobrar', EN_REVISION: 'En revisión', APROBADO: 'Cobrado', RECHAZADO: 'Rechazado' };

export default function SecretariaDashboard() {
  const { data: qrData }      = useData<any>('/qr/sesion');
  const { data: pagosData }   = useData<any>('/pagos?estado=EN_REVISION&limit=5');
  const { data: permisosData }= useData<any>('/permisos?estado=SOLICITADO&limit=5');
  const { data: docsData }    = useData<any>('/documentos?estado=PENDIENTE&limit=5');
  const { data: ejecutivoData } = useDashboardEjecutivo();

  const ej = (ejecutivoData as any)?.data;
  const asistenciaSemana = ej?.asistencia?.semana ?? [];
  const pagosPorEstado = (pagosData as any)?.meta?.agregados ?? [];

  const s = qrData as any;
  const pagosPendientes  = (pagosData as any)?.data ?? [];
  const permisosPendientes = (permisosData as any)?.data ?? [];
  const docsPendientes   = (docsData as any)?.data ?? [];

  const accesosRapidos = [
    { href: '/secretaria/qr',          icon: 'bi-qr-code-scan',      label: 'Registrar Asistencia QR', color: '#4f46e5', bg: '#eef2ff' },
    { href: '/secretaria/estudiantes', icon: 'bi-person-badge',       label: 'Gestionar Estudiantes',   color: '#10b981', bg: '#d1fae5' },
    { href: '/secretaria/padres',      icon: 'bi-people',             label: 'Gestionar Padres',        color: '#3b82f6', bg: '#dbeafe' },
    { href: '/secretaria/matriculas',  icon: 'bi-file-earmark-text',  label: 'Registrar Matrícula',     color: '#f59e0b', bg: '#fef3c7' },
    { href: '/secretaria/pagos',       icon: 'bi-cash-stack',         label: 'Revisar Pagos',           color: '#ef4444', bg: '#fee2e2' },
    { href: '/secretaria/permisos',    icon: 'bi-door-open',          label: 'Permisos de Salida',      color: '#8b5cf6', bg: '#ede9fe' },
  ];

  return (
    <DashboardLayout title="Panel Secretaría" allowedRoles={['SUPERADMIN','ADMINISTRADOR','SECRETARIA']}>

      {/* KPIs asistencia hoy */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Registrados hoy',   value: s?.registrados        ?? 0, icon: 'bi-check-circle',  color: '#10b981', bg: '#d1fae5' },
          { label: 'Sin registrar',     value: s?.pendientes         ?? 0, icon: 'bi-clock',          color: '#f59e0b', bg: '#fef3c7' },
          { label: 'Pagos en revisión', value: pagosPendientes.length,     icon: 'bi-cash-stack',     color: '#3b82f6', bg: '#dbeafe' },
          { label: 'Permisos activos',  value: permisosPendientes.length,  icon: 'bi-door-open',      color: '#ef4444', bg: '#fee2e2' },
          { label: 'Docs pendientes',   value: docsPendientes.length,      icon: 'bi-folder2',        color: '#8b5cf6', bg: '#ede9fe' },
        ].map((k, i) => (
          <motion.div key={k.label} className="kpi-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <div className="kpi-icon" style={{ background: k.bg, color: k.color }}><i className={`bi ${k.icon}`} /></div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{k.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{k.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Accesos rápidos */}
      <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
        Accesos rápidos
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {accesosRapidos.map((a, i) => (
          <motion.div key={a.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Link href={a.href} style={{ textDecoration: 'none' }}>
              <div className="sige-card" style={{ textAlign: 'center', padding: '1.25rem 0.75rem', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = a.color)} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                  <i className={`bi ${a.icon}`} style={{ color: a.color, fontSize: '1.2rem' }} />
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{a.label}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Gráficos — vista tipo panel de control con datos de la semana */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="sige-card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            <i className="bi bi-calendar-check me-2" />Asistencia — Últimos 7 días
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={asistenciaSemana}>
              <defs>
                <linearGradient id="gPresenteSec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gAusenteSec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="presente" name="Presentes" stroke="#4f46e5" fill="url(#gPresenteSec)" strokeWidth={2} />
              <Area type="monotone" dataKey="ausente" name="Ausentes" stroke="#ef4444" fill="url(#gAusenteSec)" strokeWidth={2} />
              <Area type="monotone" dataKey="tardanza" name="Tardanzas" stroke="#f59e0b" fill="none" strokeWidth={2} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="sige-card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            <i className="bi bi-cash-coin me-2" />Pagos por estado
          </h3>
          {pagosPorEstado.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin datos de pagos todavía</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pagosPorEstado.map((a: any) => ({ name: ESTADO_PAGO_LABELS[a.estado] ?? a.estado, value: a._count }))}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pagosPorEstado.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Pendientes */}
      {pagosPendientes.length > 0 && (
        <div className="sige-card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>
              <i className="bi bi-cash-stack me-2" style={{ color: '#3b82f6' }} />Pagos en revisión
            </h3>
            <Link href="/secretaria/pagos" style={{ fontSize: '0.78rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Ver todos →</Link>
          </div>
          {pagosPendientes.map((p: any) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{p.padre?.nombres} {p.padre?.apellidos}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.concepto?.nombre ?? p.tipo} — {p.periodoPago}</div>
              </div>
              <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem' }}>S/ {Number(p.monto).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
