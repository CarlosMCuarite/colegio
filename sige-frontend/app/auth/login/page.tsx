'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle, EnvelopeSimple, Eye, EyeSlash, GraduationCap, LockKey, ShieldCheck } from '@phosphor-icons/react';
import { AuthProvider, useAuth } from '../../../lib/auth';
import SigeOwlWave from '../../../components/brand/SigeOwlWave';

function LoginForm() {
  const { login } = useAuth();
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('sige-remember-email');
    if (rememberedEmail) setEmail(rememberedEmail);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    const nextErrors: { email?: string; password?: string } = {};
    const normalizedEmail = email.trim();

    if (!normalizedEmail) nextErrors.email = 'Ingresa tu correo electrónico.';
    else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) nextErrors.email = 'Ingresa un correo electrónico válido.';
    if (!password) nextErrors.password = 'Ingresa tu contraseña.';

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      if (remember) localStorage.setItem('sige-remember-email', normalizedEmail);
      else localStorage.removeItem('sige-remember-email');
      await login(normalizedEmail, password);
    } catch (error: any) {
      const noHayConexion = error?.code === 'ERR_NETWORK' || !error?.response;
      setFormError(noHayConexion
        ? 'No pudimos conectar con el servidor local. Verifica que el backend esté encendido en el puerto 4000.'
        : error?.response?.data?.error ?? 'El correo o la contraseña no coinciden. Revisa los datos e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell auth-shell--immersive" id="main-content">
      <section className="auth-story auth-story--illustrated" aria-label="SIGE, tu colegio inteligente y conectado" />
      <div className="auth-owl-scene" aria-hidden="true">
        <div className="auth-scene-owl auth-scene-owl--studying">
          <Image src="/brand/owl/studying.png" alt="" fill priority sizes="220px" />
        </div>
        <div className="auth-scene-owl auth-scene-owl--celebrating">
          <Image src="/brand/owl/celebrating.png" alt="" fill priority sizes="220px" />
        </div>
        <div className="auth-scene-owl auth-scene-owl--thinking">
          <Image src="/brand/owl/thinking.png" alt="" fill sizes="190px" />
        </div>
        <SigeOwlWave className="auth-scene-owl auth-scene-owl--welcome" />
      </div>

      <section className="auth-access">
        <motion.div className="auth-form-wrap"
          initial={reduceMotion ? false : { opacity: 0.25, scale: 0.975, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}>
          <div className="auth-mobile-brand">
            <span className="auth-brand__mark" aria-hidden="true"><GraduationCap weight="duotone" size={25} /></span>
            <span className="auth-brand__name">SIGE</span>
          </div>
          <div className="auth-form-panel">
            <header className="auth-form-heading">
              <span className="auth-form-mark" aria-hidden="true"><GraduationCap size={32} weight="fill" /></span>
              <h2>Bienvenido a <strong>SIGE</strong></h2>
              <p>Accede con tus credenciales institucionales</p>
            </header>

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-field">
              <label htmlFor="login-email">Correo electrónico</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true"><EnvelopeSimple size={19} /></span>
                <input id="login-email" type="email" value={email} onChange={event => {
                  setEmail(event.target.value);
                  if (fieldErrors.email) setFieldErrors(current => ({ ...current, email: undefined }));
                }} placeholder="usuario@institucion.edu.pe" autoComplete="email" inputMode="email" required
                  aria-invalid={Boolean(fieldErrors.email || formError)}
                  aria-describedby={[fieldErrors.email && 'login-email-error', formError && 'login-form-error'].filter(Boolean).join(' ') || undefined} />
              </div>
              {fieldErrors.email && <p id="login-email-error" className="auth-field-error">{fieldErrors.email}</p>}
            </div>
            <div className="auth-field">
              <label htmlFor="login-password">Contraseña</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true"><LockKey size={19} /></span>
                <input id="login-password" type={showPass ? 'text' : 'password'} value={password}
                  onChange={event => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) setFieldErrors(current => ({ ...current, password: undefined }));
                  }} placeholder="Ingresa tu contraseña" autoComplete="current-password" required
                  aria-invalid={Boolean(fieldErrors.password || formError)}
                  aria-describedby={[fieldErrors.password && 'login-password-error', formError && 'login-form-error'].filter(Boolean).join(' ') || undefined} />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPass(value => !value)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPass}>
                  {showPass ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {fieldErrors.password && <p id="login-password-error" className="auth-field-error">{fieldErrors.password}</p>}
            </div>
            <div className="auth-form-status" aria-live="polite">
              {formError && <p id="login-form-error" className="auth-form-error">{formError}</p>}
            </div>
            <label className="auth-remember">
              <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
              <span>Recordar mi correo en este equipo</span>
            </label>
              <button type="submit" disabled={loading} className="auth-submit">
                <span>{loading ? 'Verificando acceso...' : 'Ingresar al sistema'}</span>
                {!loading && <ArrowRight size={20} weight="bold" aria-hidden="true" />}
              </button>
            </form>
            <Link className="auth-recovery" href="/auth/recuperacion-x7k9">¿Olvidaste tu contraseña?</Link>
            <div className="auth-security">
              <ShieldCheck size={32} weight="duotone" aria-hidden="true" />
              <span><strong>Acceso seguro y protegido</strong><small>Tus datos están protegidos con encriptación de nivel institucional.</small></span>
              <CheckCircle size={22} weight="fill" aria-hidden="true" />
            </div>
          </div>
        </motion.div>

        <footer className="auth-footer">SIGE © {new Date().getFullYear()}. Sistema Integral de Gestión Escolar</footer>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <AuthProvider><LoginForm /></AuthProvider>;
}
