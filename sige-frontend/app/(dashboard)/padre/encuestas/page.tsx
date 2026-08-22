'use client';
import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useEncuestas, useMutation } from '@/hooks/useApi';
import { useData } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function EncuestasPadrePage() {
  const { data, isLoading, mutate } = useEncuestas('estado=ACTIVA');
  const { loading: saving, mutate: save } = useMutation();
  const [respondiendo, setRespondiendo] = useState<any>(null);
  const encuestas = (data as any)?.data ?? [];

  return (
    <DashboardLayout title="Encuestas" allowedRoles={['PADRE']}>
      {isLoading ? <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div> : (
        encuestas.length === 0 ? (
          <div className="sige-card" style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
            <i className="bi bi-bar-chart" style={{ fontSize:'2.5rem', display:'block', marginBottom:12 }} />Sin encuestas activas
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {encuestas.map((enc: any) => (
              <div key={enc.id} className="sige-card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'0.9rem' }}>{enc.titulo}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:3 }}>
                      {enc._count?.preguntas ?? 0} preguntas {enc.anonima ? '· Anónima' : ''}
                    </div>
                  </div>
                  <button onClick={() => setRespondiendo(enc)} className="btn-accent" style={{ fontSize:'0.82rem', padding:'0.4rem 0.875rem' }}>
                    <i className="bi bi-pencil me-1" />Responder
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
      <AnimatePresence>
        {respondiendo && (
          <ModalRespuesta enc={respondiendo} onCancelar={() => setRespondiendo(null)}
            onEnviar={async (respuestas: any) => {
              await save(async () => {
                await api.post(`/encuestas/${respondiendo.id}/responder`, { respuestas });
                toast.success('Encuesta enviada. ¡Gracias!');
                mutate(); setRespondiendo(null);
              });
            }} saving={saving} />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function ModalRespuesta({ enc, onCancelar, onEnviar, saving }: any) {
  const { data } = useData<any>(`/encuestas/${enc.id}`);
  const preguntas = (data as any)?.data?.preguntas ?? [];
  const [respuestas, setRespuestas] = useState<Record<string,string>>({});
  return (
    <motion.div className="sige-modal-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={e => { if (e.target === e.currentTarget) onCancelar(); }}>
      <motion.div className="sige-modal" style={{ maxWidth:520 }} initial={{ scale:0.94 }} animate={{ scale:1 }} exit={{ scale:0.94 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1.25rem' }}>
          <h2 style={{ fontSize:'1rem', fontWeight:700, margin:0 }}>{enc.titulo}</h2>
          <button type="button" onClick={onCancelar} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'1.1rem' }}><i className="bi bi-x-lg" /></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem', maxHeight:400, overflowY:'auto', marginBottom:'1rem' }}>
          {preguntas.map((p: any, i: number) => (
            <div key={p.id} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'0.875rem' }}>
              <div style={{ fontWeight:600, fontSize:'0.875rem', marginBottom:'0.5rem' }}>{i+1}. {p.pregunta}</div>
              {p.tipo === 'TEXTO' ? (
                <textarea value={respuestas[p.id] ?? ''} onChange={e => setRespuestas(r => ({ ...r, [p.id]: e.target.value }))} className="sige-input" style={{ minHeight:60, resize:'vertical' }} />
              ) : p.tipo === 'ESCALA' ? (
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setRespuestas(r => ({ ...r, [p.id]: String(n) }))}
                      style={{ width:40, height:40, borderRadius:'50%', border:'2px solid', cursor:'pointer', fontWeight:700, fontSize:'0.9rem', borderColor: respuestas[p.id] === String(n) ? 'var(--accent)' : 'var(--border-color)', background: respuestas[p.id] === String(n) ? 'var(--accent)' : 'transparent', color: respuestas[p.id] === String(n) ? '#fff' : 'var(--text-secondary)' }}>
                      {n}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                  {p.opciones.map((op: string) => (
                    <label key={op} style={{ display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer', padding:'0.4rem 0' }}>
                      <input type={p.tipo === 'OPCION_UNICA' ? 'radio' : 'checkbox'} name={p.id} value={op}
                        checked={p.tipo === 'OPCION_UNICA' ? respuestas[p.id] === op : (respuestas[p.id] ?? '').split(',').includes(op)}
                        onChange={e => {
                          if (p.tipo === 'OPCION_UNICA') setRespuestas(r => ({ ...r, [p.id]: op }));
                          else {
                            const actual = (respuestas[p.id] ?? '').split(',').filter(Boolean);
                            setRespuestas(r => ({ ...r, [p.id]: e.target.checked ? [...actual, op].join(',') : actual.filter(a => a !== op).join(',') }));
                          }
                        }} />
                      <span style={{ fontSize:'0.875rem' }}>{op}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
          <button type="button" onClick={onCancelar} style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-color)', borderRadius:8, padding:'0.5rem 1rem', cursor:'pointer', fontSize:'0.875rem', color:'var(--text-primary)' }}>Cancelar</button>
          <button onClick={() => onEnviar(Object.entries(respuestas).map(([preguntaId, valor]) => ({ preguntaId, valor })))} className="btn-accent" disabled={saving}>
            {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-send me-1" />Enviar respuestas</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
