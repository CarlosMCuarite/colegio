'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import HorarioGrid from '@/components/HorarioGrid';
import { useHorarios, useNivelesGrados, useMutation, useData } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function HorariosPage() {
  const [nivelGradoId, setNivelGradoId] = useState('');
  const [seccionId, setSeccionId]       = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editando, setEditando]         = useState<any>(null);
  const [vista, setVista]               = useState<'tabla' | 'lista'>('tabla');
  // Qué grado/sección imprimir cuando hay varios a la vez ('' = todos).
  const [imprimirGrupo, setImprimirGrupo] = useState('');

  const params = new URLSearchParams({ nivelGradoId, seccionId }).toString();
  const { data, isLoading, mutate }       = useHorarios(params);
  const { data: nivelesData }             = useNivelesGrados();
  const { data: docentesData }            = useData<any>('/horarios/docentes-disponibles');
  const { data: aulasData }               = useData<any>('/horarios/aulas-disponibles');
  const { loading: saving, mutate: save } = useMutation();

  const agrupado      = (data as any)?.agrupado ?? {};
  const horariosLista = (data as any)?.data     ?? [];
  const niveles  = (nivelesData as any)?.data ?? [];
  const docentes = (docentesData as any)?.data ?? [];
  const aulas    = (aulasData as any)?.data ?? [];
  const selectedNivel = niveles.find((n: any) => n.id === nivelGradoId);
  // El aula es la que ya está vinculada a la sección seleccionada arriba — no
  // se vuelve a pedir en el modal.
  const aulaDeSeccion = aulas.find((a: any) => a.seccionId === seccionId);

  // Cuando se ven varios grados/secciones a la vez (o un grado con varias
  // secciones), agrupamos por grado+sección: si no lo hacemos, dos horarios de
  // grados distintos en la MISMA hora del MISMO día quedan superpuestos en una
  // sola celda de la tabla y solo se ve uno de los dos (el otro "desaparece").
  const grupos = (() => {
    const mapa = new Map<string, { titulo: string; horarios: any[] }>();
    for (const h of horariosLista) {
      const key = `${h.nivelGradoId}|${h.seccionId ?? ''}`;
      const titulo = h.seccion?.nombre
        ? `${h.nivelGrado?.nombre ?? ''} · Sección ${h.seccion.nombre}`
        : (h.nivelGrado?.nombre ?? 'Sin grado');
      if (!mapa.has(key)) mapa.set(key, { titulo, horarios: [] });
      mapa.get(key)!.horarios.push(h);
    }
    return Array.from(mapa.values()).sort((a, b) => a.titulo.localeCompare(b.titulo));
  })();

  const guardar = async (form: any) => {
    const { diasSemana, ...resto } = form;
    await save(async () => {
      if (editando) {
        await api.patch(`/horarios/${editando.id}`, resto);
        toast.success('Horario actualizado');
      } else if (diasSemana?.length > 1) {
        await api.post('/horarios/multi-dia', { ...resto, diasSemana, nivelGradoId, seccionId: seccionId || null });
        toast.success(`Horario creado en ${diasSemana.length} días`);
      } else {
        await api.post('/horarios', { ...resto, diaSemana: diasSemana?.[0] ?? resto.diaSemana, nivelGradoId, seccionId: seccionId || null });
        toast.success('Horario creado');
      }
      mutate(); setShowModal(false); setEditando(null);
    });
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este horario?')) return;
    try {
      await api.delete(`/horarios/${id}`);
      toast.success('Horario eliminado');
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo eliminar');
    }
  };

  const limpiarHorarioGrado = async () => {
    if (!nivelGradoId) return;
    if (!confirm('¿Eliminar TODOS los horarios de este grado/sección?')) return;
    try {
      const qs = seccionId ? `?seccionId=${seccionId}` : '';
      await api.delete(`/horarios/grado/${nivelGradoId}${qs}`);
      toast.success('Horarios eliminados');
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Error al limpiar horario');
    }
  };

  return (
    <DashboardLayout title="Horarios" allowedRoles={['SUPERADMIN','ADMINISTRADOR']}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 200 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Grado</label>
          <select value={nivelGradoId} onChange={e => { setNivelGradoId(e.target.value); setSeccionId(''); }} className="sige-input">
            <option value="">Todos los grados</option>
            {niveles.map((n: any) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Sección</label>
          <select value={seccionId} onChange={e => setSeccionId(e.target.value)} className="sige-input" disabled={!nivelGradoId}>
            <option value="">Todas</option>
            {selectedNivel?.secciones?.map((s: any) => <option key={s.id} value={s.id}>Sección {s.nombre}</option>)}
          </select>
        </div>
        <button className="btn-accent" onClick={() => { setEditando(null); setShowModal(true); }} disabled={!nivelGradoId}>
          <i className="bi bi-plus-lg" />Agregar Horario
        </button>
        <a href="/admin/cursos" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 0.875rem', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-journal-bookmark" />Gestionar Cursos
        </a>
        {nivelGradoId && (
          <button onClick={limpiarHorarioGrado}
            style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '0.5rem 0.875rem', cursor: 'pointer', color: '#991b1b', fontSize: '0.82rem', fontWeight: 600 }}>
            <i className="bi bi-trash me-1" />Limpiar horario
          </button>
        )}
      </div>

      {horariosLista.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={() => setVista('tabla')}
              style={{ padding: '0.35rem 0.875rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                background: vista === 'tabla' ? 'var(--accent)' : 'var(--bg-card)', color: vista === 'tabla' ? '#fff' : 'var(--text-secondary)',
                border: vista !== 'tabla' ? '1px solid var(--border-color)' : 'none' } as any}>
              <i className="bi bi-grid-3x3 me-1" />Vista de tabla
            </button>
            <button onClick={() => setVista('lista')}
              style={{ padding: '0.35rem 0.875rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                background: vista === 'lista' ? 'var(--accent)' : 'var(--bg-card)', color: vista === 'lista' ? '#fff' : 'var(--text-secondary)',
                border: vista !== 'lista' ? '1px solid var(--border-color)' : 'none' } as any}>
              <i className="bi bi-list-ul me-1" />Vista de lista
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {vista === 'tabla' && grupos.length > 1 && (
              <select value={imprimirGrupo} onChange={e => setImprimirGrupo(e.target.value)} className="sige-input"
                style={{ width: 'auto', fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}>
                <option value="">Imprimir: todos</option>
                {grupos.map(g => <option key={g.titulo} value={g.titulo}>Imprimir: {g.titulo}</option>)}
              </select>
            )}
            <button onClick={() => window.print()}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.35rem 0.875rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              <i className="bi bi-printer me-1" />Imprimir / Descargar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
      ) : Object.keys(agrupado).length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-calendar3" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />
          {nivelGradoId ? 'Sin horarios para este grado. Agrega el primero.' : 'Selecciona un grado para ver su horario.'}
        </div>
      ) : vista === 'tabla' ? (
        <div className="horario-print-root" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {grupos.map(g => (
            <div key={g.titulo} className={`sige-card ${imprimirGrupo && imprimirGrupo !== g.titulo ? 'print-oculto' : ''}`} style={{ padding: 0, overflow: 'hidden' }}>
              {grupos.length > 1 && (
                <div style={{ padding: '0.6rem 1rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <i className="bi bi-mortarboard me-2" />{g.titulo}
                </div>
              )}
              <div style={{ padding: grupos.length > 1 ? '0.75rem' : 0 }}>
                <HorarioGrid horarios={g.horarios} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Object.entries(agrupado).map(([dia, items]: any) => (
            <div key={dia} className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.625rem 1rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                <i className="bi bi-calendar3 me-2" />{dia}
              </div>
              <div>
                {items.map((h: any, i: number) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.625rem 1rem', borderBottom: i < items.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-muted)', minWidth: 110 }}>{h.horaInicio} – {h.horaFin}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>{h.materia}</span>
                    {!nivelGradoId && (h.nivelGrado?.nombre || h.seccion?.nombre) && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 999, padding: '2px 8px' }}>
                        {h.nivelGrado?.nombre}{h.seccion?.nombre ? ` · ${h.seccion.nombre}` : ''}
                      </span>
                    )}
                    {h.aula?.nombre && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}><i className="bi bi-door-open me-1" />{h.aula.nombre}</span>}
                    {h.docente ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}><i className="bi bi-person me-1" />{h.docente.nombres} {h.docente.apellidos}</span>
                    ) : h.docenteNombre && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{h.docenteNombre}</span>
                    )}
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button onClick={() => { setEditando(h); setShowModal(true); }}
                        style={{ background: 'var(--accent-soft)', border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', color: 'var(--accent)' }}>
                        <i className="bi bi-pencil" style={{ fontSize: '0.8rem' }} />
                      </button>
                      <button onClick={() => eliminar(h.id)}
                        style={{ background: '#fee2e2', border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', color: '#991b1b' }}>
                        <i className="bi bi-trash" style={{ fontSize: '0.8rem' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditando(null); } }}>
            <motion.div className="sige-modal" style={{ maxWidth: 460 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <HorarioForm inicial={editando} docentes={docentes} aulaDeSeccion={aulaDeSeccion} nivelGradoId={nivelGradoId}
                onGuardar={guardar} onCancelar={() => { setShowModal(false); setEditando(null); }} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function HorarioForm({ inicial, docentes, aulaDeSeccion, nivelGradoId, onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({
    diaSemana:  inicial?.diaSemana  ?? 1,
    horaInicio: inicial?.horaInicio ?? '07:30',
    horaFin:    inicial?.horaFin    ?? '08:15',
    cursoId:    inicial?.cursoId    ?? inicial?.curso?.id ?? '',
    tipoBloque: inicial?.tipoBloque ?? 'CLASE',
    docenteId:  inicial?.docenteId  ?? inicial?.docente?.id ?? '',
  });
  // Antes esto era un input de texto libre ("Matemáticas", "Mate", "MATE 1"
  // — cada quien lo escribía distinto). Ahora se elige un Curso real del
  // grado, que es contra lo que luego el docente registra notas.
  const { data: cursosData } = useData<any>(nivelGradoId ? `/horarios/cursos-disponibles/${nivelGradoId}` : null);
  const cursos = cursosData?.data ?? [];
  // Sólo aplica al crear (no al editar un registro puntual): permite marcar el
  // mismo bloque en varios días a la vez, típicamente el recreo de lunes a viernes.
  const [rango, setRango] = useState(false);
  const [diaDesde, setDiaDesde] = useState(1);
  const [diaHasta, setDiaHasta] = useState(5);

  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const esRecreo = form.tipoBloque === 'RECREO';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!esRecreo && !form.cursoId) { toast.error('Selecciona el curso'); return; }
    const diasSemana = !inicial && rango
      ? Array.from({ length: Math.max(1, Number(diaHasta) - Number(diaDesde) + 1) }, (_, i) => Number(diaDesde) + i)
      : [Number(form.diaSemana)];
    const cursoElegido = cursos.find((c: any) => c.id === form.cursoId);
    onGuardar({
      ...form,
      diasSemana,
      diaSemana: diasSemana[0],
      cursoId:   esRecreo ? null : form.cursoId,
      materia:   esRecreo ? 'Recreo' : (cursoElegido?.nombre ?? 'Clase'),
      docenteId: esRecreo ? null : (form.docenteId || null),
      aulaId:    esRecreo ? null : (aulaDeSeccion?.id ?? null),
    });
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{inicial ? 'Editar Horario' : 'Nuevo Horario'}</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={() => setForm(p => ({ ...p, tipoBloque: 'CLASE' }))}
            style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              background: !esRecreo ? 'var(--accent)' : 'var(--bg-secondary)', color: !esRecreo ? '#fff' : 'var(--text-secondary)' }}>
            <i className="bi bi-book me-1" />Clase
          </button>
          <button type="button" onClick={() => setForm(p => ({ ...p, tipoBloque: 'RECREO' }))}
            style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              background: esRecreo ? '#f59e0b' : 'var(--bg-secondary)', color: esRecreo ? '#fff' : 'var(--text-secondary)' }}>
            <i className="bi bi-cup-hot me-1" />Recreo
          </button>
        </div>

        {!inicial && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={rango} onChange={e => setRango(e.target.checked)} />
            Aplicar a un rango de días (ej. lunes a viernes)
          </label>
        )}

        {!inicial && rango ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Desde *</label>
              <select value={diaDesde} onChange={e => setDiaDesde(Number(e.target.value))} className="sige-input">
                {DIAS.slice(1).map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Hasta *</label>
              <select value={diaHasta} onChange={e => setDiaHasta(Number(e.target.value))} className="sige-input">
                {DIAS.slice(1).map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Día *</label>
            <select value={form.diaSemana} onChange={set('diaSemana')} required className="sige-input">
              {DIAS.slice(1).map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Hora inicio *</label>
            <input type="time" value={form.horaInicio} onChange={set('horaInicio')} required className="sige-input" />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Hora fin *</label>
            <input type="time" value={form.horaFin} onChange={set('horaFin')} required className="sige-input" />
          </div>
        </div>
        {!esRecreo && (
          <>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Curso *</label>
              <select value={form.cursoId} onChange={set('cursoId')} required className="sige-input">
                <option value="">— Selecciona un curso —</option>
                {cursos.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {cursos.length === 0 && (
                <span style={{ fontSize: '0.72rem', color: '#f59e0b' }}>
                  <i className="bi bi-exclamation-triangle me-1" />Este grado no tiene cursos creados todavía — ve a "Cursos" primero.
                </span>
              )}
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Docente</label>
              <select value={form.docenteId} onChange={set('docenteId')} className="sige-input">
                <option value="">— Sin asignar —</option>
                {docentes.map((d: any) => <option key={d.id} value={d.id}>{d.nombres} {d.apellidos} ({d.rol})</option>)}
              </select>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
              <i className="bi bi-door-open me-1" />
              Aula: {aulaDeSeccion ? aulaDeSeccion.nombre : 'la sección seleccionada arriba no tiene un aula asignada todavía'}
            </div>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />{inicial ? 'Actualizar' : 'Crear'}</>}
        </button>
      </div>
    </form>
  );
}
