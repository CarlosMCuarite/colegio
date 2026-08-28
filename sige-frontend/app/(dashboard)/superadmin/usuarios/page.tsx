'use client';
// app/(dashboard)/superadmin/usuarios/page.tsx
// Directorio GLOBAL de usuarios de TODOS los colegios — para que el
// SuperAdmin pueda resolver cualquier problema (usuario bloqueado, olvidó su
// contraseña, hay que desactivarlo, etc.) sin tener que entrar colegio por
// colegio. El backend ya devolvía todos los usuarios sin filtro de colegio
// cuando quien pregunta es SUPERADMIN — solo faltaba esta pantalla.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const ROLES = ['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA','DOCENTE','PADRE','AUXILIAR','PSICOLOGO','COORDINADOR','TUTOR','CONTADOR','ENFERMERIA'];

export default function UsuariosGlobalesPage() {
  const [busqueda, setBusqueda] = useState('');
  const [rolFiltro, setRolFiltro] = useState('');
  const [modalPassword, setModalPassword] = useState<{ id: string; nombre: string } | null>(null);
  const [modalEditar, setModalEditar] = useState<any>(null);

  const params = new URLSearchParams({ limit: '300' });
  if (busqueda) params.set('q', busqueda);
  if (rolFiltro) params.set('rol', rolFiltro);
  const { data, isLoading, mutate } = useData<any>(`/usuarios?${params.toString()}`);
  const usuarios = data?.data ?? [];
  const { mutate: accionar, loading: accionando } = useMutation();

  const toggleActivo = async (u: any) => {
    await accionar(async () => {
      await api.patch(`/usuarios/${u.id}`, { activo: !u.activo });
      toast.success(u.activo ? 'Usuario desactivado' : 'Usuario reactivado');
      mutate();
    });
  };

  const eliminar = async (u: any) => {
    if (!confirm(`¿Eliminar a "${u.nombres} ${u.apellidos}"? Esta acción no se puede deshacer.`)) return;
    await accionar(async () => {
      await api.delete(`/usuarios/${u.id}`);
      toast.success('Usuario eliminado');
      mutate();
    });
  };

  return (
    <DashboardLayout title="Usuarios (todos los colegios)" allowedRoles={['SUPERADMIN']}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Buscar por nombre o email..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="sige-input" style={{ maxWidth: 320 }} />
        <select className="sige-input" style={{ maxWidth: 220 }} value={rolFiltro} onChange={e => setRolFiltro(e.target.value)}>
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="sige-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="sige-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Colegio</th>
              <th>Estado</th>
              <th>Último acceso</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner-border spinner-border-sm" /></td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin resultados</td></tr>
            ) : usuarios.map((u: any) => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                      : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{u.nombres?.[0]}{u.apellidos?.[0]}</div>}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{u.nombres} {u.apellidos}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td><span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 99 }}>{u.rol}</span></td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.colegio?.nombre ?? '—'}</td>
                <td>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: u.activo ? '#d1fae5' : '#fee2e2', color: u.activo ? '#065f46' : '#991b1b' }}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleString('es-PE') : 'Nunca'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button title="Editar" onClick={() => setModalEditar(u)} style={btnIcon}><i className="bi bi-pencil" /></button>
                    <button title="Restablecer contraseña" onClick={() => setModalPassword({ id: u.id, nombre: `${u.nombres} ${u.apellidos}` })} style={btnIcon}><i className="bi bi-key" /></button>
                    <button title={u.activo ? 'Desactivar' : 'Reactivar'} onClick={() => toggleActivo(u)} disabled={accionando} style={btnIcon}>
                      <i className={`bi ${u.activo ? 'bi-pause-circle' : 'bi-play-circle'}`} />
                    </button>
                    {u.rol !== 'SUPERADMIN' && (
                      <button title="Eliminar" onClick={() => eliminar(u)} disabled={accionando} style={{ ...btnIcon, color: '#ef4444' }}><i className="bi bi-trash" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {modalPassword && <ModalRestablecerPassword usuario={modalPassword} onCerrar={() => setModalPassword(null)} />}
        {modalEditar && <ModalEditarUsuario usuario={modalEditar} onCerrar={() => setModalEditar(null)} onGuardado={() => { setModalEditar(null); mutate(); }} />}
      </AnimatePresence>
    </DashboardLayout>
  );
}

