'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Books, ChartLineUp, Eye, EyeSlash, GraduationCap, LockKey, Moon, Sun, UsersThree } from '@phosphor-icons/react';
import { AuthProvider, useAuth } from '../../../lib/auth';
import { useTheme } from '../../../components/layout/ThemeProvider';

const pilares = [
  { icon: Books, label: 'Gestión académica' },
  { icon: UsersThree, label: 'Comunidad conectada' },
  { icon: ChartLineUp, label: 'Decisiones con información' },
];

function LoginForm() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

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
      await login(normalizedEmail, password);
    } catch {
      setFormError('No pudimos iniciar sesión. Revisa tus datos e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell" id="main-content">
      <section className="auth-story" aria-label="Presentación de SIGE">
        <div className="auth-story__glow" aria-hidden="true" />
        <div className="auth-brand">
          <span className="auth-brand__mark" aria-hidden="true"><GraduationCap weight="duotone" size={28} /></span>
          <span className="auth-brand__name">SIGE</span>
        </div>
        <div className="auth-story__content">
          <h1>Toda la gestión escolar, en un solo lugar.</h1>
          <p>Organiza el trabajo diario del colegio y mantén a cada familia cerca de lo que importa.</p>
        </div>
        <div className="auth-pillars" aria-label="Áreas principales del sistema">
          {pilares.map(({ icon: Icon, label }) => (
            <div className="auth-pillar" key={label}>
              <Icon size={20} weight="duotone" aria-hidden="true" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="auth-access">
        <button type="button" className="auth-theme-toggle" onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <motion.div className="auth-form-wrap"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}>
          <div className="auth-mobile-brand">
            <span className="auth-brand__mark" aria-hidden="true"><GraduationCap weight="duotone" size={25} /></span>
            <span className="auth-brand__name">SIGE</span>
          </div>
          <header className="auth-form-heading">
            <h2>Bienvenido de nuevo</h2>
            <p>Accede con tus credenciales institucionales.</p>
          </header>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-field">
              <label htmlFor="login-email">Correo electrónico</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true"><UsersThree size={19} /></span>
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
            <button type="submit" disabled={loading} className="auth-submit">
              <span>{loading ? 'Verificando acceso...' : 'Ingresar al sistema'}</span>
              {!loading && <ArrowRight size={20} weight="bold" aria-hidden="true" />}
            </button>
          </form>
          <p className="auth-support">Si tienes problemas para ingresar, comunícate con la administración de tu colegio.</p>
        </motion.div>

        <footer className="auth-footer">SIGE © {new Date().getFullYear()}. Sistema Integral de Gestión Escolar</footer>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <AuthProvider><LoginForm /></AuthProvider>;
}
