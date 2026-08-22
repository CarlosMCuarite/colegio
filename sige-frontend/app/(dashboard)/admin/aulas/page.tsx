'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useData, useMutation, useNivelesGrados } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AulasPage() {
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando]   = useState<any>(null);

  const { data: aulasData, isLoading, mutate } = useData<any>(`/aulas?q=${q}`);
  const { data: nivelesData }    = useNivelesGrados();
  const { data: docentesData }   = useData<any>('/aulas/docentes-disponibles');
  const { loading: saving, mutate: save } = useMutation();

  const aulas    = Array.isArray((aulasData as any)?.data) ? (aulasData as any).data : [];
  const niveles  = Array.isArray((nivelesData as any)?.data) ? (nivelesData as any).data : [];
  const docentes = Array.isArray((docentesData as any)?.data) ? (docentesData as any).data : [];

  // Todas las secciones de todos los grados, para el selector de "sección actual"
  const todasSecciones = niveles.flatMap((n: any) =>
    (n.secciones ?? []).map((s: any) => ({ ...s, nivelNombre: n.nombre }))
  );

  const guardar = async (form: any) => {
    await save(async () => {
      if (editando) { await api.patch(`/aulas/${editando.id}`, form); toast.success('Aula actualizada'); }
      else          { await api.post('/aulas', form);                 toast.success('Aula creada');      }
      mutate(); setShowModal(false); setEditando(null);
    });
  };

  const eliminar = async (a: any) => {
    if (!confirm(`¿Eliminar el aula "${a.nombre}"?`)) return;
    try {
      await api.delete(`/aulas/${a.id}`);
      toast.success('Aula eliminada');
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo eliminar');
    }
  };

  return (
    <DashboardLayout title="Aulas" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR']}>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <i className="bi bi-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Buscar aula por nombre..." value={q} onChange={e => setQ(e.target.value)} className="sige-input" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <button className="btn-accent" onClick={() => { setEditando(null); setShowModal(true); }}>
          <i className="bi bi-plus-lg me-1" />Nueva Aula
        </button>
      </div>

      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead><tr><th>Aula</th><th>Sección actual</th><th>Capacidad</th><th>Docente tutor</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
              <tbody>
                {aulas.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin aulas registradas</td></tr>
                ) : aulas.map((a: any, i: number) => (
                  <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <td style={{ fontWeight: 600, fontSize: '0.875rem' }}><i className="bi bi-door-open me-2" style={{ color: 'var(--accent)' }} />{a.nombre}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {a.seccion ? `${a.seccion.nivelGrado?.nombre} · Sección ${a.seccion.nombre}` : <span style={{ color: 'var(--text-muted)' }}>— Sin asignar —</span>}
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{a.capacidad ?? '—'}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {a.docenteTutor ? `${a.docenteTutor.nombres} ${a.docenteTutor.apellidos}` : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setEditando(a); setShowModal(true); }}
                          style={{ background: 'var(--accent-soft)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--accent)' }}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button onClick={() => eliminar(a)}
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
            <motion.div className="sige-modal" style={{ maxWidth: 440 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <AulaForm inicial={editando} secciones={todasSecciones} docentes={docentes}
                onGuardar={guardar} onCancelar={() => { setShowModal(false); setEditando(null); }} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function AulaForm({ inicial, secciones, docentes, onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({
    nombre:         inicial?.nombre         ?? '',
    seccionId:      inicial?.seccionId      ?? inicial?.seccion?.id ?? '',
    docenteTutorId: inicial?.docenteTutorId ?? inicial?.docenteTutor?.id ?? '',
    capacidad:      inicial?.capacidad      ?? '',
  });
  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onGuardar({
      nombre: form.nombre,
      seccionId: form.seccionId || null,
      docenteTutorId: form.docenteTutorId || null,
      capacidad: form.capacidad ? Number(form.capacidad) : null,
    });
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{inicial ? 'Editar Aula' : 'Nueva Aula'}</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nombre del aula *</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required minLength={2} className="sige-input" placeholder="Ej: Laboratorio, Sala de Música, Aula 12..." />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Capacidad</label>
          <input type="number" value={form.capacidad} onChange={set('capacidad')} min={1} className="sige-input" placeholder="Ej: 30" />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Sección que la usa actualmente (opcional)</label>
          <select value={form.seccionId} onChange={set('seccionId')} className="sige-input">
            <option value="">— Sin asignar —</option>
            {secciones.map((s: any) => <option key={s.id} value={s.id}>{s.nivelNombre} · Sección {s.nombre}</option>)}
          </select>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
            ¿No aparece la sección que buscas? Créala primero en <strong>Secciones</strong>.
          </p>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Docente tutor (opcional)</label>
          <select value={form.docenteTutorId} onChange={set('docenteTutorId')} className="sige-input">
            <option value="">— Sin asignar —</option>
            {docentes.map((d: any) => <option key={d.id} value={d.id}>{d.nombres} {d.apellidos}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />{inicial ? 'Guardar cambios' : 'Crear Aula'}</>}
        </button>
      </div>
    </form>
  );
}
