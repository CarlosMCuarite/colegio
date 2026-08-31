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
  const [busqueda, setBusqueda] = useState('');
  const [nivelFiltro, setNivelFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [viendo, setViendo]     = useState<any>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const params = new URLSearchParams({ page: String(page), limit: '20', q: busqueda, nivelEducativo: nivelFiltro, estado: estadoFiltro }).toString();
  const { data, error, isLoading, mutate } = useComunicados(params);
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

  const abrirComunicado = async (comunicado: any) => {
    setViendo(comunicado);
    setCargandoDetalle(true);
    try {
      // La lista es liviana y puede no contener relaciones/URLs firmadas. El
      // detalle sí renueva los enlaces privados justo antes de mostrarlos.
      const res = await api.get(`/comunicados/${comunicado.id}`);
      setViendo(res.data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo cargar el adjunto');
    } finally {
      setCargandoDetalle(false);
    }
  };

  return (
    <DashboardLayout title="Comunicados" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      {/* Barra */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-accent" onClick={() => { setEditando(null); setShowModal(true); }}>
          <i className="bi bi-plus-lg" /> Nuevo Comunicado
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="sige-input" style={{ paddingLeft: '2rem' }} value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1); }} placeholder="Buscar por título o contenido..." />
        </div>
        <select className="sige-input" style={{ width: 170 }} value={nivelFiltro} onChange={e => { setNivelFiltro(e.target.value); setPage(1); }}>
          <option value="">Todos los niveles</option><option value="INICIAL">Inicial</option><option value="PRIMARIA">Primaria</option><option value="SECUNDARIA">Secundaria</option>
        </select>
        <select className="sige-input" style={{ width: 150 }} value={estadoFiltro} onChange={e => { setEstadoFiltro(e.target.value); setPage(1); }}>
          <option value="">Publicados</option><option value="PROGRAMADO">Programados</option><option value="VENCIDO">Vencidos</option>
        </select>
        {(busqueda || nivelFiltro || estadoFiltro) && <button onClick={() => { setBusqueda(''); setNivelFiltro(''); setEstadoFiltro(''); setPage(1); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><i className="bi bi-x-lg me-1" />Limpiar</button>}
      </div>

      {/* Lista */}
      {isLoading && !data ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div className="spinner-border spinner-border-sm me-2" />Cargando...
        </div>
      ) : error && !data ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
          <i className="bi bi-cloud-slash" style={{ display: 'block', fontSize: '2rem', color: '#b91c1c', marginBottom: 10 }} />
          <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 5 }}>No se pudieron cargar los comunicados</strong>
          <span style={{ display: 'block', fontSize: '0.8rem', marginBottom: 6 }}>Tus comunicados no fueron eliminados. La conexión con el servidor falló temporalmente.</span>
          <code style={{ display: 'inline-block', fontSize: '0.72rem', color: '#991b1b', background: '#fef2f2', padding: '4px 8px', borderRadius: 6, marginBottom: 14 }}>
            {error?.response?.data?.error ?? error?.message ?? 'Error desconocido'}
          </code>
          <button type="button" className="btn-accent" onClick={() => mutate()} style={{ margin: '0 auto' }}>
            <i className="bi bi-arrow-clockwise me-1" />Reintentar
          </button>
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
                      <span style={{ color: c.estado === 'VENCIDO' ? '#b91c1c' : c.estado === 'PROGRAMADO' ? '#92400e' : '#047857', fontWeight: 600 }}><i className={`bi ${c.estado === 'PROGRAMADO' ? 'bi-calendar-event' : c.estado === 'VENCIDO' ? 'bi-clock-history' : 'bi-check-circle'} me-1`} />{c.estado === 'PROGRAMADO' ? 'Programado' : c.estado === 'VENCIDO' ? 'Vencido' : 'Publicado'}</span>
                      {c.paraElColegio && <span style={{ color: 'var(--accent)' }}><i className="bi bi-broadcast me-1" />Todo el colegio</span>}
                      {c.nivelEducativo && <span><i className="bi bi-mortarboard me-1" />{c.nivelEducativo}</span>}
                      {(c.adjuntos?.length || c.adjuntoUrl) && <span><i className="bi bi-paperclip me-1" />{c.adjuntos?.length ?? 1} adjunto(s)</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      onClick={() => abrirComunicado(c)}
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

              <button onClick={async () => { try { await api.post(`/comunicados/${viendo.id}/leer`); toast.success('Lectura registrada'); } catch {} }} className="btn-accent" style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}>
                <i className="bi bi-check2-circle me-1" />Marcar como leído
              </button>

              {cargandoDetalle && <div style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}><span className="spinner-border spinner-border-sm me-2" />Preparando adjuntos…</div>}

              {/* Documento adjunto */}
              {(viendo.adjuntos?.length ? viendo.adjuntos : (viendo.adjuntoUrl ? [{ url: viendo.adjuntoUrl, nombre: viendo.adjuntoNombre }] : [])).length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <i className="bi bi-paperclip me-1" />Documento adjunto
                  </h4>
                  {(viendo.adjuntos?.length ? viendo.adjuntos : [{ url: viendo.adjuntoUrl, nombre: viendo.adjuntoNombre }]).map((a: any, i: number) => <div key={a.id ?? i} style={{ marginBottom: '0.75rem' }}>
                    {a.url ? <>
                      {(a.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(a.nombre ?? '')) && <img src={a.url} alt={a.nombre || 'Adjunto'} style={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border-color)' }} />}
                      {(a.mimeType === 'application/pdf' || /\.pdf$/i.test(a.nombre ?? '')) && <iframe title={a.nombre || 'Documento PDF'} src={a.url} style={{ width: '100%', height: 360, borderRadius: 10, border: '1px solid var(--border-color)' }} />}
                      <a href={a.url} target="_blank" rel="noreferrer" className="btn-accent" style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center', textDecoration: 'none' }}><i className="bi bi-download me-1" />{a.nombre || `Abrir adjunto ${i + 1}`}</a>
                    </> : <div style={{ padding: '0.75rem', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: '0.8rem' }}>
                      <i className="bi bi-exclamation-triangle me-2" />El archivo {a.nombre ? `“${a.nombre}”` : 'adjunto'} ya no está disponible, pero el comunicado se conserva.
                    </div>}
                  </div>)}
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
  const ahoraLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const hoyLocal = () => ahoraLocal().slice(0, 10);
  const [form, setForm] = useState({
    titulo:         inicial?.titulo        ?? '',
    contenido:      inicial?.contenido     ?? '',
    paraElColegio:  inicial?.paraElColegio ?? true,
    nivelEducativo: inicial?.nivelEducativo ?? '',
    gradoId:        inicial?.gradoId       ?? '',
    seccionId:      inicial?.seccionId     ?? '',
    publicadoEn:    inicial?.publicadoEn ? inicial.publicadoEn.slice(0, 16) : ahoraLocal(),
    venceEn:        inicial?.venceEn       ? inicial.venceEn.split('T')[0] : hoyLocal(),
  });
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
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
    Object.entries(form).forEach(([k, v]) => {
      if (v === '' || v === null) return;
      // Una fecha sin hora se interpreta como medianoche y vencería al
      // comenzar el día. Se envía al final del día local seleccionado.
      fd.append(k, k === 'venceEn' ? `${String(v)}T23:59:59.999` : String(v));
    });
    adjuntos.forEach(file => fd.append('adjuntos', file));
    if (!adjuntos.length && eliminarAdjunto) fd.append('eliminarAdjunto', 'true');
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
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Publicar el</label>
            <input type="datetime-local" value={form.publicadoEn} onChange={set('publicadoEn')} className="sige-input" />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Vence el</label>
            <input type="date" value={form.venceEn} onChange={set('venceEn')} className="sige-input" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Adjunto (opcional)</label>
            {adjuntoActual && !adjuntos.length && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.4rem 0.6rem', marginBottom: '0.4rem' }}>
                <i className="bi bi-paperclip" style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adjuntoActual}</span>
                <button type="button" onClick={() => { setAdjuntoActual(null); setEliminarAdjunto(true); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: '0.78rem' }}>
                  Quitar
                </button>
              </div>
            )}
            <input type="file" multiple onChange={e => { setAdjuntos(Array.from(e.target.files ?? []).slice(0, 5)); setEliminarAdjunto(false); }} className="sige-input" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ padding: '0.35rem' }} />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Hasta 5 archivos: PDF, JPG, PNG o WebP.</p>
            {adjuntoActual && !adjuntos.length && (
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
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</> : <><i className="bi bi-send me-1" />{inicial ? 'Actualizar' : (form.publicadoEn && new Date(form.publicadoEn) > new Date() ? 'Programar comunicado' : 'Publicar y Notificar')}</>}
        </button>
      </div>
    </form>
  );
}
