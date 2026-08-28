'use client';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useData } from '../../../hooks/useApi';
import { motion } from 'framer-motion';

export default function DocenteDashboard() {
  const { data: asistencia } = useData<any>('/qr/sesion');
  const { data: permisos }   = useData<any>('/permisos?estado=SOLICITADO');
  const s = asistencia as any;
  return (
    <DashboardLayout title="Panel Docente" allowedRoles={['DOCENTE','AUXILIAR','TUTOR','COORDINADOR','PSICOLOGO','ENFERMERIA']}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Registrados hoy',  value: s?.registrados ?? 0,    icon: 'bi-check-circle', color: '#10b981', bg: '#d1fae5' },
          { label: 'Sin registrar',    value: s?.pendientes  ?? 0,    icon: 'bi-clock',        color: '#f59e0b', bg: '#fef3c7' },
          { label: 'Permisos activos', value: (permisos as any)?.meta?.total ?? 0, icon: 'bi-door-open', color: '#3b82f6', bg: '#dbeafe' },
        ].map((k, i) => (
          <motion.div key={k.label} className="kpi-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <div className="kpi-icon" style={{ background: k.bg, color: k.color }}><i className={`bi ${k.icon}`} /></div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{k.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{k.label}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="sige-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        <i className="bi bi-mortarboard" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          Usa el menú lateral para gestionar asistencia, observaciones y permisos de salida.
        </p>
      </div>
    </DashboardLayout>
  );
}
