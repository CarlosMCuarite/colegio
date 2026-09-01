'use client';
// app/(dashboard)/admin/cursos/page.tsx
// Nueva — antes no existía ningún lugar para definir los cursos/áreas
// curriculares. Es la base de todo el sistema de notas: una nota siempre se
// registra contra un Curso real, nunca contra texto libre.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useNivelesGrados, useData, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

export default function CursosPage() {
  const [nivelGradoId, setNivelGradoId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const { data: nivelesData } = useNivelesGrados();
  const niveles = (nivelesData as any)?.data ?? [];
  const { data, isLoading, mutate } = useData<any>(nivelGradoId ? `/cursos?nivelGradoId=${nivelGradoId}` : '/cursos');
  const cursos = data?.data ?? [];
  const { mutate: save, loading: saving } = useMutation();
  const { mutate: crearPlantilla, loading: cargandoPlantilla } = useMutation();

  // Una selección pertenece al filtro visible. Al cambiar de grado se limpia
  // para impedir que se eliminen accidentalmente cursos que ya no se muestran.
  useEffect(() => setSeleccionados([]), [nivelGradoId]);

  const guardar = async (payload: any) => {
    await save(async () => {
      if (editando) await api.patch(`/cursos/${editando.id}`, payload);
      else await api.post('/cursos', payload);
      toast.success(editando ? 'Curso actualizado' : 'Curso creado');
      mutate();
      setShowModal(false);
      setEditando(null);
    });
  };

  const eliminar = async (curso: any) => {
    if (!confirm(`¿Eliminar "${curso.nombre}"?`)) return;
    try {
      const res = await api.delete(`/cursos/${curso.id}`);
      toast.success(res.data.desactivado ? 'Curso desactivado (tenía notas registradas)' : 'Curso eliminado');
      setSeleccionados(prev => prev.filter(id => id !== curso.id));
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo eliminar');
    }
  };

  const eliminarSeleccionados = async () => {
    const ids = seleccionados.length ? seleccionados : cursos.map((c: any) => c.id);
    const etiqueta = seleccionados.length ? `${ids.length} cursos seleccionados` : `los ${ids.length} cursos mostrados`;
    if (!ids.length || !confirm(`¿Eliminar ${etiqueta}? Los cursos con notas se desactivarán para preservar el historial.`)) return;
    await save(async () => {
      const res = await api.post('/cursos/eliminar-lote', { ids });
      toast.success(`${res.data.eliminados} eliminados y ${res.data.desactivados} desactivados por tener notas`);
      setSeleccionados([]);
      mutate();
    });
  };

  const usarPlantilla = async () => {
    await crearPlantilla(async () => {
      const res = await api.post('/cursos/plantilla-por-defecto');
      toast.success(`${res.data.cursosCreados} cursos creados en los grados que no tenían ninguno`);
      mutate();
    });
  };

  return (
    <DashboardLayout title="Cursos" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem', maxWidth: 640 }}>
        Los cursos son la base para registrar notas — cada nota se guarda contra un curso real de un grado específico.
        Si es la primera vez, usa "Crear cursos por defecto" para arrancar rápido con el set típico de cada nivel.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 200 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Filtrar por grado</label>
          <select value={nivelGradoId} onChange={e => setNivelGradoId(e.target.value)} className="sige-input">
            <option value="">Todos los grados</option>
            {niveles.map((n: any) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </div>
        <button className="btn-accent" onClick={() => { setEditando(null); setShowModal(true); }}>
          <i className="bi bi-plus-lg me-1" />Nuevo Curso
        </button>
        <button onClick={usarPlantilla} disabled={cargandoPlantilla}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 0.875rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {cargandoPlantilla ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-magic me-1" />Crear cursos por defecto</>}
        </button>
        {cursos.length > 0 && <button onClick={eliminarSeleccionados} disabled={saving}
          style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: 8, padding: '0.5rem 0.875rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
          <i className="bi bi-trash3 me-1" />{seleccionados.length ? `Eliminar selección (${seleccionados.length})` : 'Eliminar todos los mostrados'}
        </button>}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
      ) : cursos.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-journal-bookmark" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
          Sin cursos todavía. Usa "Crear cursos por defecto" o agrega uno manualmente.
        </div>
      ) : (
        <>
        <div className="sige-card" style={{ padding: '0.7rem 0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
            <input type="checkbox" checked={seleccionados.length === cursos.length} ref={el => { if (el) el.indeterminate = seleccionados.length > 0 && seleccionados.length < cursos.length; }} onChange={e => setSeleccionados(e.target.checked ? cursos.map((c: any) => c.id) : [])} />
            Seleccionar todos los cursos mostrados
          </label>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{seleccionados.length} de {cursos.length} seleccionados</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {cursos.map((c: any) => (
            <div key={c.id} className="sige-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', opacity: c.activo ? 1 : 0.5 }}>
              <label style={{ display: 'flex', gap: 10, flex: 1, cursor: 'pointer' }}>
                <input type="checkbox" checked={seleccionados.includes(c.id)} onChange={e => setSeleccionados(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} aria-label={`Seleccionar ${c.nombre}`} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.nombre}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.nivelGrado?.nombre}</div>
                {c.areaCurricular && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.areaCurricular}</div>}
                {!c.activo && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#991b1b' }}>Inactivo</span>}
              </div>
              </label>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => { setEditando(c); setShowModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><i className="bi bi-pencil" /></button>
                <button onClick={() => eliminar(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><i className="bi bi-trash" /></button>
              </div>
            </div>
          ))}
        </div></>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditando(null); } }}>
            <motion.div className="sige-modal" style={{ maxWidth: 420 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <CursoForm inicial={editando} niveles={niveles} nivelGradoIdPorDefecto={nivelGradoId}
                onGuardar={guardar} onCancelar={() => { setShowModal(false); setEditando(null); }} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function CursoForm({ inicial, niveles, nivelGradoIdPorDefecto, onGuardar, onCancelar, saving }: any) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [nivelGradoId, setNivelGradoId] = useState(inicial?.nivelGradoId ?? nivelGradoIdPorDefecto ?? '');
  const [areaCurricular, setAreaCurricular] = useState(inicial?.areaCurricular ?? '');

  return (
    <form onSubmit={e => { e.preventDefault(); onGuardar({ nombre, nivelGradoId, areaCurricular: areaCurricular || null }); }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{inicial ? 'Editar Curso' : 'Nuevo Curso'}</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Grado *</label>
          <select value={nivelGradoId} onChange={e => setNivelGradoId(e.target.value)} required className="sige-input">
            <option value="">Selecciona un grado...</option>
            {niveles.map((n: any) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nombre del curso *</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required minLength={2} className="sige-input" placeholder="Ej: Matemática" />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Área curricular (opcional)</label>
          <input type="text" value={areaCurricular} onChange={e => setAreaCurricular(e.target.value)} className="sige-input" placeholder="Ej: Ciencia y Tecnología" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check-lg me-1" />Guardar</>}
        </button>
      </div>
    </form>
  );
}
