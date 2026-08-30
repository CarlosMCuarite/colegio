'use client';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import PerfilYPassword from '../../../../components/PerfilYPassword';
import Link from 'next/link';
import { useData } from '../../../../hooks/useApi';

// Antes esta página tenía su propio formulario duplicado y más limitado
// (sin foto de perfil, sin DNI/dirección). Ahora reusa el mismo componente
// que ya usan Secretaría/Docente/Padre, así el SuperAdmin tiene los mismos
// datos completos y la subida de foto de perfil (con conversión a WebP en
// el backend) sin mantener dos formularios distintos.
export default function ConfiguracionSuperadminPage() {
  const { data } = useData<any>('/dashboard/superadmin');
  const d = (data as any)?.data;
  const fallidos = d?.alertas?.backupsFallidos24h ?? 0;
  const pendientes = d?.alertas?.pagosPendientesRevision ?? 0;
  const accesos = [
    { href: '/superadmin/roles-plan', icon: 'bi-person-lock', title: 'Gobierno de acceso', text: 'Define qué roles habilita cada plan comercial.' },
    { href: '/superadmin/auditoria', icon: 'bi-shield-check', title: 'Trazabilidad global', text: 'Consulta acciones sensibles y actividad por colegio.' },
    { href: '/superadmin/backups', icon: 'bi-database-check', title: 'Continuidad operativa', text: fallidos ? `${fallidos} respaldo(s) requieren atención.` : 'Respaldos versionados sin incidentes en 24 horas.' },
    { href: '/superadmin/monitoreo', icon: 'bi-activity', title: 'Salud de plataforma', text: 'Comprueba disponibilidad, base de datos y almacenamiento.' },
  ];
  return (
    <DashboardLayout title="Configuración" allowedRoles={['SUPERADMIN']}>
      <section className="enterprise-config-hero">
        <div><span>Gobierno de plataforma</span><h2>Centro de configuración empresarial</h2><p>Identidad, seguridad, continuidad y operación de todos los colegios.</p></div>
        <div className={fallidos || pendientes ? 'enterprise-config-status attention' : 'enterprise-config-status'}>
          <i className={`bi ${fallidos || pendientes ? 'bi-exclamation-triangle' : 'bi-check-circle'}`} />
          <div><strong>{fallidos || pendientes ? 'Acciones pendientes' : 'Operación controlada'}</strong><small>{fallidos} backups · {pendientes} pagos por revisar</small></div>
        </div>
      </section>
      <div className="enterprise-config-grid">
        {accesos.map(item => <Link href={item.href} key={item.href} className="enterprise-config-card"><i className={`bi ${item.icon}`} /><div><strong>{item.title}</strong><p>{item.text}</p></div><i className="bi bi-arrow-up-right" /></Link>)}
      </div>
      <div className="enterprise-section-title"><div><span>Cuenta maestra</span><h3>Perfil y seguridad personal</h3></div><p>Mantén actualizados los datos del responsable de la plataforma y su contraseña.</p></div>
      <PerfilYPassword />
    </DashboardLayout>
  );
}
