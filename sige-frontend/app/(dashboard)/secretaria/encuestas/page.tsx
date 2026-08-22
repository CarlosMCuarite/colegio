'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useEncuestas, useMutation } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const ESTADO_CONF: Record<string, { bg: string; text: string }> = {
  BORRADOR: { bg: '#f1f5f9', text: '#475569' },
  ACTIVA:   { bg: '#d1fae5', text: '#065f46' },
  CERRADA:  { bg: '#fee2e2', text: '#991b1b' },
  ARCHIVADA:{ bg: '#fef3c7', text: '#92400e' },
};

export default function EncuestasPage() {
  const { data, isLoading, mutate } = useEncuestas();
  const { loading: saving, mutate: save } = useMutation();
  const [showModal, setShowModal] = useState(false);
  const encuestas = (data as any)?.data ?? [];

  const cambiarEstado = async (id: string, estado: string) => {
    await save(async () => {
      await api.patch(`/encuestas/${id}/estado`, { estado });
      toast.success(`Encuesta ${estado.toLowerCase()}`);
      mutate();
    });
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Archivar esta encuesta?')) return;
    await cambiarEstado(id, 'ARCHIVADA');
  };

  return (
    <DashboardLayout title="Encuestas" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-lg" />Nueva Encuesta
        </button>
      </div>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {encuestas.length === 0 ? (
            <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <i className="bi bi-bar-chart" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />Sin encuestas creadas
            </div>
          ) : encuestas.map((enc: any, i: number) => {
            const conf = ESTADO_CONF[enc.estado] ?? ESTADO_CONF.BORRADOR;
            return (
              <motion.div key={enc.id} className="sige-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                      <h4 style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>{enc.titulo}</h4>
                      <span className="estado-badge" style={{ background: conf.bg, color: conf.text }}>{enc.estado}</span>
                      {enc.anonima && <span style={{ fontSize: '0.7rem', background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 99 }}>Anónima</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span><i className="bi bi-question-circle me-1" />{enc._count?.preguntas ?? 0} preguntas</span>
                      <span><i className="bi bi-people me-1" />{enc._count?.respuestas ?? 0} respuestas</span>
                      <span><i className="bi bi-calendar me-1" />{new Date(enc.createdAt).toLocaleDateString('es-PE')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {enc.estado === 'BORRADOR' && (
                      <button onClick={() => cambiarEstado(enc.id, 'ACTIVA')} className="btn-accent" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', background: '#10b981' }}>
                        <i className="bi bi-play-circle me-1" />Activar
                      </button>
                    )}
                    {enc.estado === 'ACTIVA' && (
                      <button onClick={() => cambiarEstado(enc.id, 'CERRADA')} className="btn-accent" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', background: '#ef4444' }}>
                        <i className="bi bi-stop-circle me-1" />Cerrar
                      </button>
                    )}
                    <button onClick={() => window.location.href = `/secretaria/encuestas/${enc.id}/resultados`}
                      style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 6, padding: '0.35rem 0.75rem', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600 }}>
                      <i className="bi bi-bar-chart me-1" />Resultados
                    </button>
                    <button onClick={() => eliminar(enc.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '0.35rem 0.75rem', cursor: 'pointer', color: '#991b1b', fontSize: '0.78rem' }}>
                      <i className="bi bi-archive" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div className="sige-modal" style={{ maxWidth: 580 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <EncuestaForm onGuardar={async (form) => {
                await save(async () => { await api.post('/encuestas', form); toast.success('Encuesta creada'); mutate(); setShowModal(false); });
              }} onCancelar={() => setShowModal(false)} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

const TIPOS_PREGUNTA = [
  { id: 'TEXTO',            label: 'Respuesta libre',  desc: 'La persona escribe lo que quiera',      icon: 'bi-chat-left-text' },
  { id: 'OPCION_UNICA',     label: 'Elegir una opción', desc: 'Como marcar un solo círculo',          icon: 'bi-record-circle'  },
  { id: 'OPCION_MULTIPLE',  label: 'Elegir varias',     desc: 'Puede marcar más de una opción',       icon: 'bi-check2-square'  },
  { id: 'ESCALA',           label: 'Calificar del 1 al 5', desc: 'Para medir satisfacción, por ejemplo', icon: 'bi-star-half'   },
];

const PLANTILLAS = [
  {
    nombre: 'Satisfacción con el colegio', icon: 'bi-emoji-smile',
    preguntas: [
      { pregunta: '¿Qué tan satisfecho estás con el colegio en general?', tipo: 'ESCALA', opciones: [] },
      { pregunta: '¿Qué es lo que más valoras del colegio?', tipo: 'TEXTO', opciones: [] },
      { pregunta: '¿Qué podríamos mejorar?', tipo: 'TEXTO', opciones: [] },
    ],
  },
  {
    nombre: 'Reunión de padres', icon: 'bi-people',
    preguntas: [
      { pregunta: '¿Podrás asistir a la reunión?', tipo: 'OPCION_UNICA', opciones: ['Sí, asistiré', 'No podré asistir', 'Aún no lo sé'] },
      { pregunta: '¿Qué horario te resulta más conveniente?', tipo: 'OPCION_UNICA', opciones: ['Mañana', 'Tarde', 'Noche'] },
      { pregunta: 'Comentarios o sugerencias', tipo: 'TEXTO', opciones: [] },
    ],
  },
];

function EncuestaForm({ onGuardar, onCancelar, saving }: any) {
  const [titulo, setTitulo]       = useState('');
  const [descripcion, setDesc]    = useState('');
  const [anonima, setAnonima]     = useState(false);
  const [preguntas, setPreguntas] = useState<{ pregunta: string; tipo: string; opciones: string[] }[]>(
    [{ pregunta: '', tipo: 'TEXTO', opciones: [] }],
  );

  const usarPlantilla = (p: typeof PLANTILLAS[0]) => {
    setPreguntas(p.preguntas.map(q => ({ ...q })));
    if (!titulo) setTitulo(p.nombre);
  };

  const addPregunta = () => setPreguntas(p => [...p, { pregunta: '', tipo: 'TEXTO', opciones: [] }]);
  const removePregunta = (i: number) => setPreguntas(p => p.filter((_, j) => j !== i));
  const setPregunta = (i: number, texto: string) => setPreguntas(p => p.map((pr, j) => j === i ? { ...pr, pregunta: texto } : pr));
  const setTipo = (i: number, tipo: string) => setPreguntas(p => p.map((pr, j) => j === i ? { ...pr, tipo, opciones: (tipo === 'OPCION_UNICA' || tipo === 'OPCION_MULTIPLE') ? (pr.opciones.length ? pr.opciones : ['', '']) : [] } : pr));
  const setOpcion = (i: number, oi: number, texto: string) => setPreguntas(p => p.map((pr, j) => j === i ? { ...pr, opciones: pr.opciones.map((o, k) => k === oi ? texto : o) } : pr));
  const addOpcion = (i: number) => setPreguntas(p => p.map((pr, j) => j === i ? { ...pr, opciones: [...pr.opciones, ''] } : pr));
  const removeOpcion = (i: number, oi: number) => setPreguntas(p => p.map((pr, j) => j === i ? { ...pr, opciones: pr.opciones.filter((_, k) => k !== oi) } : pr));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const p of preguntas) {
      if ((p.tipo === 'OPCION_UNICA' || p.tipo === 'OPCION_MULTIPLE') && p.opciones.filter(o => o.trim()).length < 2) {
        toast.error(`La pregunta "${p.pregunta || '(sin título)'}" necesita al menos 2 opciones`);
        return;
      }
    }
    onGuardar({
      titulo, descripcion, anonima,
      preguntas: preguntas.map((p, i) => ({
        orden: i + 1, pregunta: p.pregunta, tipo: p.tipo,
        opciones: p.opciones.map(o => o.trim()).filter(Boolean),
        requerida: true,
      })),
    });
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Nueva Encuesta</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>

      {/* Plantillas rápidas — evitan la hoja en blanco */}
      <div style={{ marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>Empezar desde una plantilla (opcional):</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {PLANTILLAS.map(p => (
            <button key={p.nombre} type="button" onClick={() => usarPlantilla(p)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600 }}>
              <i className={`bi ${p.icon}`} />{p.nombre}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Título *</label>
          <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} required className="sige-input" placeholder="Ej: Encuesta de satisfacción 2026" />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Descripción (opcional)</label>
          <textarea value={descripcion} onChange={e => setDesc(e.target.value)} className="sige-input" style={{ minHeight: 56, resize: 'vertical' }} placeholder="Una frase para explicar de qué trata" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={anonima} onChange={e => setAnonima(e.target.checked)} />
          <span style={{ fontSize: '0.875rem' }}>Encuesta anónima <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>(no se sabrá quién respondió cada cosa)</span></span>
        </label>
      </div>

      <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Preguntas</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 360, overflowY: 'auto', marginBottom: '0.75rem', paddingRight: 4 }}>
        {preguntas.map((p, i) => (
          <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pregunta {i + 1}</span>
              {preguntas.length > 1 && (
                <button type="button" onClick={() => removePregunta(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.78rem' }}>
                  <i className="bi bi-trash me-1" />Quitar
                </button>
              )}
            </div>

            <input type="text" value={p.pregunta} onChange={e => setPregunta(i, e.target.value)} required className="sige-input" placeholder="Escribe la pregunta aquí" style={{ marginBottom: '0.6rem' }} />

            {/* Selector de tipo con tarjetas — más claro que un <select> con nombres técnicos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', marginBottom: p.tipo === 'OPCION_UNICA' || p.tipo === 'OPCION_MULTIPLE' ? '0.6rem' : 0 }}>
              {TIPOS_PREGUNTA.map(t => (
                <button key={t.id} type="button" onClick={() => setTipo(i, t.id)}
                  title={t.desc}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', textAlign: 'left',
                    padding: '0.4rem 0.6rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600,
                    border: p.tipo === t.id ? '1.5px solid var(--accent)' : '1px solid var(--border-color)',
                    background: p.tipo === t.id ? 'var(--accent-soft)' : 'var(--bg-card)',
                    color: p.tipo === t.id ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>
                  <i className={`bi ${t.icon}`} />{t.label}
                </button>
              ))}
            </div>

            {(p.tipo === 'OPCION_UNICA' || p.tipo === 'OPCION_MULTIPLE') && (
              <div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.35rem' }}>Opciones para elegir:</p>
                {p.opciones.map((o, oi) => (
                  <div key={oi} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <input type="text" value={o} onChange={e => setOpcion(i, oi, e.target.value)} className="sige-input" placeholder={`Opción ${oi + 1}`} style={{ fontSize: '0.82rem' }} />
                    {p.opciones.length > 2 && (
                      <button type="button" onClick={() => removeOpcion(i, oi)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 6px' }}>
                        <i className="bi bi-x-lg" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addOpcion(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600, padding: '2px 0' }}>
                  <i className="bi bi-plus-circle me-1" />Agregar opción
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addPregunta} style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', borderRadius: 8, padding: '0.5rem', width: '100%', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
        <i className="bi bi-plus-circle me-1" />Agregar otra pregunta
      </button>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Creando...</> : <><i className="bi bi-check2 me-1" />Crear Encuesta</>}
        </button>
      </div>
    </form>
  );
}
