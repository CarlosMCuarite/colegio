'use client';
// app/(dashboard)/secretaria/comunicados/page.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useComunicados, useNivelesGrados, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

export default function ComunicadosPage() {
  const [page, setPage]         = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [viendo, setViendo]     = useState<any>(null);

  const params = new URLSearchParams({ page: String(page), limit: '20' }).toString();
  const { data, isLoading, mutate } = useComunicados(params);
  const { data: nivelesData }       = useNivelesGrados();
  const { loading: saving, mutate: save } = useMutation();

  const comunicados = (data as any)?.data ?? [];
  const meta        = (data as any)?.meta ?? {};

  const handleGuardar = async (formData: FormData) => {
    await save(async () => {
      if (editando) {
        // Igual que en creación: se manda como multipart para que, si se
        // seleccionó un archivo nuevo, req.file llegue al backend.
        await api.patch(`/comunicados/${editando.id}`, formData);
        toast.success('Comunicado actualizado');
      } else {
        await api.post('/comunicados', formData);
        toast.success('Comunicado publicado y notificación enviada');
      }
      mutate();
      setShowModal(false);
      setEditando(null);
    });
  };

  const handleEliminar = async (id: string, titulo: string) => {
    if (!confirm(`¿Desactivar el comunicado "${titulo}"?`)) return;
    await api.delete(`/comunicados/${id}`);
    toast.success('Comunicado desactivado');
    mutate();
  };

  return (
    <DashboardLayout title="Comunicados" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      {/* Barra */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-accent" onClick={() => { setEditando(null); setShowModal(true); }}>
          <i className="bi bi-plus-lg" /> Nuevo Comunicado
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div className="spinner-border spinner-border-sm me-2" />Cargando...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {comunicados.length === 0 ? (
            <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <i className="bi bi-megaphone" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />
              Sin comunicados publicados
            </div>
          ) : comunicados.map((c: any, i: number) => (
            <motion.div
              key={c.id}
              className="sige-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}
            >
              {/* Ícono */}
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="bi bi-megaphone" style={{ color: 'var(--accent)', fontSize: '1.2rem' }} />
              </div>

              {/* Contenido */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, marginBottom: 3 }}>
                      {c.titulo}
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span><i className="bi bi-person me-1" />{c.creadoPor?.nombres} {c.creadoPor?.apellidos}</span>
                      <span><i className="bi bi-calendar me-1" />{new Date(c.createdAt).toLocaleDateString('es-PE')}</span>
                      {c.paraElColegio && <span style={{ color: 'var(--accent)' }}><i className="bi bi-broadcast me-1" />Todo el colegio</span>}
                      {c.nivelEducativo && <span><i className="bi bi-mortarboard me-1" />{c.nivelEducativo}</span>}
                      {c.adjuntoUrl && <span><i className="bi bi-paperclip me-1" />Con adjunto</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      onClick={() => setViendo(c)}
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    ><i className="bi bi-eye" /></button>
                    <button
                      onClick={() => { setEditando(c); setShowModal(true); }}
                      style={{ background: 'var(--accent-soft)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--accent)' }}
                    ><i className="bi bi-pencil" /></button>
                    <button
                      onClick={() => handleEliminar(c.id, c.titulo)}
                      style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#991b1b' }}
                    ><i className="bi bi-trash" /></button>
                  </div>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {c.contenido}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {meta.total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p-1)} className="btn-accent" style={{ padding: '0.3rem 0.7rem', opacity: page <= 1 ? 0.4 : 1 }}>
            <i className="bi bi-chevron-left" />
          </button>
          <span style={{ padding: '0.3rem 0.7rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            {page} / {Math.ceil(meta.total / 20)}
          </span>
          <button disabled={page * 20 >= meta.total} onClick={() => setPage(p => p+1)} className="btn-accent" style={{ padding: '0.3rem 0.7rem', opacity: page * 20 >= meta.total ? 0.4 : 1 }}>
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditando(null); } }}>
            <motion.div className="sige-modal" style={{ maxWidth: 560 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <ComunicadoForm
                inicial={editando}
                niveles={(nivelesData as any)?.data ?? []}
                onGuardar={handleGuardar}
                onCancelar={() => { setShowModal(false); setEditando(null); }}
                saving={saving}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ver detalle completo */}
      <AnimatePresence>
        {viendo && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setViendo(null); }}>
            <motion.div className="sige-modal" style={{ maxWidth: 600, maxHeight: '85vh', overflowY: 'auto' }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{viendo.titulo}</h2>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Publicado por <strong>{viendo.creadoPor?.nombres} {viendo.creadoPor?.apellidos}</strong> el{' '}
                    {new Date(viendo.createdAt).toLocaleString('es-PE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button onClick={() => setViendo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
              </div>

              {/* Destinatarios */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {viendo.paraElColegio ? (
                  <span style={{ fontSize: '0.75rem', background: 'var(--accent-soft)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>
                    <i className="bi bi-broadcast me-1" />Dirigido a todo el colegio
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>
                    <i className="bi bi-funnel me-1" />
                    {viendo.nivelEducativo ?? 'Nivel específico'}
                    {viendo.gradoId ? ' · grado específico' : ''}
                    {viendo.seccionId ? ' · sección específica' : ''}
                  </span>
                )}
                {viendo.venceEn && (
                  <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>
                    <i className="bi bi-hourglass-split me-1" />Vence el {new Date(viendo.venceEn).toLocaleDateString('es-PE')}
                  </span>
                )}
              </div>

              {/* Contenido completo */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '1rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {viendo.contenido}
              </div>

              {/* Documento adjunto */}
              {viendo.adjuntoUrl && (
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <i className="bi bi-paperclip me-1" />Documento adjunto
                  </h4>
                  {/\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(viendo.adjuntoUrl) ? (
                    <img src={viendo.adjuntoUrl} alt={viendo.adjuntoNombre || 'Adjunto'} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border-color)' }} />
                  ) : /\.pdf(\?.*)?$/i.test(viendo.adjuntoUrl) ? (
                    <iframe src={viendo.adjuntoUrl} style={{ width: '100%', height: 420, borderRadius: 10, border: '1px solid var(--border-color)' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 10, padding: '0.875rem' }}>
                      <i className="bi bi-file-earmark-text" style={{ fontSize: '1.5rem', color: 'var(--accent)' }} />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', flex: 1 }}>Vista previa no disponible para este tipo de archivo</span>
                    </div>
                  )}
                  <a href={viendo.adjuntoUrl} target="_blank" rel="noreferrer" className="btn-accent"
                    style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                    <i className="bi bi-download me-1" />Abrir / Descargar documento
                  </a>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function ComunicadoForm({ inicial, niveles, onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({
    titulo:         inicial?.titulo        ?? '',
    contenido:      inicial?.contenido     ?? '',
    paraElColegio:  inicial?.paraElColegio ?? true,
    nivelEducativo: inicial?.nivelEducativo ?? '',
    gradoId:        inicial?.gradoId       ?? '',
    seccionId:      inicial?.seccionId     ?? '',
    venceEn:        inicial?.venceEn       ? inicial.venceEn.split('T')[0] : '',
  });
  const [adjunto, setAdjunto] = useState<File | null>(null);
  // Nombre del adjunto ya guardado en el comunicado (sólo aplica al editar).
  // Si el usuario pide quitarlo, se marca eliminarAdjunto y se limpia esto.
  const [adjuntoActual, setAdjuntoActual] = useState<string | null>(inicial?.adjuntoNombre ?? null);
  const [eliminarAdjunto, setEliminarAdjunto] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const nivelesSeguro = Array.isArray(niveles) ? niveles : [];
  const selectedNivel = nivelesSeguro.find((n: any) => n.nivel === form.nivelEducativo);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null) fd.append(k, String(v)); });
    if (adjunto) fd.append('adjunto', adjunto);
    else if (eliminarAdjunto) fd.append('eliminarAdjunto', 'true');
    onGuardar(fd);
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
          <i className="bi bi-megaphone me-2" />{inicial ? 'Editar Comunicado' : 'Nuevo Comunicado'}
        </h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Título *</label>
          <input type="text" value={form.titulo} onChange={set('titulo')} required className="sige-input" placeholder="Ej: Reunión de padres de familia" />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Contenido *</label>
          <textarea value={form.contenido} onChange={set('contenido')} required className="sige-input" style={{ minHeight: 100, resize: 'vertical' }} placeholder="Redacta el comunicado aquí..." />
        </div>

        {/* Destinatarios */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.875rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            <i className="bi bi-people me-2" />Destinatarios
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
            <input type="checkbox" checked={form.paraElColegio} onChange={set('paraElColegio')} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Todo el colegio</span>
          </label>
          {!form.paraElColegio && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Nivel</label>
                <select value={form.nivelEducativo} onChange={set('nivelEducativo')} className="sige-input">
                  <option value="">Todos</option>
                  <option value="INICIAL">Inicial</option>
                  <option value="PRIMARIA">Primaria</option>
                  <option value="SECUNDARIA">Secundaria</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Grado</label>
                <select value={form.gradoId} onChange={set('gradoId')} className="sige-input" disabled={!form.nivelEducativo}>
                  <option value="">Todos</option>
                  {nivelesSeguro.filter((n: any) => n.nivel === form.nivelEducativo).map((n: any) => (
                    <option key={n.id} value={n.id}>{n.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Sección</label>
                <select value={form.seccionId} onChange={set('seccionId')} className="sige-input" disabled={!form.gradoId}>
                  <option value="">Todas</option>
                  {selectedNivel?.secciones?.map((s: any) => (
                    <option key={s.id} value={s.id}>Sección {s.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Vence el (opcional)</label>
            <input type="date" value={form.venceEn} onChange={set('venceEn')} className="sige-input" />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Adjunto (opcional)</label>
            {adjuntoActual && !adjunto && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.4rem 0.6rem', marginBottom: '0.4rem' }}>
                <i className="bi bi-paperclip" style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adjuntoActual}</span>
                <button type="button" onClick={() => { setAdjuntoActual(null); setEliminarAdjunto(true); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: '0.78rem' }}>
                  Quitar
                </button>
              </div>
            )}
            <input type="file" onChange={e => { setAdjunto(e.target.files?.[0] ?? null); setEliminarAdjunto(false); }} className="sige-input" accept=".pdf,.jpg,.png,.doc,.docx" style={{ padding: '0.35rem' }} />
            {adjuntoActual && !adjunto && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Selecciona un archivo para reemplazarlo.</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
          Cancelar
        </button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Publicando...</> : <><i className="bi bi-send me-1" />{inicial ? 'Actualizar' : 'Publicar y Notificar'}</>}
        </button>
      </div>
    </form>
  );
}
