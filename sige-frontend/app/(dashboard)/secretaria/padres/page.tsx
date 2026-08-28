'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { usePadres, useMutation, useData } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

export default function PadresPage() {
  const [q, setQ]           = useState('');
  const [page, setPage]     = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando]   = useState<any>(null);

  const params = new URLSearchParams({ q, page: String(page), limit: '30' }).toString();
  const { data, isLoading, mutate } = usePadres(params);
  const { data: solicitudesData, mutate: mutateSolicitudes } = useData<any>('/padres/solicitudes/pendientes');
  const { loading: saving, mutate: save } = useMutation();

  const padres = (data as any)?.data ?? [];
  const meta   = (data as any)?.meta ?? {};
  const solicitudes = (solicitudesData as any)?.data ?? [];

  const aprobar = async (id: string) => {
    await save(async () => {
      await api.patch(`/padres/solicitudes/${id}/aprobar`);
      toast.success('Vínculo aprobado');
      mutateSolicitudes(); mutate();
    });
  };

  const rechazar = async (id: string) => {
    if (!confirm('¿Rechazar esta solicitud de vínculo?')) return;
    await save(async () => {
      await api.patch(`/padres/solicitudes/${id}/rechazar`);
      toast.success('Solicitud rechazada');
      mutateSolicitudes();
    });
  };

  const guardar = async (form: any) => {
    await save(async () => {
      if (editando) {
        await api.patch(`/padres/${editando.id}`, form);
        toast.success('Padre actualizado');
      } else {
        await api.post('/padres', form);
        toast.success('Padre registrado');
      }
      mutate(); setShowModal(false); setEditando(null);
    });
  };

  return (
    <DashboardLayout title="Padres y Apoderados" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      {solicitudes.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
          <h4 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#92400e', margin: '0 0 0.75rem' }}>
            <i className="bi bi-person-plus me-2" />{solicitudes.length} solicitud(es) de vínculo pendiente(s)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {solicitudes.map((s: any) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '0.6rem 0.875rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.padre?.nombres} {s.padre?.apellidos}</span>
                  <span style={{ color: '#92400e', fontSize: '0.78rem' }}> quiere vincularse a </span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.estudiante?.nombres} {s.estudiante?.apellidos}</span>
                  <div style={{ fontSize: '0.72rem', color: '#b45309' }}>DNI padre: {s.padre?.dni} · DNI estudiante: {s.estudiante?.dni} · {s.parentesco}</div>
                </div>
                <button onClick={() => aprobar(s.id)} disabled={saving} className="btn-accent" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: '#10b981' }}>
                  <i className="bi bi-check-lg me-1" />Aprobar
                </button>
                <button onClick={() => rechazar(s.id)} disabled={saving} style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '0.35rem 0.75rem', cursor: 'pointer', color: '#991b1b', fontSize: '0.78rem', fontWeight: 600 }}>
                  <i className="bi bi-x-lg me-1" />Rechazar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <i className="bi bi-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Buscar por nombre o DNI..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} className="sige-input" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <button className="btn-accent" onClick={() => { setEditando(null); setShowModal(true); }}>
          <i className="bi bi-plus-lg" /> Nuevo Padre
        </button>
      </div>

      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm me-2" />Cargando...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead><tr><th>Padre/Apoderado</th><th>DNI</th><th>Contacto</th><th>Hijos</th><th>Acceso</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
              <tbody>
                {padres.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    <i className="bi bi-people" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />Sin padres registrados
                  </td></tr>
                ) : padres.map((p: any, i: number) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.apellidos}, {p.nombres}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.email}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{p.dni}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{p.telefono || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(p.padreEstudiantes ?? []).map((pe: any) => (
                          <span key={pe.estudianteId} style={{ fontSize: '0.75rem', background: 'var(--accent-soft)', color: 'var(--accent)', padding: '1px 8px', borderRadius: 99, fontWeight: 600, display: 'inline-block' }}>
                            {pe.estudiante?.nombres} {pe.estudiante?.apellidos}
                          </span>
                        ))}
                        {!(p.padreEstudiantes?.length) && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sin hijos vinculados</span>}
                      </div>
                    </td>
                    <td>
                      <span className="estado-badge" style={{ background: p.usuario?.activo ? '#d1fae5' : '#f1f5f9', color: p.usuario?.activo ? '#065f46' : '#64748b' }}>
                        {p.usuario ? (p.usuario.activo ? 'Con acceso' : 'Desactivado') : 'Sin acceso'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setEditando(p); setShowModal(true); }}
                          style={{ background: 'var(--accent-soft)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--accent)' }}>
                          <i className="bi bi-pencil" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta.total > 30 && (
          <div style={{ padding: '0.875rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{meta.total} padres</span>
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
              <PadreForm inicial={editando} onGuardar={guardar} onCancelar={() => { setShowModal(false); setEditando(null); }} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function PadreForm({ inicial, onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({
    dni:              inicial?.dni        ?? '',
    nombres:          inicial?.nombres    ?? '',
    apellidos:        inicial?.apellidos  ?? '',
    email:            inicial?.email      ?? '',
    telefono:         inicial?.telefono   ?? '',
    telefono2:        inicial?.telefono2  ?? '',
    direccion:        inicial?.direccion  ?? '',
    crearAcceso:      false,
    passwordInicial:  '',
    estudiantesDni:   '',
  });
  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.estudiantesDni) payload.estudiantesDni = form.estudiantesDni.split(',').map((d: string) => d.trim()).filter(Boolean);
    onGuardar(payload);
  };
  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{inicial ? 'Editar Padre' : 'Nuevo Padre/Apoderado'}</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
        {[['DNI *', 'dni', true], ['Email', 'email', false], ['Nombres *', 'nombres', true], ['Apellidos *', 'apellidos', true], ['Teléfono', 'telefono', false], ['Teléfono 2', 'telefono2', false]].map(([label, key, req]: any) => (
          <div key={key}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
            <input type="text" value={(form as any)[key]} onChange={set(key)} required={req} className="sige-input" />
          </div>
        ))}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Dirección</label>
          <input type="text" value={form.direccion} onChange={set('direccion')} className="sige-input" />
        </div>
        {!inicial && <>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>DNI(s) de hijos (separados por coma)</label>
            <input type="text" value={form.estudiantesDni} onChange={set('estudiantesDni')} className="sige-input" placeholder="12345678, 87654321" />
          </div>
          <div style={{ gridColumn: '1 / -1', background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.875rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: form.crearAcceso ? '0.75rem' : 0 }}>
              <input type="checkbox" checked={form.crearAcceso} onChange={set('crearAcceso')} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Crear acceso al portal de padres</span>
            </label>
            {form.crearAcceso && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Contraseña inicial</label>
                <input type="password" value={form.passwordInicial} onChange={set('passwordInicial')} className="sige-input" placeholder="Mínimo 8 caracteres" minLength={8} required={form.crearAcceso} />
              </div>
            )}
          </div>
        </>}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</> : <><i className="bi bi-check2 me-1" />{inicial ? 'Actualizar' : 'Registrar'}</>}
        </button>
      </div>
    </form>
  );
}
