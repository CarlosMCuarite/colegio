'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const BADGE_COLORS = [
  { bg: '#f1f5f9', text: '#475569' }, { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#ede9fe', text: '#5b21b6' }, { bg: '#fef3c7', text: '#92400e' },
  { bg: '#d1fae5', text: '#065f46' }, { bg: '#fee2e2', text: '#991b1b' },
];
function badgeFor(nombre: string) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length];
}

export default function MembresiasPage() {
  const { data: planesRaw, mutate: mutatePlanes } = useData<any>('/membresias/planes');
  const { data: alertasRaw }                       = useData<any>('/membresias/alertas');
  const { loading: saving, mutate: save }          = useMutation();
  const [editando, setEditando]                    = useState<any>(null);
  const [showNuevo, setShowNuevo]                  = useState(false);
  const [showRenovar, setShowRenovar]              = useState<any>(null);

  const planes  = (planesRaw as any)?.data  ?? [];
  const alertas = (alertasRaw as any)?.data ?? [];

  const crearPlan = async (form: any) => {
    await save(async () => {
      await api.post('/membresias/planes', form);
      toast.success('Plan creado correctamente');
      mutatePlanes();
      setShowNuevo(false);
    });
  };

  const guardarPlan = async (form: any) => {
    await save(async () => {
      await api.patch(`/membresias/planes/${editando.id}`, form);
      toast.success('Plan actualizado correctamente');
      mutatePlanes();
      setEditando(null);
    });
  };

  const togglePlan = async (plan: any) => {
    const accion = plan.activo ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} el plan "${plan.nombre}"?`)) return;
    await save(async () => {
      await api.patch(`/membresias/planes/${plan.id}/toggle`);
      toast.success(`Plan ${plan.activo ? 'desactivado' : 'activado'}`);
      mutatePlanes();
    });
  };

  const eliminarPlan = async (plan: any) => {
    if (!confirm(`¿Eliminar permanentemente el plan "${plan.nombre}"? Solo es posible si ningún colegio lo usa o lo usó.`)) return;
    await save(async () => {
      await api.delete(`/membresias/planes/${plan.id}`);
      toast.success('Plan eliminado');
      mutatePlanes();
    });
  };

  const renovar = async (colegioId: string, planId: string, meses: number) => {
    await save(async () => {
      await api.post(`/membresias/renovar/${colegioId}`, { planId, meses });
      toast.success('Licencia renovada exitosamente');
      setShowRenovar(null);
    });
  };

  return (
    <DashboardLayout title="Membresías y Planes" allowedRoles={['SUPERADMIN']}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.8rem', color: 'var(--accent)', flex: 1, minWidth: 260 }}>
          <i className="bi bi-info-circle me-2" />
          Crea cuantos planes necesites: Básico, Premium, Diamante, Corporativo, Personalizado...
        </div>
        <button className="btn-accent" onClick={() => setShowNuevo(true)}>
          <i className="bi bi-plus-lg me-1" />Nuevo Plan
        </button>
      </div>

      {alertas.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '0.875rem 1rem' }}>
            <h4 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#92400e', margin: '0 0 0.75rem' }}>
              <i className="bi bi-exclamation-triangle me-2" />⚠️ {alertas.length} licencia(s) próxima(s) a vencer
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {alertas.map((c: any) => {
                const dias = Math.ceil((new Date(c.licenciaFin).getTime() - Date.now()) / 86400000);
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem' }}>{c.nombre}</span>
                    <span style={{ fontSize: '0.78rem', color: '#b45309' }}>{c.plan?.nombre}</span>
                    <span style={{ fontWeight: 700, color: dias <= 7 ? '#ef4444' : '#d97706', fontSize: '0.82rem' }}>{dias <= 0 ? '¡VENCIDA!' : `${dias} días`}</span>
                    <button onClick={() => setShowRenovar(c)} className="btn-accent" style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}><i className="bi bi-arrow-clockwise me-1" />Renovar</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Planes del sistema ({planes.length})</h3>

      {planes.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-credit-card" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />Sin planes aún. Crea el primero.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1rem' }}>
          {planes.map((plan: any, i: number) => {
            const badge = badgeFor(plan.nombre);
            return (
              <motion.div key={plan.id} className="sige-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                  <div>
                    <h4 style={{ fontWeight: 800, fontSize: '1rem', margin: 0, marginBottom: 4 }}>{plan.nombre}</h4>
                    <span style={{ fontSize: '0.72rem', background: plan.activo ? '#d1fae5' : '#fee2e2', color: plan.activo ? '#065f46' : '#991b1b', padding: '1px 8px', borderRadius: 99, fontWeight: 600 }}>
                      {plan.activo ? '● Activo' : '○ Inactivo'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>S/ {Number(plan.precio).toFixed(0)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>cada {plan.duracionDias} días</div>
                  </div>
                </div>
                {plan.descripcion && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>{plan.descripcion}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  {[
                    { icon: 'bi-person-badge', label: 'Estudiantes', value: plan.maxEstudiantes.toLocaleString() },
                    { icon: 'bi-people', label: 'Usuarios', value: plan.maxUsuarios.toLocaleString() },
                    { icon: 'bi-hdd', label: 'Almacenamiento', value: `${plan.maxAlmacenamientoGB} GB` },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', alignItems: 'center' }}>
                      <i className={`bi ${item.icon}`} style={{ color: 'var(--accent)', width: 16 }} />
                      <span style={{ flex: 1 }}>{item.label}</span><strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
                {(plan.rolesHabilitados ?? []).length > 0 && (
                  <div style={{ marginBottom: '0.875rem' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>ROLES INCLUIDOS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {plan.rolesHabilitados.map((r: string) => (
                        <span key={r} style={{ fontSize: '0.65rem', background: badge.bg, color: badge.text, padding: '1px 7px', borderRadius: 99, fontWeight: 600 }}>{r}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setEditando(plan)} className="btn-accent" style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem', padding: '0.45rem' }}><i className="bi bi-pencil me-1" />Editar</button>
                  <button onClick={() => togglePlan(plan)} disabled={saving} style={{ background: plan.activo ? '#fee2e2' : '#d1fae5', border: 'none', borderRadius: 8, padding: '0.45rem 0.75rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', color: plan.activo ? '#991b1b' : '#065f46' }}>
                    {plan.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => eliminarPlan(plan)} disabled={saving} title="Eliminar" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.45rem 0.6rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {(editando || showNuevo) && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) { setEditando(null); setShowNuevo(false); } }}>
            <motion.div className="sige-modal" style={{ maxWidth: 540 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <PlanForm
                plan={editando}
                onGuardar={editando ? guardarPlan : crearPlan}
                onCancelar={() => { setEditando(null); setShowNuevo(false); }}
                saving={saving}
              />
            </motion.div>
          </motion.div>
        )}
        {showRenovar && <ModalRenovar colegio={showRenovar} planes={planes} onRenovar={renovar} onCancelar={() => setShowRenovar(null)} saving={saving} />}
      </AnimatePresence>
    </DashboardLayout>
  );
}

const ROLES_DISPONIBLES = ['AUXILIAR','PSICOLOGO','COORDINADOR','TUTOR','CONTADOR','ENFERMERIA'];
const MODULOS_DISPONIBLES = ['ESTUDIANTES','PADRES','MATRICULAS','ASISTENCIA','PAGOS','COMUNICADOS','EVENTOS','ENCUESTAS','DOCUMENTOS','QR','CHATBOT','HORARIOS','OBSERVACIONES','PERMISOS'];

function PlanForm({ plan, onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({
    nombre:              plan?.nombre              ?? '',
    descripcion:         plan?.descripcion          ?? '',
    precio:              plan?.precio               ?? 100,
    duracionDias:        plan?.duracionDias         ?? 30,
    maxEstudiantes:      plan?.maxEstudiantes       ?? 300,
    maxUsuarios:         plan?.maxUsuarios          ?? 20,
    maxAlmacenamientoGB: plan?.maxAlmacenamientoGB  ?? 5,
    modulosActivos:      plan?.modulosActivos       ?? ['ALL'],
    rolesHabilitados:    plan?.rolesHabilitados     ?? ['DIRECTOR','SECRETARIA','DOCENTE'],
    observaciones:       plan?.observaciones        ?? '',
  });
  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const toggleRol = (r: string) => setForm(p => ({
    ...p, rolesHabilitados: p.rolesHabilitados.includes(r) ? p.rolesHabilitados.filter((x: string) => x !== r) : [...p.rolesHabilitados, r],
  }));
  const toggleModulo = (m: string) => setForm(p => {
    if (m === 'ALL') return { ...p, modulosActivos: p.modulosActivos.includes('ALL') ? [] : ['ALL'] };
    const sinAll = p.modulosActivos.filter((x: string) => x !== 'ALL');
    return { ...p, modulosActivos: sinAll.includes(m) ? sinAll.filter((x: string) => x !== m) : [...sinAll, m] };
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onGuardar({
      nombre: form.nombre, descripcion: form.descripcion || null,
      precio: Number(form.precio), duracionDias: Number(form.duracionDias),
      maxEstudiantes: Number(form.maxEstudiantes), maxUsuarios: Number(form.maxUsuarios),
      maxAlmacenamientoGB: Number(form.maxAlmacenamientoGB),
      modulosActivos: form.modulosActivos, rolesHabilitados: form.rolesHabilitados,
      observaciones: form.observaciones || null,
    });
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{plan ? `Editar Plan — ${plan.nombre}` : 'Nuevo Plan'}</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre del plan *</label><input type="text" value={form.nombre} onChange={set('nombre')} required className="sige-input" placeholder="Ej: Diamante, Corporativo, VIP..." /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Descripción</label><input type="text" value={form.descripcion} onChange={set('descripcion')} className="sige-input" /></div>
        {[['Precio (S/)','precio','0'],['Duración (días)','duracionDias','1'],['Máx. estudiantes','maxEstudiantes','1'],['Máx. usuarios','maxUsuarios','1'],['Almacenamiento GB','maxAlmacenamientoGB','0.1']].map(([label, key, min]) => (
          <div key={key}><label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label><input type="number" value={(form as any)[key]} onChange={set(key)} required min={min} step="any" className="sige-input" /></div>
        ))}

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Módulos habilitados</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <button type="button" onClick={() => toggleModulo('ALL')} style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 600, background: form.modulosActivos.includes('ALL') ? 'var(--accent)' : 'var(--bg-secondary)', color: form.modulosActivos.includes('ALL') ? '#fff' : 'var(--text-secondary)' }}>TODOS</button>
            {MODULOS_DISPONIBLES.map(m => (
              <button key={m} type="button" onClick={() => toggleModulo(m)} disabled={form.modulosActivos.includes('ALL')}
                style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 600, opacity: form.modulosActivos.includes('ALL') ? 0.4 : 1,
                  background: form.modulosActivos.includes(m) ? 'var(--accent)' : 'var(--bg-secondary)', color: form.modulosActivos.includes(m) ? '#fff' : 'var(--text-secondary)' }}>{m}</button>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Roles opcionales incluidos</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {ROLES_DISPONIBLES.map(r => (
              <button key={r} type="button" onClick={() => toggleRol(r)}
                style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 600,
                  background: form.rolesHabilitados.includes(r) ? 'var(--accent)' : 'var(--bg-secondary)', color: form.rolesHabilitados.includes(r) ? '#fff' : 'var(--text-secondary)' }}>{r}</button>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Observaciones internas</label><textarea value={form.observaciones} onChange={set('observaciones')} className="sige-input" style={{ minHeight: 56, resize: 'vertical' }} /></div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>{saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />{plan ? 'Guardar cambios' : 'Crear plan'}</>}</button>
      </div>
    </form>
  );
}

function ModalRenovar({ colegio, planes, onRenovar, onCancelar, saving }: any) {
  const [planId, setPlanId] = useState(colegio.planId ?? '');
  const [meses, setMeses]   = useState(12);
  const planesActivos = planes.filter((p: any) => p.activo);
  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="sige-modal" style={{ maxWidth: 400 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1rem' }}><i className="bi bi-arrow-clockwise me-2" />Renovar licencia</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{colegio.nombre}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.25rem' }}>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Plan</label>
            <select value={planId} onChange={e => setPlanId(e.target.value)} className="sige-input">
              {planesActivos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} — S/ {Number(p.precio).toFixed(0)}</option>)}
            </select>
          </div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Meses</label>
            <select value={meses} onChange={e => setMeses(Number(e.target.value))} className="sige-input">
              {[1,3,6,12,24,36].map(m => <option key={m} value={m}>{m} mes{m > 1 ? 'es' : ''}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancelar</button>
          <button onClick={() => onRenovar(colegio.id, planId, meses)} className="btn-accent" disabled={saving || !planId}>{saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />Renovar</>}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
