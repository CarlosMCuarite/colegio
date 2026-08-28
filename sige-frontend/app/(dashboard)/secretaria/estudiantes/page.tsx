'use client';
// app/(dashboard)/secretaria/estudiantes/page.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import CarnetEstudiante from '../../../../components/CarnetEstudiante';
import { useEstudiantes, useNivelesGrados, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVO:      { bg: '#d1fae5', text: '#065f46' },
  RETIRADO:    { bg: '#fee2e2', text: '#991b1b' },
  TRASLADADO:  { bg: '#fef3c7', text: '#92400e' },
  EGRESADO:    { bg: '#dbeafe', text: '#1e40af' },
  SUSPENDIDO:  { bg: '#fde68a', text: '#92400e' },
  INACTIVO:    { bg: '#f1f5f9', text: '#64748b' },
};

export default function EstudiantesPage() {
  const [q, setQ]               = useState('');
  const [estado, setEstado]     = useState('');
  const [page, setPage]         = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [estudianteCarnet, setEstudianteCarnet] = useState<any>(null);
  const [editando, setEditando] = useState<any>(null);

  const params = new URLSearchParams({ q, estado, page: String(page), limit: '30' }).toString();
  const { data, isLoading, mutate } = useEstudiantes(params);
  const { data: niveles } = useNivelesGrados();
  const { loading: saving, mutate: save } = useMutation();

  const estudiantes = (data as any)?.data ?? [];
  const meta        = (data as any)?.meta ?? {};

  const handleGuardar = async (form: any) => {
    await save(async () => {
      if (editando) {
        await api.patch(`/estudiantes/${editando.id}`, form);
        toast.success('Estudiante actualizado');
      } else {
        await api.post('/estudiantes', form);
        toast.success('Estudiante registrado');
      }
      mutate();
      setShowModal(false);
      setEditando(null);
    });
  };

  const handleSoftDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Desactivar a ${nombre}?`)) return;
    await api.delete(`/estudiantes/${id}`);
    toast.success('Estudiante desactivado');
    mutate();
  };

  return (
    <DashboardLayout title="Estudiantes" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>

      {/* Barra de acciones */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <i className="bi bi-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            className="sige-input"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        <select value={estado} onChange={e => { setEstado(e.target.value); setPage(1); }} className="sige-input" style={{ width: 'auto' }}>
          <option value="">Todos los estados</option>
          {['ACTIVO','RETIRADO','TRASLADADO','EGRESADO','SUSPENDIDO','INACTIVO'].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <button className="btn-accent" onClick={() => { setEditando(null); setShowModal(true); }}>
          <i className="bi bi-plus-lg" /> Nuevo Estudiante
        </button>
      </div>

      {/* Tabla */}
      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner-border spinner-border-sm me-2" />Cargando...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>DNI</th>
                  <th>Grado / Sección</th>
                  <th>Estado</th>
                  <th>Padre/Apoderado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {estudiantes.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
                    Sin estudiantes encontrados
                  </td></tr>
                ) : estudiantes.map((est: any, i: number) => {
                  const matricula = est.matriculas?.[0];
                  const padre = est.padreEstudiantes?.[0]?.padre;
                  const col = ESTADO_COLORS[est.estado] ?? ESTADO_COLORS.INACTIVO;
                  return (
                    <motion.tr key={est.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'var(--accent-soft)', color: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                          }}>
                            {est.nombres?.[0]}{est.apellidos?.[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{est.apellidos}, {est.nombres}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cód: {est.codigoQR}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>{est.dni}</td>
                      <td style={{ fontSize: '0.875rem' }}>
                        {matricula ? `${matricula.nivelGrado?.nombre} ${matricula.seccion ? `- ${matricula.seccion.nombre}` : ''}` : <span style={{ color: 'var(--text-muted)' }}>Sin matrícula</span>}
                      </td>
                      <td>
                        <span className="estado-badge" style={{ background: col.bg, color: col.text }}>
                          {est.estado}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {padre ? `${padre.nombres} ${padre.apellidos}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setEstudianteCarnet(est)}
                            style={{ background: '#ede9fe', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#7c3aed' }}
                            title="Generar carnet"
                          ><i className="bi bi-person-vcard" /></button>
                          <button
                            onClick={() => { setEditando(est); setShowModal(true); }}
                            style={{ background: 'var(--accent-soft)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--accent)' }}
                            title="Editar"
                          ><i className="bi bi-pencil" /></button>
                          <button
                            onClick={() => handleSoftDelete(est.id, `${est.nombres} ${est.apellidos}`)}
                            style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#991b1b' }}
                            title="Desactivar"
                          ><i className="bi bi-trash" /></button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {meta.total > 30 && (
          <div style={{ padding: '0.875rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {meta.total} estudiantes en total
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p-1)} className="btn-accent" style={{ padding: '0.3rem 0.7rem', opacity: page <= 1 ? 0.4 : 1 }}>
                <i className="bi bi-chevron-left" />
              </button>
              <span style={{ padding: '0.3rem 0.7rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Pág. {page}</span>
              <button disabled={page * 30 >= meta.total} onClick={() => setPage(p => p+1)} className="btn-accent" style={{ padding: '0.3rem 0.7rem', opacity: page * 30 >= meta.total ? 0.4 : 1 }}>
                <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); setEditando(null); } }}>
            <motion.div className="sige-modal" initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}>
              <EstudianteForm
                inicial={editando}
                onGuardar={handleGuardar}
                onCancelar={() => { setShowModal(false); setEditando(null); }}
                saving={saving}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {estudianteCarnet && (
          <CarnetEstudiante estudiante={estudianteCarnet} onCerrar={() => setEstudianteCarnet(null)} />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function EstudianteForm({ inicial, onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({
    dni:      inicial?.dni      ?? '',
    nombres:  inicial?.nombres  ?? '',
    apellidos:inicial?.apellidos ?? '',
    genero:   inicial?.genero   ?? '',
    fechaNacimiento: inicial?.fechaNacimiento ? inicial.fechaNacimiento.split('T')[0] : '',
    direccion:inicial?.direccion ?? '',
    estado:   inicial?.estado   ?? 'ACTIVO',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => { e.preventDefault(); onGuardar(form); };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
          {inicial ? 'Editar Estudiante' : 'Nuevo Estudiante'}
        </h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {[
          { label: 'DNI', key: 'dni', type: 'text', required: true },
          { label: 'Nombres', key: 'nombres', type: 'text', required: true },
          { label: 'Apellidos', key: 'apellidos', type: 'text', required: true },
          { label: 'Fecha de Nacimiento', key: 'fechaNacimiento', type: 'date' },
        ].map(({ label, key, type, required }) => (
          <div key={key}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
            <input type={type} value={(form as any)[key]} onChange={set(key)} required={required} className="sige-input" />
          </div>
        ))}

        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Género</label>
          <select value={form.genero} onChange={set('genero')} className="sige-input">
            <option value="">Seleccionar</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Estado</label>
          <select value={form.estado} onChange={set('estado')} className="sige-input">
            {['ACTIVO','RETIRADO','TRASLADADO','EGRESADO','SUSPENDIDO','INACTIVO'].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Dirección</label>
        <input type="text" value={form.direccion} onChange={set('direccion')} className="sige-input" placeholder="Av. Los Jardines 123" />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
          Cancelar
        </button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</> : <><i className="bi bi-check2" /> {inicial ? 'Actualizar' : 'Registrar'}</>}
        </button>
      </div>
    </form>
  );
}