const btnIcon: React.CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' };

function ModalRestablecerPassword({ usuario, onCerrar }: { usuario: { id: string; nombre: string }; onCerrar: () => void }) {
  const [passwordGenerada, setPasswordGenerada] = useState<string | null>(null);
  const [verPassword, setVerPassword] = useState(false);
  const { mutate: generar, loading } = useMutation();

  const generarNueva = async () => {
    await generar(async () => {
      const res = await api.post(`/usuarios/${usuario.id}/restablecer-password`);
      setPasswordGenerada(res.data.data.password);
    });
  };

  const copiar = async () => {
    if (!passwordGenerada) return;
    await navigator.clipboard.writeText(passwordGenerada);
    toast.success('Contraseña copiada');
  };

  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <motion.div className="sige-modal" style={{ maxWidth: 400 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}><i className="bi bi-key me-2" />Restablecer contraseña</h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><i className="bi bi-x-lg" /></button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Se le asignará una contraseña nueva a <strong>{usuario.nombre}</strong>. No es posible ver su
          contraseña actual (nadie la guarda en texto plano, ni este sistema) — esta es la forma correcta
          de ayudarla/o si la olvidó.
        </p>

        {!passwordGenerada ? (
          <button className="btn-accent" onClick={generarNueva} disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
            {loading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-arrow-repeat me-1" />Generar contraseña nueva</>}
          </button>
        ) : (
          <div style={{ marginTop: '0.75rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nueva contraseña (solo se muestra esta vez)</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input readOnly value={passwordGenerada} type={verPassword ? 'text' : 'password'} className="sige-input" style={{ fontFamily: 'monospace', fontWeight: 700 }} />
              <button onClick={() => setVerPassword(v => !v)} style={btnIcon} title={verPassword ? 'Ocultar' : 'Ver'}>
                <i className={`bi ${verPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
              <button onClick={copiar} style={btnIcon} title="Copiar"><i className="bi bi-clipboard" /></button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
              Cópiala y compártela con la persona por un canal seguro. Al cerrar esta ventana ya no va a
              poder verse de nuevo — tendrías que generar otra.
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ModalEditarUsuario({ usuario, onCerrar, onGuardado }: { usuario: any; onCerrar: () => void; onGuardado: () => void }) {
  const [form, setForm] = useState({ nombres: usuario.nombres, apellidos: usuario.apellidos, telefono: usuario.telefono ?? '', dni: usuario.dni ?? '' });
  const { mutate: guardar, loading } = useMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await guardar(async () => {
      await api.patch(`/usuarios/${usuario.id}`, form);
      toast.success('Usuario actualizado');
      onGuardado();
    });
  };

  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <motion.div className="sige-modal" style={{ maxWidth: 420 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <form onSubmit={submit}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Editar usuario</h3>
            <button type="button" onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><i className="bi bi-x-lg" /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div><label className="sige-label">Nombres</label><input className="sige-input" value={form.nombres} onChange={e => setForm(f => ({ ...f, nombres: e.target.value }))} required /></div>
            <div><label className="sige-label">Apellidos</label><input className="sige-input" value={form.apellidos} onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))} required /></div>
            <div><label className="sige-label">DNI</label><input className="sige-input" value={form.dni} onChange={e => setForm(f => ({ ...f, dni: e.target.value }))} /></div>
            <div><label className="sige-label">Teléfono</label><input className="sige-input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Email: {usuario.email} · Rol: {usuario.rol} <span style={{ display: 'block', marginTop: 2 }}>(el email y el rol no se cambian aquí)</span></div>
          </div>
          <button type="submit" className="btn-accent" disabled={loading} style={{ width: '100%', marginTop: '1.25rem' }}>
            {loading ? <span className="spinner-border spinner-border-sm" /> : 'Guardar cambios'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
