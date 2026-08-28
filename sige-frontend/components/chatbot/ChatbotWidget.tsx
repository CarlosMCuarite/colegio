'use client';
// components/chatbot/ChatbotWidget.tsx
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';

interface Mensaje {
  id: string;
  rol: 'user' | 'bot';
  texto: string;
  tipo?: string;
  ts: Date;
}

type EstadoBot = 'esperando' | 'pensando' | 'respondiendo';

const SUGERENCIAS = [
  '¿Asistió hoy mi hijo?',
  '¿Cuánto debo?',
  '¿Hay clases mañana?',
  '¿Cuál es el horario?',
  '¿Qué eventos hay?',
];

export default function ChatbotWidget() {
  const [open, setOpen]         = useState(false);
  const [input, setInput]       = useState('');
  const [msgs, setMsgs]         = useState<Mensaje[]>([]);
  const [estado, setEstado]     = useState<EstadoBot>('esperando');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        id: '0', rol: 'bot', ts: new Date(),
        texto: '👋 ¡Hola! Soy tu asistente virtual del colegio. ¿En qué puedo ayudarte?',
      }]);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, estado]);

  const enviar = async (texto: string) => {
    if (!texto.trim() || estado === 'pensando') return;
    const userMsg: Mensaje = { id: Date.now().toString(), rol: 'user', texto, ts: new Date() };
    setMsgs(p => [...p, userMsg]);
    setInput('');
    setEstado('pensando');

    try {
      const res = await api.post<{ ok: boolean; respuesta: string; tipo: string }>('/chatbot/consulta', { mensaje: texto });
      setEstado('respondiendo');
      await new Promise(r => setTimeout(r, 200)); // Micro-pausa para el efecto
      setMsgs(p => [...p, {
        id: Date.now().toString() + 'bot',
        rol: 'bot',
        texto: res.data.respuesta,
        tipo: res.data.tipo,
        ts: new Date(),
      }]);
    } catch {
      setMsgs(p => [...p, { id: Date.now().toString() + 'err', rol: 'bot', texto: 'Lo siento, ocurrió un error. Intenta de nuevo.', ts: new Date() }]);
    } finally {
      setEstado('esperando');
    }
  };

  return (
    <div className="chatbot-widget">
      {/* Ventana */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="chatbot-window"
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            {/* Header */}
            <div style={{
              background: 'var(--accent)', padding: '0.875rem 1rem',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <BotAvatar estado={estado} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>Asistente SIGE</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)' }}>
                  {estado === 'esperando' ? '● En línea' : estado === 'pensando' ? '⋯ Pensando...' : '✍ Respondiendo...'}
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '1.1rem' }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* Mensajes */}
            <div style={{ height: 300, overflowY: 'auto', padding: '0.75rem' }}>
              {msgs.map(m => (
                <div key={m.id} style={{
                  display: 'flex', justifyContent: m.rol === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '0.75rem',
                }}>
                  <div style={{
                    maxWidth: '82%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: m.rol === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.rol === 'user' ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: m.rol === 'user' ? '#fff' : 'var(--text-primary)',
                    fontSize: '0.82rem', lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    border: m.rol === 'bot' ? '1px solid var(--border-color)' : 'none',
                  }}>
                    {m.texto}
                  </div>
                </div>
              ))}

              {/* Indicador "pensando" */}
              {(estado === 'pensando' || estado === 'respondiendo') && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{
                    padding: '0.5rem 1rem', borderRadius: '14px 14px 14px 4px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <motion.div key={i}
                          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }}
                          animate={{ y: [0, -5, 0] }}
                          transition={{ repeat: Infinity, duration: 0.7, delay }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Sugerencias rápidas */}
            {msgs.length <= 1 && (
              <div style={{ padding: '0 0.75rem 0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {SUGERENCIAS.map(s => (
                  <button key={s} onClick={() => enviar(s)} style={{
                    background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                    borderRadius: 99, padding: '3px 10px', fontSize: '0.7rem',
                    color: 'var(--accent)', cursor: 'pointer', fontWeight: 500,
                  }}>{s}</button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{
              padding: '0.75rem', borderTop: '1px solid var(--border-color)',
              display: 'flex', gap: '0.5rem',
            }}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enviar(input)}
                placeholder="Escribe tu consulta..."
                className="sige-input"
                style={{ flex: 1 }}
                disabled={estado === 'pensando'}
              />
              <button
                onClick={() => enviar(input)}
                disabled={!input.trim() || estado === 'pensando'}
                className="btn-accent"
                style={{ padding: '0.5rem 0.75rem', flexShrink: 0 }}
              >
                <i className="bi bi-send" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante */}
      <motion.button
        className="chatbot-bubble"
        onClick={() => setOpen(p => !p)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={open ? {} : { boxShadow: ['0 4px 16px rgba(79,70,229,0.4)', '0 4px 32px rgba(79,70,229,0.7)', '0 4px 16px rgba(79,70,229,0.4)'] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.i key="close" className="bi bi-x-lg" style={{ color: '#fff', fontSize: '1.3rem' }}
              initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} />
          ) : (
            <motion.i key="chat" className="bi bi-chat-dots-fill" style={{ color: '#fff', fontSize: '1.3rem' }}
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} />
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

function BotAvatar({ estado }: { estado: EstadoBot }) {
  const icons = { esperando: 'bi-robot', pensando: 'bi-cpu', respondiendo: 'bi-chat-left-dots' };
  return (
    <motion.div
      style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      animate={estado === 'pensando' ? { scale: [1, 1.1, 1] } : {}}
      transition={{ repeat: Infinity, duration: 0.8 }}
    >
      <i className={`bi ${icons[estado]}`} style={{ color: '#fff', fontSize: '1.1rem' }} />
    </motion.div>
  );
}
