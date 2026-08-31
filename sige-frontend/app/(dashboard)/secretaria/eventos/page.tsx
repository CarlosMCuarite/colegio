'use client';
// app/(dashboard)/secretaria/eventos/page.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useEventos, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const TIPO_CONF: Record<string, { color: string; bg: string; icon: string }> = {
  FERIADO:           { color: '#991b1b', bg: '#fee2e2', icon: 'bi-calendar-x'       },
  SUSPENSION_CLASES: { color: '#92400e', bg: '#fef3c7', icon: 'bi-exclamation-triangle' },
  REUNION:           { color: '#1e40af', bg: '#dbeafe', icon: 'bi-people'            },
  ACTIVIDAD:         { color: '#065f46', bg: '#d1fae5', icon: 'bi-stars'             },
  OTRO:              { color: '#374151', bg: '#f3f4f6', icon: 'bi-calendar-event'    },
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function EventosPage() {
  const hoy = new Date();
  const [mes, setMes]   = useState(hoy.getMonth());
  const [año, setAño]   = useState(hoy.getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando]   = useState<any>(null);
  // Fecha sugerida al crear un evento haciendo clic directo sobre un día del
  // calendario (en vez de tener que escribirla a mano en el formulario).
  const [fechaSugerida, setFechaSugerida] = useState<string | undefined>(undefined);
  // Día seleccionado en el calendario: al hacer clic en un día se muestran sus
  // eventos en el panel lateral; recién ahí aparece el botón para crear uno
  // nuevo en ese día específico (no se abre el modal directo al hacer clic).
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);

  const desde = new Date(año, mes, 1).toISOString();
  const hasta  = new Date(año, mes + 1, 0, 23, 59, 59).toISOString();
  const params = new URLSearchParams({ desde, hasta }).toString();
  const { data, isLoading, mutate } = useEventos(params);
  const { loading: saving, mutate: save } = useMutation();

  const eventos = (data as any)?.data ?? [];
  const conteoTipo = (tipo: string) => eventos.filter((e: any) => e.tipo === tipo).length;

  const handleGuardar = async (form: any) => {
    await save(async () => {
      if (editando) {
        await api.patch(`/eventos/${editando.id}`, form);
        toast.success('Evento actualizado');
      } else {
        await api.post('/eventos', form);
        toast.success('Evento creado');
      }
      mutate();
      setShowModal(false);
      setEditando(null);
    });
  };

  const handleEliminar = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar el evento "${titulo}"?`)) return;
    await api.delete(`/eventos/${id}`);
    toast.success('Evento eliminado');
    mutate();
  };

  // Construir grilla del calendario
  const diasEnMes  = new Date(año, mes + 1, 0).getDate();
  const primerDia  = new Date(año, mes, 1).getDay(); // 0=Dom
  const celdas: (number | null)[] = [...Array(primerDia).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];

  const eventosPorDia = (dia: number) =>
    eventos.filter((e: any) => {
      // Las fechas se guardan como "medianoche UTC" del día elegido — hay que
      // leerlas con los getters UTC, si no, en un huso horario negativo
      // (Perú, UTC-5) el día se corre uno hacia atrás (8 pasaba a mostrarse
      // como 7).
      const fi = new Date(e.fechaInicio).getUTCDate();
      const ff = e.fechaFin ? new Date(e.fechaFin).getUTCDate() : fi;
      return dia >= fi && dia <= ff;
    });

  return (
    <DashboardLayout title="Calendario de Eventos" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      <section style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10,marginBottom:14 }}>
        {[
          ['Eventos del mes', eventos.length, 'bi-calendar-event'],
          ['Actividades', conteoTipo('ACTIVIDAD'), 'bi-stars'],
          ['Reuniones', conteoTipo('REUNION'), 'bi-people'],
          ['Cambios de clase', conteoTipo('SUSPENSION_CLASES') + conteoTipo('FERIADO'), 'bi-exclamation-triangle'],
        ].map(([label,value,icon]) => <div className="sige-card" key={String(label)} style={{padding:'12px 14px',display:'flex',alignItems:'center',gap:10}}><i className={`bi ${icon}`} style={{color:'var(--accent)'}}/><div><strong style={{display:'block',fontSize:18}}>{value}</strong><small style={{color:'var(--text-muted)'}}>{label}</small></div></div>)}
      </section>

      {/* Controles mes/año */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => { const d = new Date(año, mes - 1); setMes(d.getMonth()); setAño(d.getFullYear()); }}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
          ><i className="bi bi-chevron-left" /></button>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', minWidth: 160, textAlign: 'center' }}>
            {MESES[mes]} {año}
          </h3>
          <button
            onClick={() => { const d = new Date(año, mes + 1); setMes(d.getMonth()); setAño(d.getFullYear()); }}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
          ><i className="bi bi-chevron-right" /></button>
          <button
            onClick={() => { setMes(hoy.getMonth()); setAño(hoy.getFullYear()); }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem' }}
          >Hoy</button>
        </div>
        <button className="btn-accent" onClick={() => { setEditando(null); setFechaSugerida(undefined); setShowModal(true); }}>
          <i className="bi bi-plus-lg" /> Nuevo Evento
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: '1.25rem' }}>

        {/* Calendario */}
        <div className="sige-card" style={{ padding: '1rem' }}>
          {/* Días de la semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '0.5rem' }}>
            {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.25rem 0' }}>{d}</div>
            ))}
          </div>
          {/* Grilla */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <div className="spinner-border spinner-border-sm" />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {celdas.map((dia, idx) => {
                const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && año === hoy.getFullYear();
                const esSeleccionado = dia === diaSeleccionado;
                const evsDia = dia ? eventosPorDia(dia) : [];
                return (
                  <div key={idx}
                    onClick={() => { if (!dia) return; setDiaSeleccionado(d => d === dia ? null : dia); }}
                    title={dia ? 'Clic para ver los eventos de este día' : undefined}
                    style={{
                    minHeight: 72, padding: '0.25rem', borderRadius: 6,
                    background: esSeleccionado ? 'var(--accent)' : esHoy ? 'var(--accent-soft)' : dia ? 'var(--bg-secondary)' : 'transparent',
                    border: esHoy && !esSeleccionado ? '1px solid var(--accent)' : '1px solid transparent',
                    cursor: dia ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}>                    {dia && (
                      <>
                        <div style={{
                          fontSize: '0.78rem', fontWeight: esHoy || esSeleccionado ? 700 : 500,
                          color: esSeleccionado ? '#fff' : esHoy ? 'var(--accent)' : 'var(--text-primary)',
                          marginBottom: 3,
                        }}>{dia}</div>
                        {evsDia.slice(0, 2).map((ev: any) => {
                          const conf = TIPO_CONF[ev.tipo] ?? TIPO_CONF.OTRO;
                          return (
                            <div key={ev.id}
                              title={ev.titulo}
                              style={{
                              fontSize: '0.65rem',
                              background: esSeleccionado ? 'rgba(255,255,255,0.25)' : conf.bg,
                              color: esSeleccionado ? '#fff' : conf.color,
                              borderRadius: 3, padding: '1px 4px', marginBottom: 2,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              fontWeight: 600,
                            }}>{ev.titulo}</div>
                          );
                        })}
                        {evsDia.length > 2 && (
                          <div style={{ fontSize: '0.6rem', color: esSeleccionado ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>+{evsDia.length - 2} más</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lista de eventos del mes, o detalle del día seleccionado */}
        <div className="sige-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              {diaSeleccionado ? `${diaSeleccionado} de ${MESES[mes]}` : `Eventos del mes (${eventos.length})`}
            </span>
            {diaSeleccionado ? (
              <button onClick={() => setDiaSeleccionado(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                <i className="bi bi-x-lg me-1" />Ver mes
              </button>
            ) : null}
          </div>

          {diaSeleccionado && (
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
              <button className="btn-accent" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { setEditando(null); setFechaSugerida(`${año}-${String(mes + 1).padStart(2, '0')}-${String(diaSeleccionado).padStart(2, '0')}`); setShowModal(true); }}>
                <i className="bi bi-plus-lg me-1" />Nuevo evento este día
              </button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {(diaSeleccionado ? eventosPorDia(diaSeleccionado) : eventos.slice().sort((a: any, b: any) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()))
              .length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <i className="bi bi-calendar2-x" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8 }} />
                {diaSeleccionado ? 'No hay eventos programados este día.' : 'Sin eventos este mes'}
              </div>
            ) : (diaSeleccionado ? eventosPorDia(diaSeleccionado) : eventos.slice().sort((a: any, b: any) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()))
              .map((ev: any) => {
                const conf = TIPO_CONF[ev.tipo] ?? TIPO_CONF.OTRO;
                return (
                  <div key={ev.id} style={{
                    padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)',
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: conf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <i className={`bi ${conf.icon}`} style={{ color: conf.color, fontSize: '0.9rem' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: 2 }}>{ev.titulo}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(ev.fechaInicio).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                        {ev.fechaFin && ` — ${new Date(ev.fechaFin).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`}
                      </div>
                      <span style={{ fontSize: '0.68rem', background: conf.bg, color: conf.color, padding: '1px 6px', borderRadius: 99, fontWeight: 600 }}>
                        {ev.tipo.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <button onClick={() => { setEditando(ev); setShowModal(true); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                        <i className="bi bi-pencil" style={{ fontSize: '0.85rem' }} />
                      </button>
                      <button onClick={() => handleEliminar(ev.id, ev.titulo)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}>
                        <i className="bi bi-trash" style={{ fontSize: '0.85rem' }} />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditando(null); } }}>
            <motion.div className="sige-modal" initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <EventoForm inicial={editando} fechaSugerida={fechaSugerida} onGuardar={handleGuardar}
                onCancelar={() => { setShowModal(false); setEditando(null); setFechaSugerida(undefined); }} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function EventoForm({ inicial, fechaSugerida, onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({
    titulo:      inicial?.titulo      ?? '',
    descripcion: inicial?.descripcion ?? '',
    tipo:        inicial?.tipo        ?? 'ACTIVIDAD',
    fechaInicio: inicial?.fechaInicio ? inicial.fechaInicio.split('T')[0] : (fechaSugerida ?? ''),
    fechaFin:    inicial?.fechaFin    ? inicial.fechaFin.split('T')[0]    : (fechaSugerida ?? ''),
    todoElDia:   inicial?.todoElDia   ?? true,
    lugar:       inicial?.lugar       ?? '',
  });
  const set = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    if (payload.fechaInicio) payload.fechaInicio = new Date(payload.fechaInicio).toISOString();
    if (payload.fechaFin)    payload.fechaFin    = new Date(payload.fechaFin).toISOString();
    onGuardar(payload);
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
          <i className="bi bi-calendar-event me-2" />{inicial ? 'Editar Evento' : 'Nuevo Evento'}
        </h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Título *</label>
          <input type="text" value={form.titulo} onChange={set('titulo')} required className="sige-input" placeholder="Ej: Día del Maestro" />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Tipo *</label>
          <select value={form.tipo} onChange={set('tipo')} className="sige-input">
            {Object.entries(TIPO_CONF).map(([k]) => (
              <option key={k} value={k}>{k.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Fecha Inicio *</label>
            <input type="date" value={form.fechaInicio} onChange={set('fechaInicio')} required className="sige-input" />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Fecha Fin</label>
            <input type="date" value={form.fechaFin} onChange={set('fechaFin')} className="sige-input" min={form.fechaInicio} />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.todoElDia} onChange={set('todoElDia')} />
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Todo el día</span>
        </label>

        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Lugar</label>
          <input type="text" value={form.lugar} onChange={set('lugar')} className="sige-input" placeholder="Ej: Auditorio principal" />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Descripción</label>
          <textarea value={form.descripcion} onChange={set('descripcion')} className="sige-input" style={{ minHeight: 72, resize: 'vertical' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
          Cancelar
        </button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</> : <><i className="bi bi-check2 me-1" />{inicial ? 'Actualizar' : 'Crear Evento'}</>}
        </button>
      </div>
    </form>
  );
}
