'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useUsuarios, useMutation, useData } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const ROL_CONF: Record<string, { bg: string; text: string }> = {
  ADMINISTRADOR: { bg: '#ede9fe', text: '#5b21b6' },
  DIRECTOR:      { bg: '#dbeafe', text: '#1e40af' },
  SECRETARIA:    { bg: '#d1fae5', text: '#065f46' },
  DOCENTE:       { bg: '#fef3c7', text: '#92400e' },
  PADRE:         { bg: '#f1f5f9', text: '#475569' },
  AUXILIAR:      { bg: '#fce7f3', text: '#9d174d' },
  PSICOLOGO:     { bg: '#ecfdf5', text: '#064e3b' },
  COORDINADOR:   { bg: '#eff6ff', text: '#1e3a8a' },
  TUTOR:         { bg: '#fdf4ff', text: '#6b21a8' },
  CONTADOR:      { bg: '#fff7ed', text: '#9a3412' },
  ENFERMERIA:    { bg: '#fef2f2', text: '#991b1b' },
};

const ROLES_BASE = ['ADMINISTRADOR','PADRE'];
const ROLES_OPCIONALES = ['DIRECTOR','SECRETARIA','DOCENTE','AUXILIAR','PSICOLOGO','COORDINADOR','TUTOR','CONTADOR','ENFERMERIA'];
const ROLES_DISPONIBLES = [...ROLES_BASE, ...ROLES_OPCIONALES]; // usado solo para el filtro de búsqueda

