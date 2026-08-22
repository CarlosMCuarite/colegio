'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useTheme } from '@/components/layout/ThemeProvider';

function LoginForm() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await login(email, password); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <button onClick={toggleTheme}
        style={{ position:'fixed', top:16, right:16, background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:8, padding:'0.4rem 0.7rem', cursor:'pointer', color:'var(--text-secondary)' }}>
        <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon'}`} />
      </button>

      <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }} style={{ width:'100%', maxWidth:420 }}>
        <div className="sige-card" style={{ padding:'2.5rem' }}>
          {/* Logo dinámico */}
          <div style={{ textAlign:'center', marginBottom:'2rem' }}>
            <div style={{ width:60, height:60, borderRadius:14, background:'var(--accent)', margin:'0 auto 1rem', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(79,70,229,0.3)' }}>
              <i className="bi bi-mortarboard" style={{ color:'#fff', fontSize:'1.8rem' }} />
            </div>
            <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--text-primary)', marginBottom:6 }}>
              Sistema de Gestión Escolar
            </h1>
            <p style={{ color:'var(--text-muted)', fontSize:'0.875rem', margin:0 }}>
              Ingresa con tus credenciales institucionales
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:'1rem' }}>
              <label style={{ display:'block', fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>
                Correo electrónico
              </label>
              <div style={{ position:'relative' }}>
                <i className="bi bi-envelope" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="sige-input"
                  style={{ paddingLeft:'2.25rem' }} placeholder="usuario@institucion.edu.pe" required />
              </div>
            </div>

            <div style={{ marginBottom:'1.5rem' }}>
              <label style={{ display:'block', fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>
                Contraseña
              </label>
              <div style={{ position:'relative' }}>
                <i className="bi bi-lock" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="sige-input" style={{ paddingLeft:'2.25rem', paddingRight:'2.5rem' }} placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
                  <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-accent"
              style={{ width:'100%', justifyContent:'center', padding:'0.65rem', fontSize:'0.9rem' }}>
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2" />Ingresando...</>
                : <><i className="bi bi-box-arrow-in-right me-1" />Ingresar al sistema</>}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', marginTop:'1rem', color:'var(--text-muted)', fontSize:'0.72rem' }}>
          SIGE © {new Date().getFullYear()} — Sistema Integral de Gestión Escolar
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return <AuthProvider><LoginForm /></AuthProvider>;
}
