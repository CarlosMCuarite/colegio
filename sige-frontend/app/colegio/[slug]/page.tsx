'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import api from '@/lib/api';

export default function PortalColegioPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [colegio, setColegio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    api.get(`/public/colegio/${slug}`)
      .then(res => setColegio(res.data?.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #4f46e5', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !colegio) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff', textAlign: 'center', padding: '2rem' }}>
      <i className="bi bi-building-x" style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.5 }} />
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>Portal no disponible</h1>
      <p style={{ color: '#94a3b8' }}>No encontramos un colegio con esta dirección.</p>
    </div>
  );

  const primario   = colegio.colorPrimario   || '#4f46e5';
  const secundario = colegio.colorSecundario || '#7c3aed';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#fff' }}>
      {/* Hero */}
      <div style={{
        position: 'relative', minHeight: 420, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '3rem 1.5rem',
        background: colegio.imagenPortada
          ? `linear-gradient(rgba(10,14,26,0.75), rgba(10,14,26,0.92)), url(${colegio.imagenPortada}) center/cover`
          : `linear-gradient(135deg, ${primario}, ${secundario})`,
      }}>
        {colegio.logoUrl ? (
          <img src={colegio.logoUrl} alt={colegio.nombre} style={{ width: 88, height: 88, borderRadius: 18, objectFit: 'cover', marginBottom: '1.25rem', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} />
        ) : (
          <div style={{ width: 88, height: 88, borderRadius: 18, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <i className="bi bi-mortarboard" style={{ fontSize: '2.2rem' }} />
          </div>
        )}
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>
          {colegio.nombre}
        </motion.h1>
        {(colegio.distrito || colegio.departamento) && (
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
            <i className="bi bi-geo-alt me-1" />{colegio.distrito}{colegio.departamento ? `, ${colegio.departamento}` : ''}
          </p>
        )}
        <button
          onClick={() => router.push(`/colegio/${slug}/login`)}
          style={{
            background: '#fff', color: primario, border: 'none', borderRadius: 10,
            padding: '0.75rem 2rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}>
          Ingresar al Sistema <i className="bi bi-arrow-right ms-1" />
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '3rem 1.5rem' }}>

        {/* Misión / Visión / Historia */}
        {(colegio.mision || colegio.vision || colegio.historia) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
            {colegio.historia && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                <i className="bi bi-clock-history" style={{ fontSize: '1.4rem', color: primario, marginBottom: 10, display: 'block' }} />
                <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Nuestra Historia</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.6 }}>{colegio.historia}</p>
              </div>
            )}
            {colegio.mision && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                <i className="bi bi-bullseye" style={{ fontSize: '1.4rem', color: primario, marginBottom: 10, display: 'block' }} />
                <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Misión</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.6 }}>{colegio.mision}</p>
              </div>
            )}
            {colegio.vision && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                <i className="bi bi-eye" style={{ fontSize: '1.4rem', color: primario, marginBottom: 10, display: 'block' }} />
                <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Visión</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.6 }}>{colegio.vision}</p>
              </div>
            )}
          </div>
        )}

        {/* Eventos próximos */}
        {(colegio.eventosProximos ?? []).length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}><i className="bi bi-calendar-event me-2" />Próximos eventos</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {colegio.eventosProximos.map((ev: any) => (
                <div key={ev.id} style={{ display: 'flex', gap: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '0.875rem 1.25rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ minWidth: 50, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: primario, fontWeight: 700, textTransform: 'uppercase' }}>{new Date(ev.fechaInicio).toLocaleString('es-PE', { month: 'short' })}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{new Date(ev.fechaInicio).getDate()}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ev.titulo}</div>
                    {ev.lugar && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}><i className="bi bi-geo-alt me-1" />{ev.lugar}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Galería */}
        {(colegio.galeria ?? []).length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}><i className="bi bi-images me-2" />Galería</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {colegio.galeria.map((url: string, i: number) => (
                <img key={i} src={url} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10 }} />
              ))}
            </div>
          </div>
        )}

        {/* Contacto */}
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}>Contacto</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
            {colegio.direccion && <div><i className="bi bi-geo-alt me-2" style={{ color: primario }} />{colegio.direccion}</div>}
            {colegio.telefono  && <div><i className="bi bi-telephone me-2" style={{ color: primario }} />{colegio.telefono}</div>}
            {colegio.email     && <div><i className="bi bi-envelope me-2" style={{ color: primario }} />{colegio.email}</div>}
            {colegio.whatsappNumero && (
              <a href={`https://wa.me/${colegio.whatsappNumero}`} target="_blank" rel="noreferrer" style={{ color: '#25D366', textDecoration: 'none' }}>
                <i className="bi bi-whatsapp me-2" />Escribir por WhatsApp{colegio.whatsappHorario ? ` (${colegio.whatsappHorario})` : ''}
              </a>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '3rem', color: '#475569', fontSize: '0.72rem' }}>
          Sistema de Gestión Escolar — {colegio.nombre} © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
