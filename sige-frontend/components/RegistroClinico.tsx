'use client';
// components/RegistroClinico.tsx
//
// Reutilizado por Enfermería (tipo=SALUD) y Psicología (tipo=PSICOLOGICA).
// Reusa el modelo Observacion que ya existía (misma tabla, con un `tipo`
// distinto) — así el padre ya puede ver estos registros de su hijo en
// "Observaciones" sin tener que construir nada nuevo ahí, y Enfermería o
// Psicología tienen su propia pantalla dedicada con su propio vocabulario
// (motivo/atención en vez de "descripción/acción tomada" genérico).
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData, useMutation } from '../hooks/useApi';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface Props {
  tipo: 'SALUD' | 'PSICOLOGICA';
  titulo: string;
  icono: string;
  colorAcento: string;
  labelMotivo: string;
  labelAtencion: string;
  placeholderMotivo: string;
  placeholderAtencion: string;
}

export default function RegistroClinico({ tipo, titulo, icono, colorAcento, labelMotivo, labelAtencion, placeholderMotivo, placeholderAtencion }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const { data, isLoading, mutate } = useData<any>(`/observaciones?tipo=${tipo}&limit=100`);
  const { mutate: crear, loading: guardando } = useMutation();
  const registros: any[] = data?.data ?? [];

  const filtrados = busqueda
    ? registros.filter(r => `${r.estudiante?.nombres} ${r.estudiante?.apellidos}`.toLowerCase().includes(busqueda.toLowerCase()))
    : registros;

  const guardar = async (payload: any) => {
    await crear(async () => {
      await api.post('/observaciones', { ...payload, tipo });
      toast.success('Registro guardado');
      mutate();
      setShowModal(false);
    });
  };

  const hoy = new Date().toDateString();
  const atendidosHoy = registros.filter(r => new Date(r.fecha).toDateString() === hoy).length;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="sige-card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: colorAcento }}>{atendidosHoy}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Atendidos hoy</div>
        </div>
        <div className="sige-card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: colorAcento }}>{registros.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Registros totales</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Buscar estudiante..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="sige-input" style={{ maxWidth: 280 }} />
        <button className="btn-accent" onClick={() => setShowModal(true)} style={{ marginLeft: 'auto' }}>
          <i className={`bi ${icono} me-1`} />Nuevo registro
        </button>
      </div>

      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className={`bi ${icono}`} style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
            Sin registros todavía
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtrados.map((r: any) => (
              <div key={r.id} style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                {r.estudiante?.fotoUrl
                  ? <img src={r.estudiante.fotoUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>{r.estudiante?.nombres?.[0]}{r.estudiante?.apellidos?.[0]}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.estudiante?.nombres} {r.estudiante?.apellidos}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(r.fecha).toLocaleString('es-PE')}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 3 }}>{r.descripcion}</div>
                  {r.accionTomada && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}><strong>{labelAtencion}:</strong> {r.accionTomada}</div>}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>Registrado por {r.creadoPor?.nombres} {r.creadoPor?.apellidos}{r.notificadoPadre && ' · Padre notificado'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div className="sige-modal" initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <FormularioRegistro titulo={titulo} labelMotivo={labelMotivo} labelAtencion={labelAtencion}
                placeholderMotivo={placeholderMotivo} placeholderAtencion={placeholderAtencion}
                onGuardar={guardar} onCancelar={() => setShowModal(false)} saving={guardando} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FormularioRegistro({ titulo, labelMotivo, labelAtencion, placeholderMotivo, placeholderAtencion, onGuardar, onCancelar, saving }: any) {
  const [dni, setDni] = useState('');
  const [estudiante, setEstudiante] = useState<any>(null);
  const [buscando, setBuscando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [atencion, setAtencion] = useState('');
  const [notificar, setNotificar] = useState(true);

  const buscar = async () => {
    setBuscando(true);
    try {
      const res = await api.get(`/estudiantes?q=${dni}&limit=1`);
      const est = res.data.data?.[0];
      if (est) setEstudiante(est);
      else toast.error('Estudiante no encontrado');
    } finally { setBuscando(false); }
  };

  return (
    <form onSubmit={e => {
      e.preventDefault();
      if (!estudiante) { toast.error('Busca al estudiante primero'); return; }
      if (motivo.trim().length < 5) { toast.error(`Describe ${labelMotivo.toLowerCase()} (mínimo 5 caracteres)`); return; }
      onGuardar({ estudianteId: estudiante.id, descripcion: motivo, accionTomada: atencion || undefined, notificarPadre: notificar });
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{titulo}</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>DNI del Estudiante *</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="text" value={dni} onChange={e => setDni(e.target.value)} className="sige-input" placeholder="DNI" />
            <button type="button" onClick={buscar} className="btn-accent" disabled={buscando} style={{ flexShrink: 0 }}>
              {buscando ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-search" />}
            </button>
          </div>
          {estudiante && <div style={{ marginTop: 6, fontSize: '0.82rem', fontWeight: 600, color: '#10b981' }}><i className="bi bi-check-circle me-1" />{estudiante.nombres} {estudiante.apellidos}</div>}
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{labelMotivo} *</label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} required className="sige-input" style={{ minHeight: 70, resize: 'vertical' }} placeholder={placeholderMotivo} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{labelAtencion}</label>
          <textarea value={atencion} onChange={e => setAtencion(e.target.value)} className="sige-input" style={{ minHeight: 60, resize: 'vertical' }} placeholder={placeholderAtencion} />
        </div>
        <label className="sige-check"><input type="checkbox" checked={notificar} onChange={e => setNotificar(e.target.checked)} /> Notificar al padre</label>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save me-1" />Guardar</>}
        </button>
      </div>
    </form>
  );
}
