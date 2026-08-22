'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useData, useMutation } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const ESTADO_CONF: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVO:     { bg: '#d1fae5', text: '#065f46', label: 'Activo'     },
  SUSPENDIDO: { bg: '#fee2e2', text: '#991b1b', label: 'Suspendido' },
  INACTIVO:   { bg: '#f1f5f9', text: '#475569', label: 'Inactivo'   },
  PRUEBA:     { bg: '#fef3c7', text: '#92400e', label: 'Prueba'     },
};

export default function ColegiosPage() {
  const [q, setQ]                 = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando]   = useState<any>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [showConfirmDescartar, setShowConfirmDescartar] = useState(false);

  const intentarCerrarModal = () => {
    if (formDirty) setShowConfirmDescartar(true);
    else { setShowModal(false); setEditando(null); }
  };
  const [credenciales, setCredenciales] = useState<any[] | null>(null);
  const [erroresCredenciales, setErroresCredenciales] = useState<any[] | null>(null);

  // Cargar colegios Y planes juntos
  const { data: colegiosData, isLoading, mutate } = useData<any>('/colegios');
  const { data: planesData }  = useData<any>('/membresias/planes');
  const { loading: saving, mutate: save } = useMutation();

  // El endpoint devuelve data como array cuando es superadmin
  const colegios  = Array.isArray((colegiosData as any)?.data) ? (colegiosData as any).data : [];
  const planes   = (planesData as any)?.data ?? [];

  const filtrados = colegios.filter((c: any) =>
    !q ||
    c.nombre?.toLowerCase().includes(q.toLowerCase()) ||
    c.ruc?.includes(q) ||
    c.nombreCorto?.toLowerCase().includes(q.toLowerCase())
  );

  const cambiarEstado = async (id: string, estadoActual: string, nombre: string) => {
    const nuevoEstado = estadoActual === 'ACTIVO' ? 'SUSPENDIDO' : 'ACTIVO';
    const accion = nuevoEstado === 'SUSPENDIDO' ? 'suspender' : 'activar';
    if (!confirm(`¿Deseas ${accion} el colegio "${nombre}"?`)) return;
    await save(async () => {
      await api.patch(`/colegios/${id}/estado`, { estado: nuevoEstado });
      toast.success(`Colegio ${nuevoEstado === 'SUSPENDIDO' ? 'suspendido' : 'activado'}`);
      mutate();
    });
  };

  const guardar = async (form: any) => {
    await save(async () => {
      if (editando) {
        await api.patch(`/colegios/${editando.id}`, form);
        toast.success('Colegio actualizado');
      } else {
        const res = await api.post('/colegios', form);
        toast.success('Colegio creado');
        if (res.data?.credenciales?.length) setCredenciales(res.data.credenciales);
        if (res.data?.erroresGeneracion?.length) setErroresCredenciales(res.data.erroresGeneracion);
      }
      mutate();
      setShowModal(false);
      setEditando(null);
    });
  };

  const abrirEditar = (c: any) => {
    setEditando(c);
    setFormDirty(false);
    setShowModal(true);
  };

  const ingresarComo = async (c: any) => {
    if (!confirm(`¿Ingresar como soporte al sistema de "${c.nombre}"? Esta acción queda registrada en auditoría.`)) return;
    await save(async () => {
      const res = await api.post(`/colegios/${c.id}/soporte-acceso`);
      const link = res.data?.data?.actionLink;
      if (link) {
        toast.success(`Abriendo acceso a ${c.nombre}...`);
        window.open(link, '_blank');
      } else {
        toast.error('No se pudo generar el enlace de acceso');
      }
    });
  };

  return (
    <DashboardLayout title="Gestión de Colegios" allowedRoles={['SUPERADMIN']}>

      {/* Barra */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <i className="bi bi-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Buscar por nombre o RUC..." value={q}
            onChange={e => setQ(e.target.value)} className="sige-input" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <button className="btn-accent" onClick={() => { setEditando(null); setFormDirty(false); setShowModal(true); }}>
          <i className="bi bi-plus-lg me-1" />Nuevo Colegio
        </button>
      </div>

      {/* Estadísticas rápidas */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {Object.entries(ESTADO_CONF).map(([est, conf]) => {
          const count = colegios.filter((c: any) => c.estado === est).length;
          if (!count) return null;
          return (
            <div key={est} style={{ background: conf.bg, borderRadius: 8, padding: '0.4rem 0.875rem', fontSize: '0.78rem', fontWeight: 600, color: conf.text }}>
              {count} {conf.label}{count > 1 ? 's' : ''}
            </div>
          );
        })}
      </div>

      {/* Tabla */}
      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner-border spinner-border-sm me-2" />Cargando colegios...
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="bi bi-building" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />
            {q ? 'Sin resultados para tu búsqueda' : 'Sin colegios registrados. Crea el primero.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead>
                <tr>
                  <th>Colegio</th>
                  <th>ID (para API por colegio)</th>
                  <th>RUC</th>
                  <th>Plan</th>
                  <th>Licencia</th>
                  <th>Estado</th>
                  <th>Usuarios</th>
                  <th>Alumnos</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c: any, i: number) => {
                  const conf = ESTADO_CONF[c.estado] ?? ESTADO_CONF.INACTIVO;
                  const diasLic = c.licenciaFin
                    ? Math.ceil((new Date(c.licenciaFin).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {c.logoUrl ? (
                            <img src={c.logoUrl} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} alt="logo" />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="bi bi-building" style={{ color: 'var(--accent)', fontSize: '0.9rem' }} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{c.nombre}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.distrito}{c.departamento ? `, ${c.departamento}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <IdConCopiar id={c.id} />
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{c.ruc ?? '—'}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{c.plan?.nombre ?? '—'}</td>
                      <td>
                        {diasLic !== null ? (
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: diasLic <= 0 ? '#ef4444' : diasLic <= 30 ? '#f59e0b' : '#10b981' }}>
                            {diasLic <= 0 ? 'Vencida' : `${diasLic}d`}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>}
                      </td>
                      <td>
                        <span className="estado-badge" style={{ background: conf.bg, color: conf.text }}>{conf.label}</span>
                      </td>
                      <td style={{ fontSize: '0.82rem', textAlign: 'center' }}>{c._count?.usuarios ?? 0}</td>
                      <td style={{ fontSize: '0.82rem', textAlign: 'center' }}>{c._count?.estudiantes ?? 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => ingresarComo(c)}
                            disabled={c.estado !== 'ACTIVO'}
                            style={{ background: '#ede9fe', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: c.estado === 'ACTIVO' ? 'pointer' : 'not-allowed', color: '#5b21b6', opacity: c.estado === 'ACTIVO' ? 1 : 0.4 }}
                            title="Ingresar como colegio (soporte)">
                            <i className="bi bi-box-arrow-in-right" />
                          </button>
                          <button onClick={() => abrirEditar(c)}
                            style={{ background: 'var(--accent-soft)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--accent)' }}
                            title="Editar">
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            onClick={() => cambiarEstado(c.id, c.estado, c.nombre)}
                            style={{
                              background: c.estado === 'ACTIVO' ? '#fee2e2' : '#d1fae5',
                              border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                              color: c.estado === 'ACTIVO' ? '#991b1b' : '#065f46',
                            }}
                            title={c.estado === 'ACTIVO' ? 'Suspender' : 'Activar'}>
                            <i className={`bi ${c.estado === 'ACTIVO' ? 'bi-pause-circle' : 'bi-play-circle'}`} />
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

      {/* Modal crear/editar */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) intentarCerrarModal(); }}>
            <motion.div className="sige-modal" style={{ maxWidth: 620 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <ColegioForm
                inicial={editando}
                planes={planes}
                onGuardar={guardar}
                onDirtyChange={setFormDirty}
                onCancelar={intentarCerrarModal}
                saving={saving}
              />
            </motion.div>
          </motion.div>
        )}
        {showConfirmDescartar && (
          <motion.div className="sige-modal-overlay" style={{ zIndex: 1100 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="sige-modal" style={{ maxWidth: 340, textAlign: 'center' }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem', color: '#f59e0b', display: 'block', marginBottom: 12 }} />
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>¿Deseas salir?</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Se perderán los cambios que no has guardado.</p>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={() => setShowConfirmDescartar(false)} style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                <button onClick={() => { setShowConfirmDescartar(false); setFormDirty(false); setShowModal(false); setEditando(null); }}
                  style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Salir sin guardar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal de credenciales generadas tras crear colegio */}
        {(credenciales || erroresCredenciales) && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="sige-modal" style={{ maxWidth: 480 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                  <i className="bi bi-key me-2" style={{ color: 'var(--accent)' }} />Credenciales generadas
                </h2>
                <button onClick={() => { setCredenciales(null); setErroresCredenciales(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
              </div>
              {credenciales && credenciales.length > 0 && (
                <>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Guárdalas ahora — no se mostrarán de nuevo. El colegio podrá cambiarlas luego.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {credenciales.map((c: any) => (
                      <div key={c.email} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.625rem 0.875rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>{c.rol}</div>
                        <div style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{c.email}</div>
                        <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{c.password}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {erroresCredenciales && erroresCredenciales.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>
                    <i className="bi bi-exclamation-triangle me-1" />
                    {credenciales?.length ? 'Algunas cuentas NO se pudieron crear:' : 'No se pudo crear ninguna cuenta de staff:'}
                  </div>
                  {erroresCredenciales.map((e: any) => (
                    <div key={e.email} style={{ fontSize: '0.76rem', color: '#991b1b', marginBottom: 4 }}>
                      <strong>{e.rol}</strong> ({e.email}): {e.error}
                    </div>
                  ))}
                  <div style={{ fontSize: '0.74rem', color: '#7f1d1d', marginTop: 6 }}>
                    Si el error menciona "API key" o "unauthorized", revisa <code>SUPABASE_SERVICE_ROLE_KEY</code> en el
                    .env del backend — es el mismo problema que puede estar afectando los respaldos.
                  </div>
                </div>
              )}
              <button onClick={() => { setCredenciales(null); setErroresCredenciales(null); }} className="btn-accent" style={{ width: '100%', justifyContent: 'center' }}>
                Entendido{credenciales?.length ? ', las he guardado' : ''}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function ColegioForm({ inicial, planes, onGuardar, onDirtyChange, onCancelar, saving }: any) {
  const [form, setForm] = useState({
    nombre:       inicial?.nombre       ?? '',
    nombreCorto:  inicial?.nombreCorto  ?? '',
    slug:         inicial?.slug         ?? '',
    ruc:          inicial?.ruc          ?? '',
    direccion:    inicial?.direccion    ?? '',
    distrito:     inicial?.distrito     ?? '',
    provincia:    inicial?.provincia    ?? '',
    departamento: inicial?.departamento ?? '',
    telefono:     inicial?.telefono     ?? '',
    email:        inicial?.email        ?? '',
    planId:       inicial?.planId       ?? (planes[0]?.id ?? ''),
    licenciaFin:  inicial?.licenciaFin  ? inicial.licenciaFin.split('T')[0] : '',
    generarUsuarios: !inicial,
  });
  const [slugTocado, setSlugTocado] = useState(!!inicial);

  const set = (k: string) => (e: any) => {
    onDirtyChange?.(true);
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(p => {
      const next = { ...p, [k]: value };
      // Auto-generar slug desde el nombre mientras el usuario no lo edite manualmente
      if (k === 'nombre' && !slugTocado) {
        next.slug = value.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
      }
      if (k === 'slug') setSlugTocado(true);
      return next;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.planId) { toast.error('Selecciona un plan'); return; }
    const payload: any = { ...form };
    if (payload.licenciaFin) {
      payload.licenciaFin    = new Date(payload.licenciaFin + 'T23:59:59').toISOString();
      payload.licenciaInicio = new Date().toISOString();
    }
    onGuardar(payload);
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
          <i className="bi bi-building me-2" />{inicial ? 'Editar Colegio' : 'Nuevo Colegio'}
        </h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', maxHeight: '65vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nombre del colegio *</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required className="sige-input" placeholder="Ej: Colegio de Encinas" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Slug (URL del portal) *
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>/colegio/{form.slug || '...'}</span>
          </label>
          <input type="text" value={form.slug} onChange={set('slug')} required className="sige-input" placeholder="encinas" pattern="[a-z0-9-]+" />
        </div>
        {[
          ['Nombre corto', 'nombreCorto', false],
          ['RUC',          'ruc',         false],
          ['Teléfono',     'telefono',    false],
          ['Email',        'email',       false],
          ['Dirección',    'direccion',   false],
          ['Distrito',     'distrito',    false],
          ['Provincia',    'provincia',   false],
          ['Departamento', 'departamento',false],
        ].map(([label, key, req]: any) => (
          <div key={key} style={['direccion'].includes(key) ? { gridColumn: '1 / -1' } : {}}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
            <input type="text" value={(form as any)[key]} onChange={set(key)} required={req} className="sige-input" />
          </div>
        ))}

        {/* Plan — SIEMPRE visible con todos los planes */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Plan *</label>
          {planes.length === 0 ? (
            <div style={{ background: '#fee2e2', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: '#991b1b' }}>
              <i className="bi bi-exclamation-triangle me-1" />No hay planes. Crea uno primero en Membresías.
            </div>
          ) : (
            <select value={form.planId} onChange={set('planId')} required className="sige-input">
              <option value="">— Selecciona un plan —</option>
              {planes.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — S/ {Number(p.precio).toFixed(0)}/mes ({p.maxEstudiantes} alumnos)
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Licencia hasta</label>
          {/* Antes tenía min={hoy}, lo que impedía al SuperAdmin BAJAR la fecha
              (ej. para simular una licencia vencida y probar ese flujo). El
              SuperAdmin debe poder poner cualquier fecha, pasada o futura. */}
          <input type="date" value={form.licenciaFin} onChange={set('licenciaFin')} className="sige-input" />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Puedes poner una fecha pasada para simular una licencia vencida (pruebas).</span>
        </div>

        {!inicial && (
          <div style={{ gridColumn: '1 / -1', background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.generarUsuarios} onChange={set('generarUsuarios')} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Generar automáticamente Administrador, Director, Secretaria y Docente</span>
            </label>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0 1.6rem' }}>
              Se crearán con contraseñas temporales que podrás ver al finalizar y editar después.
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
          Cancelar
        </button>
        <button type="submit" className="btn-accent" disabled={saving || planes.length === 0}>
          {saving
            ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</>
            : <><i className="bi bi-check2 me-1" />{inicial ? 'Actualizar' : 'Crear Colegio'}</>}
        </button>
      </div>
    </form>
  );
}

// ── ID del colegio con botón de copiar ────────────────────────────────────
// Cada colegio tiene un ID único (cuid) — es lo que usarías para conectar
// una app externa/por colegio a la API de SIGE (ej: GET /api/colegios/{id}/...
// o pasándolo como parámetro para que el backend filtre los datos de ESE
// colegio específico).
function IdConCopiar({ id }: { id: string }) {
  const copiar = async () => {
    await navigator.clipboard.writeText(id);
    toast.success('ID copiado');
  };
  return (
    <button onClick={copiar} title="Copiar ID completo"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
      {id.slice(0, 8)}…{id.slice(-4)}
      <i className="bi bi-clipboard" style={{ fontSize: '0.7rem' }} />
    </button>
  );
}
