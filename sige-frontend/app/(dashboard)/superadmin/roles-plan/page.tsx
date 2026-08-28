'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const ROLES_OPCIONALES = [
  { key: 'DIRECTOR',    label: 'Director',    icon: 'bi-person-badge',     desc: 'Dirección académica'         },
  { key: 'SECRETARIA',  label: 'Secretaría',  icon: 'bi-folder2',          desc: 'Gestión administrativa'      },
  { key: 'DOCENTE',     label: 'Docente',     icon: 'bi-mortarboard',      desc: 'Enseñanza y evaluación'      },
  { key: 'AUXILIAR',    label: 'Auxiliar',    icon: 'bi-person-check',     desc: 'Apoyo en aula y asistencia'  },
  { key: 'PSICOLOGO',   label: 'Psicólogo',   icon: 'bi-heart-pulse',      desc: 'Bienestar emocional'         },
  { key: 'COORDINADOR', label: 'Coordinador', icon: 'bi-diagram-3',        desc: 'Coordinación académica'      },
  { key: 'TUTOR',       label: 'Tutor',       icon: 'bi-person-hearts',    desc: 'Tutoría estudiantil'         },
  { key: 'CONTADOR',    label: 'Contador',    icon: 'bi-calculator',       desc: 'Gestión financiera'          },
  { key: 'ENFERMERIA',  label: 'Enfermería',  icon: 'bi-hospital',         desc: 'Salud escolar'               },
];

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      style={{
        width: 44, height: 24, borderRadius: 99, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? '#10b981' : '#cbd5e1', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

export default function RolesPlanPage() {
  const { data: planesData, mutate: mutatePlanes } = useData<any>('/membresias/planes');
  const { loading: saving, mutate: save }          = useMutation();
  const [planSel, setPlanSel]                      = useState('');

  const planes    = (planesData as any)?.data ?? [];
  const planActual = planes.find((p: any) => p.id === planSel);
  const rolesActivos: string[] = planActual?.rolesHabilitados ?? [];

  const toggleRol = async (rol: string) => {
    if (!planSel) return;
    const nuevos = rolesActivos.includes(rol)
      ? rolesActivos.filter((r: string) => r !== rol)
      : [...rolesActivos, rol];
    await save(async () => {
      await api.patch(`/membresias/planes/${planSel}`, { rolesHabilitados: nuevos });
      toast.success(`Rol ${nuevos.includes(rol) ? 'activado' : 'desactivado'} para todos los colegios con este plan`);
      mutatePlanes();
    });
  };

  return (
    <DashboardLayout title="Roles por Plan" allowedRoles={['SUPERADMIN']}>

      <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--accent)' }}>
        <i className="bi bi-info-circle me-2" />
        Los roles que actives aquí quedan disponibles <strong>de inmediato</strong> para TODOS
        los colegios que tengan este plan asignado — sin pasos adicionales por colegio.
        Si desactivas un rol, ningún administrador de ese plan podrá crearlo desde ese momento,
        ni siquiera llamando directo a la API.
      </div>

      <div style={{ marginBottom: '1.5rem', maxWidth: 400 }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          Selecciona un Plan
        </label>
        <select value={planSel} onChange={e => setPlanSel(e.target.value)} className="sige-input">
          <option value="">— Selecciona un plan —</option>
          {planes.map((p: any) => (
            <option key={p.id} value={p.id}>{p.nombre} {p.activo ? '' : '(inactivo)'}</option>
          ))}
        </select>
      </div>

      {planActual && (
        <>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{planActual.nombre}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {rolesActivos.length} rol(es) opcionales activos · S/ {Number(planActual.precio).toFixed(0)}/mes
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {ROLES_OPCIONALES.map(rol => {
              const activo = rolesActivos.includes(rol.key);
              return (
                <motion.div
                  key={rol.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.875rem 1rem', borderRadius: 10,
                    background: activo ? 'var(--accent-soft)' : 'var(--bg-card)',
                    border: `1px solid ${activo ? 'var(--accent)' : 'var(--border-color)'}`,
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: activo ? 'var(--accent)' : 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <i className={`bi ${rol.icon}`} style={{ color: activo ? '#fff' : 'var(--text-muted)', fontSize: '1rem' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{rol.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rol.desc}</div>
                  </div>
                  <Switch checked={activo} onChange={() => toggleRol(rol.key)} disabled={saving} />
                </motion.div>
              );
            })}
          </div>

          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
            <i className="bi bi-shield-check me-1" />
            Administrador, Director, Secretaría, Docente y Padre son roles base incluidos siempre en todos los planes.
          </p>
        </>
      )}
    </DashboardLayout>
  );
}
