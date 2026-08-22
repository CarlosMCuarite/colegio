'use client';
// Ruta de emergencia — no está enlazada desde ningún menú ni botón del sistema.
// Sirve para restaurar la contraseña de una cuenta ADMINISTRADOR/SUPERADMIN
// cuando nadie puede entrar al panel para hacerlo por la vía normal.
// Se accede escribiendo la URL directamente: /auth/recuperacion-x7k9
import { useState } from 'react';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function RecuperacionSuperAdminPage() {
  const [email, setEmail]                 = useState('');
  const [codigo, setCodigo]                = useState('');
  const [nuevaPassword, setNuevaPassword]  = useState('');
  const [confirmar, setConfirmar]          = useState('');
  const [showPass, setShowPass]            = useState(false);
  const [loading, setLoading]              = useState(false);
  const [mensaje, setMensaje]              = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    if (nuevaPassword !== confirmar) {
      setMensaje({ tipo: 'error', texto: 'Las contraseñas no coinciden' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/recuperacion-superadmin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo, nuevaPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detalle = data?.detalle as { campo: string; mensaje: string }[] | undefined;
        const msg = detalle?.length ? detalle.map(d => d.mensaje).join(' · ') : (data?.error || 'No se pudo restaurar la contraseña');
        throw new Error(msg);
      }

      setMensaje({ tipo: 'ok', texto: data?.mensaje || 'Contraseña restaurada. Ya puedes iniciar sesión.' });
      setEmail(''); setCodigo(''); setNuevaPassword(''); setConfirmar('');
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al restaurar la contraseña' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary, #f3f4f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '2.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#111827', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="bi bi-shield-lock" style={{ color: '#fff', fontSize: '1.6rem' }} />
            </div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', marginBottom: 6 }}>Recuperación de SuperAdmin</h1>
            <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: 0 }}>
              Solo para la cuenta SUPERADMIN. Requiere el código de recuperación exclusivo de SuperAdmin.
            </p>
          </div>

          <form onSubmit={submit}>
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Correo del administrador</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="superadmin@sige.pe"
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.875rem' }} />
            </div>

            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Código de recuperación</label>
              <input type="password" required value={codigo} onChange={e => setCodigo(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.875rem' }} />
            </div>

            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Nueva contraseña</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} required value={nuevaPassword} onChange={e => setNuevaPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo"
                  style={{ width: '100%', padding: '0.55rem 2.2rem 0.55rem 0.75rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.875rem' }} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                  <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
              <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '4px 0 0' }}>
                Debe incluir mayúscula, minúscula, número y símbolo (ej: Carce2402<b>!</b>)
              </p>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Confirmar contraseña</label>
              <input type={showPass ? 'text' : 'password'} required value={confirmar} onChange={e => setConfirmar(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.875rem' }} />
            </div>

            {mensaje && (
              <div style={{
                marginBottom: '1rem', padding: '0.6rem 0.8rem', borderRadius: 8, fontSize: '0.8rem',
                background: mensaje.tipo === 'ok' ? '#dcfce7' : '#fee2e2',
                color: mensaje.tipo === 'ok' ? '#166534' : '#991b1b',
              }}>
                {mensaje.texto}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Restaurando...' : 'Restaurar contraseña'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <a href="/auth/login" style={{ fontSize: '0.78rem', color: '#6b7280', textDecoration: 'none' }}>← Volver al inicio de sesión</a>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
