'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useData, useMutation, useNivelesGrados } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function SeccionesPage() {
  const [nivelGradoId, setNivelGradoId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando]   = useState<any>(null);

  const params = nivelGradoId ? `?nivelGradoId=${nivelGradoId}` : '';
  const { data: seccionesData, isLoading, mutate } = useData<any>(`/aulas/secciones${params}`);
  const { data: nivelesData } = useNivelesGrados();
  const { loading: saving, mutate: save } = useMutation();

  const secciones = Array.isArray((seccionesData as any)?.data) ? (seccionesData as any).data : [];
  const niveles   = Array.isArray((nivelesData as any)?.data)   ? (nivelesData as any).data   : [];

  const guardar = async (form: any) => {
    await save(async () => {
      if (editando) { await api.patch(`/aulas/secciones/${editando.id}`, form); toast.success('Sección actualizada'); }
      else          { await api.post('/aulas/secciones', form);                  toast.success('Sección creada');      }
      mutate(); setShowModal(false); setEditando(null);
    });
  };

  const eliminar = async (s: any) => {
    if (!confirm(`¿Eliminar la sección "${s.nombre}"?`)) return;
    try {
      await api.delete(`/aulas/secciones/${s.id}`);
      toast.success('Sección eliminada');
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo eliminar');
    }
  };

  return (
    <DashboardLayout title="Secciones" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR']}>

      <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--accent)' }}>
        <i className="bi bi-info-circle me-2" />
        Cada grado puede tener tantas secciones como necesite tu colegio (A, B, C, D...).
        Aquí las administras de forma independiente de las Aulas físicas.
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <select value={nivelGradoId} onChange={e => setNivelGradoId(e.target.value)} className="sige-input" style={{ maxWidth: 280 }}>
          <option value="">Todos los grados</option>
          {niveles.map((n: any) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
        </select>
        <button className="btn-accent" onClick={() => { setEditando(null); setShowModal(true); }} disabled={niveles.length === 0}>
          <i className="bi bi-plus-lg me-1" />Nueva Sección
        </button>
      </div>

      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead><tr><th>Grado</th><th>Sección</th><th>Capacidad</th><th>Estudiantes matriculados</th><th>Aulas asignadas</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
              <tbody>
                {secciones.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin secciones registradas</td></tr>
                ) : secciones.map((s: any, i: number) => (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <td style={{ fontSize: '0.875rem' }}>{s.nivelGrado?.nombre}</td>
                    <td style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent)' }}>Sección {s.nombre}</td>
                    <td style={{ fontSize: '0.82rem' }}>{s.capacidad ?? '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{s._count?.matriculas ?? 0}</td>
                    <td style={{ fontSize: '0.82rem' }}>{s._count?.aulas ?? 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setEditando(s); setShowModal(true); }}
                          style={{ background: 'var(--accent-soft)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--accent)' }}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button onClick={() => eliminar(s)}
                          style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#991b1b' }}>
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditando(null); } }}>
            <motion.div className="sige-modal" style={{ maxWidth: 420 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <SeccionForm inicial={editando} niveles={niveles} onGuardar={guardar} onCancelar={() => { setShowModal(false); setEditando(null); }} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function SeccionForm({ inicial, niveles, onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({
    nivelGradoId: inicial?.nivelGradoId ?? '',
    nombre:       inicial?.nombre       ?? '',
    capacidad:    inicial?.capacidad    ?? '',
  });
  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onGuardar({
      nivelGradoId: form.nivelGradoId,
      nombre: form.nombre.toUpperCase().trim(),
      capacidad: form.capacidad ? Number(form.capacidad) : null,
    });
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{inicial ? 'Editar Sección' : 'Nueva Sección'}</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Grado *</label>
          <select value={form.nivelGradoId} onChange={set('nivelGradoId')} required className="sige-input" disabled={!!inicial}>
            <option value="">— Selecciona un grado —</option>
            {niveles.map((n: any) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nombre de la sección *</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required maxLength={3} className="sige-input" placeholder="Ej: A, B, C..." />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Capacidad de alumnos</label>
          <input type="number" value={form.capacidad} onChange={set('capacidad')} min={1} className="sige-input" placeholder="Ej: 30" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />{inicial ? 'Guardar cambios' : 'Crear Sección'}</>}
        </button>
      </div>
    </form>
  );
}
