'use client';
// components/ChatDirecto.tsx
// Chat directo tipo WhatsApp entre Padre y Docente, con contexto por
// estudiante. Sin WebSockets — usa polling (refresco automático) mientras
// la conversación está abierta, que es suficiente para el volumen de
// mensajes de un colegio y no requiere infraestructura nueva.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useData, useMutation } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ChatDirecto() {
  const { user } = useAuth();
  const soyPadre = user?.rol === 'PADRE';
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [showContactos, setShowContactos] = useState(false);
  const [vistaMobile, setVistaMobile] = useState<'lista' | 'chat'>('lista');

  const { data: convData, mutate: refrescarLista } = useData<any>('/chat/conversaciones', { refreshInterval: 8000 });
  const conversaciones = convData?.data ?? [];

  const abrirConversacion = (id: string) => {
    setConversacionId(id);
    setVistaMobile('chat');
  };

  const { mutate: crearConv } = useMutation();
  const iniciarChat = async (usuarioId: string, estudianteId: string) => {
    await crearConv(async () => {
      const res = await api.post('/chat/conversaciones', { usuarioId, estudianteId });
      setShowContactos(false);
      refrescarLista();
      abrirConversacion(res.data.data.id);
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', height: 'calc(100vh - 160px)', minHeight: 480 }} className="sige-chat-grid">
      {/* Lista de conversaciones */}
      <div className="sige-card" style={{ padding: 0, overflow: 'hidden', display: vistaMobile === 'chat' ? 'none' : 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0.875rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Mensajes</span>
          <button onClick={() => setShowContactos(true)} className="btn-accent" style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>
            <i className="bi bi-pencil-square me-1" />Nuevo
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {conversaciones.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Sin conversaciones todavía. Toca "Nuevo" para escribirle a {soyPadre ? 'un docente' : 'un padre de familia'}.
            </div>
          ) : conversaciones.map((c: any) => {
            const otro = soyPadre ? c.docenteUsuario : c.padreUsuario;
            const noLeidos = c._count?.mensajes ?? 0;
            return (
              <button key={c.id} onClick={() => abrirConversacion(c.id)}
                style={{ width: '100%', textAlign: 'left', background: conversacionId === c.id ? 'var(--bg-secondary)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0.875rem', cursor: 'pointer', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                {otro.avatarUrl
                  ? <img src={otro.avatarUrl} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{otro.nombres?.[0]}{otro.apellidos?.[0]}</div>}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{otro.nombres} {otro.apellidos}</span>
                    {noLeidos > 0 && <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', flexShrink: 0 }}>{noLeidos}</span>}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sobre {c.estudiante.nombres}</div>
                  {c.ultimoMensajeTexto && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.ultimoMensajeTexto}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hilo de mensajes */}
      <div className="sige-card" style={{ padding: 0, overflow: 'hidden', display: vistaMobile === 'lista' ? 'none' : 'flex', flexDirection: 'column' }}>
        {conversacionId ? (
          <HiloMensajes conversacionId={conversacionId} conversaciones={conversaciones} soyPadre={soyPadre} userId={user?.id}
            onVolver={() => setVistaMobile('lista')} onEnviado={refrescarLista} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', flexDirection: 'column', gap: 8 }}>
            <i className="bi bi-chat-dots" style={{ fontSize: '2.5rem' }} />
            <span style={{ fontSize: '0.85rem' }}>Selecciona una conversación</span>
          </div>
        )}
      </div>

      {showContactos && <ModalContactos soyPadre={soyPadre} onElegir={iniciarChat} onCerrar={() => setShowContactos(false)} />}
    </div>
  );
}

function HiloMensajes({ conversacionId, conversaciones, soyPadre, userId, onVolver, onEnviado }: any) {
  const conv = conversaciones.find((c: any) => c.id === conversacionId);
  const otro = conv ? (soyPadre ? conv.docenteUsuario : conv.padreUsuario) : null;
  const { data, mutate } = useData<any>(`/chat/conversaciones/${conversacionId}/mensajes`, { refreshInterval: 4000 });
  const mensajes = data?.data ?? [];
  const { mutate: enviar, loading: enviando } = useMutation();
  const [texto, setTexto] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [mensajes.length]);
  // BUG REAL encontrado: esto solo marcaba como leído al ABRIR la
  // conversación — si llegaban mensajes nuevos mientras ya la tenías
  // abierta (el polling los trae cada 4s), se quedaban marcados como no
  // leídos hasta que salías y volvías a entrar. Ahora también reacciona
  // cuando cambia la cantidad de mensajes, no solo al abrir.
  useEffect(() => {
    if (!mensajes.length) return;
    api.patch(`/chat/conversaciones/${conversacionId}/leido`).then(() => onEnviado?.()).catch(() => {});
  }, [conversacionId, mensajes.length]);

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    const contenido = texto.trim();
    if (!contenido) return;
    setTexto('');
    await enviar(async () => {
      await api.post(`/chat/conversaciones/${conversacionId}/mensajes`, { contenido });
      mutate();
      onEnviado?.();
    }, { errorMsg: 'No se pudo enviar el mensaje' });
  };

  return (
    <>
      <div style={{ padding: '0.75rem 0.875rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button onClick={onVolver} className="sige-chat-volver" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'none' }}><i className="bi bi-arrow-left" /></button>
        {otro?.avatarUrl
          ? <img src={otro.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
          : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--accent)', fontSize: '0.75rem' }}>{otro?.nombres?.[0]}{otro?.apellidos?.[0]}</div>}
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{otro?.nombres} {otro?.apellidos}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sobre {conv?.estudiante?.nombres} {conv?.estudiante?.apellidos}</div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-secondary)' }}>
        {mensajes.map((m: any) => {
          const esMio = m.autorId === userId;
          return (
            <div key={m.id} style={{ alignSelf: esMio ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
              <div style={{ background: esMio ? 'var(--accent)' : 'var(--bg-card)', color: esMio ? '#fff' : 'var(--text-primary)', borderRadius: 14, padding: '0.5rem 0.8rem', fontSize: '0.85rem', wordBreak: 'break-word' }}>
                {m.contenido}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: esMio ? 'right' : 'left', marginTop: 2 }}>
                {new Date(m.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={enviarMensaje} style={{ padding: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem' }}>
        <input type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe un mensaje..." className="sige-input" style={{ flex: 1 }} maxLength={2000} />
        <button type="submit" className="btn-accent" disabled={enviando || !texto.trim()} style={{ width: 42, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="bi bi-send" />
        </button>
      </form>
    </>
  );
}

function ModalContactos({ soyPadre, onElegir, onCerrar }: any) {
  const { data, isLoading } = useData<any>('/chat/contactos');
  const contactos = data?.data ?? [];
  return (
    <div className="sige-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="sige-modal" style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{soyPadre ? 'Escribir a un docente' : 'Escribir a un padre'}</h2>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
        </div>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner-border spinner-border-sm" /></div>
        ) : contactos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {soyPadre ? 'Todavía no hay docentes asignados al aula de tu(s) hijo(s).' : 'Todavía no tienes padres de familia disponibles para escribir.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 360, overflowY: 'auto' }}>
            {contactos.map((c: any, i: number) => (
              <button key={i} onClick={() => onElegir(c.usuario.id, c.estudiante.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left' }}>
                {c.usuario.avatarUrl
                  ? <img src={c.usuario.avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--accent)', fontSize: '0.8rem' }}>{c.usuario.nombres?.[0]}{c.usuario.apellidos?.[0]}</div>}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.usuario.nombres} {c.usuario.apellidos}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sobre {c.estudiante.nombres} {c.estudiante.apellidos}{c.esTutor ? ' · Tutor(a)' : ''}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
