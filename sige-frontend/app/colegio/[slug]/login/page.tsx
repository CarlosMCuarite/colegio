'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AuthProvider, useAuth } from '../../../../lib/auth';
import api from '../../../../lib/api';

function LoginColegioForm({ slug }: { slug: string }) {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [colegio, setColegio]   = useState<any>(null);
  const [loadingColegio, setLoadingColegio] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/public/colegio/${slug}/check`)
      .then(res => {
        if (!res.data?.existe) { setNotFound(true); return; }
        setColegio(res.data.data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingColegio(false));
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Guarda el colegioId esperado para que el primer fetch ya mande el header correcto
      if (colegio?.id) localStorage.setItem('sige-colegio-id', colegio.id);
      await login(email, password);
    } finally { setLoading(false); }
  };

  if (loadingColegio) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', textAlign: 'center', padding: '2rem' }}>
      <i className="bi bi-building-x" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: 12 }} />
      <h2 style={{ fontWeight: 700, marginBottom: 4 }}>Colegio no encontrado</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Verifica la dirección e intenta nuevamente.</p>
    </div>
  );

  const primario = colegio?.colorPrimario || '#4f46e5';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ width: '100%', maxWidth: 420 }}>
        <div className="sige-card" style={{ padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            {colegio?.logoUrl ? (
              <img src={colegio.logoUrl} alt={colegio.nombre} style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', margin: '0 auto 1rem', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }} />
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: 14, background: primario, margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(79,70,229,0.3)' }}>
                <i className="bi bi-mortarboard" style={{ color: '#fff', fontSize: '1.8rem' }} />
              </div>
            )}
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
              {colegio?.nombre ?? 'Sistema Escolar'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Ingresa con tus credenciales institucionales</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Correo electrónico</label>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-envelope" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="sige-input" style={{ paddingLeft: '2.25rem' }} placeholder="usuario@institucion.edu.pe" required />
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-lock" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="sige-input" style={{ paddingLeft: '2.25rem', paddingRight: '2.5rem' }} placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-accent" style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', fontSize: '0.9rem', background: primario }}>
              {loading ? <><span className="spinner-border spinner-border-sm me-2" />Ingresando...</> : <><i className="bi bi-box-arrow-in-right me-1" />Ingresar</>}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
          {colegio?.nombre ?? 'SIGE'} © {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginColegioPage() {
  const { slug } = useParams<{ slug: string }>();
  return <AuthProvider><LoginColegioForm slug={slug} /></AuthProvider>;
}
