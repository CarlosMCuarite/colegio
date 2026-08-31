'use client';
// app/(dashboard)/contador/page.tsx
// Nueva — BUG REAL encontrado: el rol CONTADOR existía en el sistema
// (selector de usuarios, licencias, etc.) pero no tenía NADA construido:
// se le redirigía a /admin al iniciar sesión, y esa página solo permite
// ADMINISTRADOR/DIRECTOR — así que un Contador quedaba bloqueado
// inmediatamente después de iniciar sesión, sin ver ni un solo módulo.
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useData } from '../../../hooks/useApi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function InicioContadorPage() {
  const { data } = useData<any>('/pagos?limit=1');
  const agregados: any[] = data?.meta?.agregados ?? [];
  const totalPorEstado = (estado: string) => agregados.find((a: any) => a.estado === estado)?._count ?? 0;
  const montoPendiente = agregados.find((a: any) => a.estado === 'PENDIENTE')?._sum?.monto ?? 0;
  const datosEstados = agregados.map((a: any) => ({
    estado: ({ PENDIENTE: 'Por cobrar', EN_REVISION: 'En revisión', APROBADO: 'Cobrado', RECHAZADO: 'Rechazado' } as any)[a.estado] ?? a.estado,
    monto: Number(a._sum?.monto ?? 0),
  }));

  return (
    <DashboardLayout title="Contador" allowedRoles={['CONTADOR']}>
      <div className="sige-card" style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <i className="bi bi-calculator" style={{ fontSize: '1.8rem' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Panel de Contabilidad</div>
            <div style={{ fontSize: '0.82rem', opacity: 0.9 }}>Gestión de pagos y pensiones del colegio.</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="sige-card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{totalPorEstado('APROBADO')}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Pagos aprobados</div>
        </div>
        <div className="sige-card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b' }}>{totalPorEstado('PENDIENTE')}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Por revisar</div>
        </div>
        <div className="sige-card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444' }}>{totalPorEstado('RECHAZADO')}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Rechazados</div>
        </div>
        <div className="sige-card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>S/ {Number(montoPendiente).toFixed(2)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Monto pendiente</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '1rem' }}>
        <a href="/secretaria/pagos" className="sige-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <i className="bi bi-cash-coin" style={{ fontSize: '1.4rem', color: '#059669' }} />
          <div style={{ fontWeight: 700, marginTop: 8 }}>Gestión de Pagos</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Revisar, aprobar y registrar pensiones</div>
        </a>
      </div>
      <section className="sige-card" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontSize: '0.92rem', marginBottom: 4 }}>Cartera por estado</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginTop: 0 }}>Montos acumulados para priorizar cobranza y revisión.</p>
        {datosEstados.length ? <ResponsiveContainer width="100%" height={260}>
          <BarChart data={datosEstados} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="estado" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: any) => [`S/ ${Number(value).toFixed(2)}`, 'Monto']} />
            <Bar dataKey="monto" name="Monto" fill="var(--accent)" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer> : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aún no hay movimientos para analizar.</p>}
      </section>
    </DashboardLayout>
  );
}
