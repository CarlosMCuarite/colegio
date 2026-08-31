'use client';
// components/PerfilYPassword.tsx
// Bloque de "Mi Perfil" + "Contraseña", autocontenido (sin la parte de
// Institución). Lo usan las páginas de Configuración de Secretaría, Docente
// y Padre — roles que solo administran su propia cuenta, no los datos del
// colegio. Admin/Director/SuperAdmin tienen su propia página completa en
// app/(dashboard)/admin/configuracion/page.tsx que sí incluye Institución.
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function PerfilYPassword() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState<'perfil' | 'password'>('perfil');
  const [perfil, setPerfil] = useState({ nombres: '', apellidos: '', telefono: '', email: '', dni: '', direccion: '' });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);
  const [menuAvatar, setMenuAvatar] = useState(false);
  const [viendoAvatar, setViendoAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [pass, setPass] = useState({ actual: '', nueva: '', confirmar: '' });
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  const subirAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Usa una imagen PNG, JPG o WebP.');
      e.target.value = '';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('La imagen debe pesar como máximo 3 MB.');
      e.target.value = '';
      return;
    }
    setMenuAvatar(false);
    setSubiendoAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.post(`/usuarios/${user.id}/avatar`, fd);
      setAvatarUrl(res.data.avatarUrl);
      updateUser({ avatarUrl: res.data.avatarUrl } as any);
      toast.success('Foto de perfil actualizada');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo subir la foto');
    } finally {
      setSubiendoAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const descargarAvatar = async () => {
    if (!avatarUrl) return;
    setMenuAvatar(false);
    try {
      const respuesta = await fetch(avatarUrl);
      if (!respuesta.ok) throw new Error('Imagen no disponible');
      const blob = await respuesta.blob();
      const extension = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      const urlLocal = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = urlLocal;
      enlace.download = `foto-perfil-${perfil.nombres || 'sige'}.${extension}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(urlLocal);
      toast.success('Imagen guardada en tu dispositivo');
    } catch {
      toast.error('No se pudo descargar la imagen. Inténtalo nuevamente.');
    }
  };

  useEffect(() => {
    api.get('/auth/me').then(res => {
      const u = res.data?.data;
      if (u) {
        setPerfil({ nombres: u.nombres ?? '', apellidos: u.apellidos ?? '', telefono: u.telefono ?? '', email: u.email ?? '', dni: u.dni ?? '', direccion: u.direccion ?? '' });
        setAvatarUrl(u.avatarUrl ?? null);
      }
    }).catch(() => {
      if (user) {
        setPerfil({ nombres: user.nombres ?? '', apellidos: user.apellidos ?? '', email: user.email ?? '', telefono: (user as any).telefono ?? '', dni: (user as any).dni ?? '', direccion: (user as any).direccion ?? '' });
        setAvatarUrl((user as any).avatarUrl ?? null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) { toast.error('No se pudo identificar tu sesión. Vuelve a iniciar sesión.'); return; }
    setSavingPerfil(true);
    try {
      await api.patch(`/usuarios/${user.id}`, { nombres: perfil.nombres, apellidos: perfil.apellidos, telefono: perfil.telefono || null, dni: perfil.dni || null, direccion: perfil.direccion || null });
      const fresco = await api.get('/auth/me').then(r => r.data?.data).catch(() => null);
      if (fresco) {
        setPerfil({ nombres: fresco.nombres ?? '', apellidos: fresco.apellidos ?? '', telefono: fresco.telefono ?? '', email: fresco.email ?? '', dni: fresco.dni ?? '', direccion: fresco.direccion ?? '' });
        updateUser({ nombres: fresco.nombres, apellidos: fresco.apellidos, telefono: fresco.telefono });
      } else {
        updateUser({ nombres: perfil.nombres, apellidos: perfil.apellidos, telefono: perfil.telefono });
      }
      toast.success('Perfil actualizado correctamente');
    } catch (err: any) {
      const detalle = err?.response?.data?.detalle;
      const msg = detalle?.length ? detalle.map((d: any) => d.mensaje).join(' · ') : (err?.response?.data?.error ?? 'Error al guardar perfil');
      toast.error(msg);
    } finally { setSavingPerfil(false); }
  };

  const validaciones = [
    { label: 'Al menos 8 caracteres', ok: pass.nueva.length >= 8 },
    { label: 'Una mayúscula',          ok: /[A-Z]/.test(pass.nueva) },
    { label: 'Una minúscula',          ok: /[a-z]/.test(pass.nueva) },
    { label: 'Un número',              ok: /[0-9]/.test(pass.nueva) },
    { label: 'Un símbolo',             ok: /[^A-Za-z0-9]/.test(pass.nueva) },
    { label: 'Distinta a la actual',   ok: pass.nueva.length > 0 && pass.nueva !== pass.actual },
    { label: 'Contraseñas coinciden',  ok: pass.nueva === pass.confirmar && pass.confirmar.length > 0 },
  ];
  const passValida = validaciones.every(v => v.ok) && pass.actual.length > 0;

  const cambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passValida) { toast.error('Completa todos los requisitos'); return; }
    setSavingPass(true);
    try {
      await api.post('/auth/cambiar-password', { passwordActual: pass.actual, password: pass.nueva });
      toast.success('Contraseña cambiada. Inicia sesión nuevamente.');
      setPass({ actual: '', nueva: '', confirmar: '' });
      setTimeout(() => { localStorage.clear(); window.location.href = '/auth/login'; }, 2000);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Error al cambiar contraseña');
    } finally { setSavingPass(false); }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="sige-card" style={{ display: 'flex', padding: 6, marginBottom: '1rem', gap: 4 }}>
        {[{ id: 'perfil', label: 'Mi Perfil', icon: 'bi-person-circle' }, { id: 'password', label: 'Contraseña', icon: 'bi-key' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{
              flex: 1, padding: '0.6rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              background: tab === t.id ? 'var(--accent)' : 'transparent',
              color:      tab === t.id ? '#fff' : 'var(--text-secondary)',
            }}>
            <i className={`bi ${t.icon} me-2`} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'perfil' && (
        <motion.form className="sige-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={guardarPerfil}>
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            <i className="bi bi-person-circle me-2" />Mi Perfil
          </h3>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem', position: 'relative' }}>
            <button type="button" onClick={() => setMenuAvatar(v => !v)} disabled={subiendoAvatar}
              title="Opciones de foto de perfil" aria-haspopup="menu" aria-expanded={menuAvatar}
              style={{
                width: 72, height: 72, borderRadius: '50%', position: 'relative', border: 'none', cursor: 'pointer', padding: 0, overflow: 'hidden',
                background: avatarUrl ? `url(${avatarUrl}) center/cover` : 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, color: '#fff',
              }}>
              {!avatarUrl && `${perfil.nombres?.[0]?.toUpperCase() ?? ''}${perfil.apellidos?.[0]?.toUpperCase() ?? ''}`}
              <span style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-card)' }}>
                {subiendoAvatar ? <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10, borderWidth: 1 }} /> : <i className="bi bi-camera-fill" style={{ fontSize: 10, color: '#fff' }} />}
              </span>
            </button>
            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={subirAvatar} style={{ display: 'none' }} />
            {menuAvatar && (
              <div role="menu" aria-label="Opciones de foto" style={{
                position: 'absolute', top: 82, zIndex: 20, minWidth: 176, padding: 6,
                border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-card)',
                boxShadow: '0 16px 40px rgba(15,45,42,.14)',
              }}>
                <button type="button" role="menuitem" disabled={!avatarUrl} onClick={() => { setMenuAvatar(false); setViendoAvatar(true); }}
                  style={{ width: '100%', minHeight: 42, padding: '8px 10px', border: 'none', borderRadius: 8, background: 'transparent', color: avatarUrl ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'left', cursor: avatarUrl ? 'pointer' : 'not-allowed', fontSize: '.82rem' }}>
                  <i className="bi bi-arrows-fullscreen me-2" />Ver imagen
                </button>
                <button type="button" role="menuitem" onClick={() => avatarInputRef.current?.click()}
                  style={{ width: '100%', minHeight: 42, padding: '8px 10px', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--accent)', textAlign: 'left', cursor: 'pointer', fontSize: '.82rem', fontWeight: 650 }}>
                  <i className="bi bi-camera me-2" />{avatarUrl ? 'Cambiar imagen' : 'Subir imagen'}
                </button>
                <button type="button" role="menuitem" disabled={!avatarUrl} onClick={descargarAvatar}
                  style={{ width: '100%', minHeight: 42, padding: '8px 10px', border: 'none', borderRadius: 8, background: 'transparent', color: avatarUrl ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'left', cursor: avatarUrl ? 'pointer' : 'not-allowed', fontSize: '.82rem' }}>
                  <i className="bi bi-download me-2" />Descargar imagen
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Nombres</label><input type="text" value={perfil.nombres} onChange={e => setPerfil(p => ({ ...p, nombres: e.target.value }))} className="sige-input" required /></div>
              <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Apellidos</label><input type="text" value={perfil.apellidos} onChange={e => setPerfil(p => ({ ...p, apellidos: e.target.value }))} className="sige-input" required /></div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Email <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(solo lectura)</span></label>
              <input value={perfil.email} disabled className="sige-input" style={{ opacity: 0.6 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>DNI</label>
                <input type="text" value={perfil.dni} onChange={e => setPerfil(p => ({ ...p, dni: e.target.value }))} className="sige-input" placeholder="12345678" maxLength={8} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Teléfono</label>
                <input type="tel" value={perfil.telefono} onChange={e => setPerfil(p => ({ ...p, telefono: e.target.value }))} className="sige-input" placeholder="+51 999 999 999" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Dirección</label>
              <input type="text" value={perfil.direccion} onChange={e => setPerfil(p => ({ ...p, direccion: e.target.value }))} className="sige-input" placeholder="Av. Los Jardines 123, Huánuco" />
            </div>
          </div>
          <button type="submit" className="btn-accent" disabled={savingPerfil} style={{ marginTop: '1.25rem', width: '100%', justifyContent: 'center', padding: '0.6rem' }}>
            {savingPerfil ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</> : <><i className="bi bi-check2 me-1" />Guardar perfil</>}
          </button>
        </motion.form>
      )}

      {viendoAvatar && avatarUrl && (
        <div role="dialog" aria-modal="true" aria-label="Foto de perfil" onClick={() => setViendoAvatar(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', padding: 24, background: 'rgba(8,25,23,.72)', backdropFilter: 'blur(6px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: 'min(92vw, 620px)', maxHeight: '86vh', padding: 12, borderRadius: 16, background: 'var(--bg-card)', boxShadow: '0 24px 72px rgba(0,0,0,.28)' }}>
            <img src={avatarUrl} alt={`Foto de perfil de ${perfil.nombres} ${perfil.apellidos}`}
              style={{ display: 'block', width: '100%', maxHeight: 'calc(86vh - 24px)', objectFit: 'contain', borderRadius: 10, background: 'var(--bg-secondary)' }} />
            <button type="button" onClick={() => setViendoAvatar(false)} aria-label="Cerrar imagen"
              style={{ position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,.3)', background: 'rgba(8,25,23,.78)', color: '#fff', cursor: 'pointer' }}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <motion.form className="sige-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={cambiarPassword}>
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            <i className="bi bi-key me-2" />Cambiar contraseña
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {[
              { label: 'Contraseña actual *',    key: 'actual',    show: showActual,    setShow: setShowActual    },
              { label: 'Nueva contraseña *',     key: 'nueva',     show: showNueva,     setShow: setShowNueva     },
              { label: 'Confirmar contraseña *', key: 'confirmar', show: showConfirmar, setShow: setShowConfirmar },
            ].map(({ label, key, show, setShow }) => (
              <div key={key}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
                <div style={{ position: 'relative' }}>
                  <input type={show ? 'text' : 'password'} value={(pass as any)[key]}
                    onChange={e => setPass(p => ({ ...p, [key]: e.target.value }))}
                    required className="sige-input" style={{ paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => setShow((s: boolean) => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <i className={`bi ${show ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>
              </div>
            ))}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.875rem' }}>
              {validaciones.map(v => (
                <div key={v.label} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.78rem' }}>
                  <i className={`bi ${v.ok ? 'bi-check-circle-fill' : 'bi-circle'}`} style={{ color: v.ok ? '#10b981' : 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ color: v.ok ? 'var(--text-primary)' : 'var(--text-muted)' }}>{v.label}</span>
                </div>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-accent" disabled={savingPass || !passValida}
            style={{ marginTop: '1.25rem', width: '100%', justifyContent: 'center', padding: '0.6rem', opacity: !passValida ? 0.5 : 1 }}>
            {savingPass ? <><span className="spinner-border spinner-border-sm me-1" />Cambiando...</> : <><i className="bi bi-key me-1" />Cambiar contraseña</>}
          </button>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>
            <i className="bi bi-info-circle me-1" />Al cambiar la contraseña se cerrarán todas las sesiones activas.
          </p>
        </motion.form>
      )}
    </div>
  );
}
