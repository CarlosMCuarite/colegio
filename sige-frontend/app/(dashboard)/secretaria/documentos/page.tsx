'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useData, useMutation } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const TIPOS = ['CONSTANCIA', 'CERTIFICADO', 'SOLICITUD', 'AUTORIZACION', 'OTRO'];

const ESTADO_CONF: Record<string, { bg: string; text: string; label: string }> = {
  PENDIENTE:  { bg: '#fef3c7', text: '#92400e', label: 'Pendiente'  },
  EN_PROCESO: { bg: '#dbeafe', text: '#1e40af', label: 'En proceso' },
  LISTO:      { bg: '#d1fae5', text: '#065f46', label: 'Listo'      },
  ENTREGADO:  { bg: '#f0fdf4', text: '#166534', label: 'Entregado'  },
  RECHAZADO:  { bg: '#fee2e2', text: '#991b1b', label: 'Rechazado'  },
};

export default function DocumentosPage() {
  const [q, setQ]           = useState('');
  const [tipo, setTipo]     = useState('');
  const [estado, setEstado] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando]   = useState<any>(null);
  const [subiendoA, setSubiendoA] = useState<string | null>(null);

  const params = new URLSearchParams({ q, tipo, estado }).toString();
  const { data, isLoading, mutate } = useData<any>(`/documentos?${params}`);
  const { loading: acting, mutate: act } = useMutation();

  const documentos = (data as any)?.data ?? [];

  const guardar = async (form: any) => {
    await act(async () => {
      if (editando) {
        await api.patch(`/documentos/${editando.id}`, form);
        toast.success('Documento actualizado');
      } else {
        await api.post('/documentos', form);
        toast.success('Documento solicitado');
      }
      mutate(); setShowModal(false); setEditando(null);
    });
  };

  const eliminar = async (doc: any) => {
    if (!confirm(`¿Eliminar "${doc.nombre}"? Esto también borra el archivo adjunto.`)) return;
    await act(async () => {
      await api.delete(`/documentos/${doc.id}`);
      toast.success('Documento eliminado');
      mutate();
    });
  };

  const cambiarEstado = async (id: string, nuevoEstado: string) => {
    await act(async () => {
      await api.patch(`/documentos/${id}/estado`, { estado: nuevoEstado });
      toast.success('Estado actualizado');
      mutate();
    });
  };

  const subirArchivo = async (id: string, file: File) => {
    setSubiendoA(id);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      await api.post(`/documentos/${id}/archivo`, fd);
      toast.success('Archivo adjuntado');
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Error al subir el archivo');
    } finally { setSubiendoA(null); }
  };

  return (
    <DashboardLayout title="Gestión Documental" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <i className="bi bi-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Buscar por nombre o descripción..." value={q} onChange={e => setQ(e.target.value)} className="sige-input" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="sige-input" style={{ width: 'auto' }}>
          <option value="">Toda categoría</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn-accent" onClick={() => { setEditando(null); setShowModal(true); }}>
          <i className="bi bi-plus-lg me-1" />Nuevo Documento
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['', ...Object.keys(ESTADO_CONF)].map(e => (
          <button key={e} onClick={() => setEstado(e)}
            style={{ padding: '0.3rem 0.875rem', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              background: estado === e ? 'var(--accent)' : 'var(--bg-card)',
              color: estado === e ? '#fff' : 'var(--text-secondary)',
              boxShadow: estado === e ? '0 2px 8px rgba(79,70,229,0.3)' : 'none',
              border: estado !== e ? '1px solid var(--border-color)' : 'none',
            } as any}>
            {e === '' ? 'Todos' : ESTADO_CONF[e].label}
          </button>
        ))}
      </div>

      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead><tr><th>Documento</th><th>Estudiante</th><th>Categoría</th><th>Estado</th><th>Fecha</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
              <tbody>
                {documentos.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin documentos</td></tr>
                ) : documentos.map((d: any, i: number) => {
                  const conf = ESTADO_CONF[d.estado] ?? ESTADO_CONF.PENDIENTE;
                  return (
                    <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.nombre}</div>
                        {d.descripcion && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.descripcion}</div>}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{d.estudiante ? `${d.estudiante.nombres} ${d.estudiante.apellidos}` : '—'}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{d.tipo}</td>
                      <td><span className="estado-badge" style={{ background: conf.bg, color: conf.text }}>{conf.label}</span></td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(d.createdAt).toLocaleDateString('es-PE')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {!d.archivoUrl && (
                            <label style={{ background: '#dbeafe', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: subiendoA === d.id ? 'wait' : 'pointer', color: '#1e40af', fontSize: '0.75rem', fontWeight: 600 }}>
                              {subiendoA === d.id ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-upload me-1" />Adjuntar</>}
                              <input type="file" style={{ display: 'none' }} disabled={subiendoA === d.id}
                                onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(d.id, f); }} />
                            </label>
                          )}
                          {d.archivoUrl && (
                            <a href={d.archivoUrl} target="_blank" rel="noreferrer"
                              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '3px 8px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }}>
                              <i className="bi bi-download me-1" />Descargar
                            </a>
                          )}
                          {d.estado === 'PENDIENTE' && (
                            <button onClick={() => cambiarEstado(d.id, 'EN_PROCESO')} className="btn-accent" style={{ fontSize: '0.75rem', padding: '3px 8px', background: '#3b82f6' }}>Procesar</button>
                          )}
                          {d.estado === 'EN_PROCESO' && (
                            <button onClick={() => cambiarEstado(d.id, 'LISTO')} className="btn-accent" style={{ fontSize: '0.75rem', padding: '3px 8px', background: '#10b981' }}>Listo</button>
                          )}
                          {d.estado === 'LISTO' && (
                            <button onClick={() => cambiarEstado(d.id, 'ENTREGADO')} className="btn-accent" style={{ fontSize: '0.75rem', padding: '3px 8px', background: '#8b5cf6' }}>Entregado</button>
                          )}
                          <button onClick={() => { setEditando(d); setShowModal(true); }}
                            style={{ background: 'var(--accent-soft)', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.75rem' }}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button onClick={() => eliminar(d)}
                            style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#991b1b', fontSize: '0.75rem' }}>
                            <i className="bi bi-trash" />
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
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditando(null); } }}>
            <motion.div className="sige-modal" style={{ maxWidth: 440 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <DocumentoForm inicial={editando} onGuardar={guardar} onCancelar={() => { setShowModal(false); setEditando(null); }} saving={acting} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function DocumentoForm({ inicial, onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({
    nombre:       inicial?.nombre       ?? '',
    tipo:         inicial?.tipo         ?? 'CONSTANCIA',
    descripcion:  inicial?.descripcion  ?? '',
    estudianteDni: '',
  });
  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { nombre: form.nombre, tipo: form.tipo, descripcion: form.descripcion || null };
    if (!inicial && form.estudianteDni) {
      try {
        const res = await api.get(`/estudiantes?q=${form.estudianteDni}&limit=1`);
        const est = res.data?.data?.[0];
        if (est) payload.estudianteId = est.id;
        else { toast.error('No se encontró ningún estudiante con ese DNI'); return; }
      } catch { toast.error('Error al buscar el estudiante'); return; }
    }
    onGuardar(payload);
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{inicial ? 'Editar Documento' : 'Nuevo Documento'}</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nombre del documento *</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required minLength={3} className="sige-input" placeholder="Ej: Constancia de matrícula 2026" />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Categoría *</label>
          <select value={form.tipo} onChange={set('tipo')} required className="sige-input">
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {!inicial && (
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>DNI del estudiante (opcional)</label>
            <input type="text" value={form.estudianteDni} onChange={set('estudianteDni')} className="sige-input" placeholder="Dejar vacío si no aplica" />
          </div>
        )}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Descripción</label>
          <textarea value={form.descripcion} onChange={set('descripcion')} className="sige-input" style={{ minHeight: 70, resize: 'vertical' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />{inicial ? 'Guardar cambios' : 'Solicitar documento'}</>}
        </button>
      </div>
    </form>
  );
}