export default function UsuariosPage() {
  const [q, setQ]           = useState('');
  const [rol, setRol]       = useState('');
  const [page, setPage]     = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando]   = useState<any>(null);

  const params = new URLSearchParams({ q, rol, page: String(page), limit: '30' }).toString();
  const { data, isLoading, mutate } = useUsuarios(params);
  // Se refetch cada vez que se abre esta página — nunca confiar en un valor cacheado
  // de sesiones anteriores, para que un downgrade de plan se refleje de inmediato.
  const { data: colegioData } = useData<any>('/colegios', { revalidateOnMount: true, dedupingInterval: 0 });
  const { loading: saving, mutate: save } = useMutation();

  const usuarios = (data as any)?.data ?? [];
  const meta     = (data as any)?.meta ?? {};
  const colegio  = (colegioData as any)?.data ?? null;
  const rolesPermitidosOpcionales: string[] = (ROLES_OPCIONALES).filter(r =>
    (colegio?.plan?.rolesHabilitados ?? []).includes(r)
  );
  const rolesParaCrear = [...ROLES_BASE, ...rolesPermitidosOpcionales];

  const guardar = async (form: any) => {
    await save(async () => {
      if (editando) {
        await api.patch(`/usuarios/${editando.id}`, { nombres: form.nombres, apellidos: form.apellidos, telefono: form.telefono });
        toast.success('Usuario actualizado');
      } else {
        await api.post('/usuarios', form);
        toast.success('Usuario creado y credenciales enviadas');
      }
      mutate(); setShowModal(false); setEditando(null);
    });
  };

  const toggleActivo = async (u: any) => {
    const accion = u.activo ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a ${u.nombres}?`)) return;
    await save(async () => {
      await api.patch(`/usuarios/${u.id}`, { activo: !u.activo });
      toast.success(`Usuario ${u.activo ? 'desactivado' : 'activado'}`);
      mutate();
    });
  };

  return (
    <DashboardLayout title="Gestión de Usuarios" allowedRoles={['SUPERADMIN','ADMINISTRADOR']}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <i className="bi bi-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Buscar por nombre o email..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} className="sige-input" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <select value={rol} onChange={e => { setRol(e.target.value); setPage(1); }} className="sige-input" style={{ width: 'auto' }}>
          <option value="">Todos los roles</option>
          {ROLES_DISPONIBLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button className="btn-accent" onClick={() => { setEditando(null); setShowModal(true); }}>
          <i className="bi bi-plus-lg" /> Nuevo Usuario
        </button>
      </div>

      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm me-2" />Cargando...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead>
                <tr><th>Usuario</th><th>Rol</th><th>Contacto</th><th>Último acceso</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    <i className="bi bi-people" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />Sin usuarios encontrados
                  </td></tr>
                ) : usuarios.map((u: any, i: number) => {
                  const rolConf = ROL_CONF[u.rol] ?? { bg: '#f1f5f9', text: '#475569' };
                  return (
                    <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                            {u.nombres?.[0]}{u.apellidos?.[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.apellidos}, {u.nombres}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="estado-badge" style={{ background: rolConf.bg, color: rolConf.text }}>{u.rol}</span></td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{u.telefono || u.dni || '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                      </td>
                      <td>
                        <span className="estado-badge" style={{ background: u.activo ? '#d1fae5' : '#fee2e2', color: u.activo ? '#065f46' : '#991b1b' }}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => { setEditando(u); setShowModal(true); }}
                            style={{ background: 'var(--accent-soft)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--accent)' }}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button onClick={() => toggleActivo(u)}
                            style={{ background: u.activo ? '#fee2e2' : '#d1fae5', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: u.activo ? '#991b1b' : '#065f46' }}>
                            <i className={`bi ${u.activo ? 'bi-pause-circle' : 'bi-play-circle'}`} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {meta.total > 30 && (
          <div style={{ padding: '0.875rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{meta.total} usuarios</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p-1)} className="btn-accent" style={{ padding: '0.3rem 0.7rem', opacity: page <= 1 ? 0.4 : 1 }}><i className="bi bi-chevron-left" /></button>
              <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>Pág. {page}</span>
              <button disabled={page * 30 >= meta.total} onClick={() => setPage(p => p+1)} className="btn-accent" style={{ padding: '0.3rem 0.7rem', opacity: page * 30 >= meta.total ? 0.4 : 1 }}><i className="bi bi-chevron-right" /></button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditando(null); } }}>
            <motion.div className="sige-modal" initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <UsuarioForm inicial={editando} rolesDisponibles={rolesParaCrear} onGuardar={guardar} onCancelar={() => { setShowModal(false); setEditando(null); }} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function UsuarioForm({ inicial, rolesDisponibles, onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({
    nombres:   inicial?.nombres   ?? '',
    apellidos: inicial?.apellidos ?? '',
    email:     inicial?.email     ?? '',
    password:  '',
    rol:       inicial?.rol       ?? 'DOCENTE',
    dni:       inicial?.dni       ?? '',
    telefono:  inicial?.telefono  ?? '',
  });
  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onGuardar(form); }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{inicial ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
        {[['Nombres *', 'nombres', 'text', true], ['Apellidos *', 'apellidos', 'text', true],
          ['DNI', 'dni', 'text', false], ['Teléfono', 'telefono', 'text', false]
        ].map(([label, key, type, req]: any) => (
          <div key={key}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
            <input type={type} value={(form as any)[key]} onChange={set(key)} required={req} className="sige-input" />
          </div>
        ))}
        {!inicial && <>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Email *</label>
            <input type="email" value={form.email} onChange={set('email')} required className="sige-input" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Contraseña inicial *</label>
            <input type="password" value={form.password} onChange={set('password')} required minLength={8} className="sige-input" placeholder="Mínimo 8 caracteres" />
          </div>
        </>}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Rol *</label>
          <select value={form.rol} onChange={set('rol')} required className="sige-input" disabled={!!inicial}>
            {(rolesDisponibles ?? []).map((r: string) => <option key={r} value={r}>{r}</option>)}
          </select>
          {!inicial && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Los roles opcionales (Psicólogo, Auxiliar, etc.) solo aparecen si el plan actual del colegio los incluye y están activados en "Roles por Plan".</p>}
          {inicial && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>El rol no se puede cambiar una vez creado.</p>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</> : <><i className="bi bi-check2 me-1" />{inicial ? 'Actualizar' : 'Crear Usuario'}</>}
        </button>
      </div>
    </form>
  );
}
