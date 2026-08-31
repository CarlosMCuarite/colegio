'use client';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import PerfilYPassword from '../../../../components/PerfilYPassword';
import { QrUploader } from '../../../../components/QrUploader';
import { useData, useMutation } from '../../../../hooks/useApi';
import { useAuth } from '../../../../lib/auth';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

export default function ConfiguracionAdminPage() {
  const { user, updateUser } = useAuth();
  const { data: colegioData, mutate: mutateColegio } = useData<any>('/colegios');
  const { loading: saving, mutate: save } = useMutation();
  // Esta página es exclusiva de los roles que administran el colegio; los
  // demás roles (Secretaría, Docente, Padre) tienen su propia página de
  // Configuración simple (solo Mi Perfil + Contraseña) — ver
  // components/PerfilYPassword.tsx.
  const puedeEditarColegio = true;
  const [tabActiva, setTabActiva] = useState<'colegio'|'cuenta'>('colegio');
  const [loadingLogo, setLoadingLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  const colegio = (colegioData as any)?.data ?? null;

  const [formColegio, setFormColegio] = useState<any>(null);

  // Cargar datos del colegio
  useEffect(() => {
    if (colegio && !formColegio) {
      setFormColegio({
        nombre:          colegio.nombre          ?? '',
        nombreCorto:     colegio.nombreCorto     ?? '',
        direccion:       colegio.direccion       ?? '',
        distrito:        colegio.distrito        ?? '',
        provincia:       colegio.provincia       ?? '',
        departamento:    colegio.departamento    ?? '',
        telefono:        colegio.telefono        ?? '',
        email:           colegio.email           ?? '',
        sitioWeb:        colegio.sitioWeb        ?? '',
        whatsappNumero:  colegio.whatsappNumero  ?? '',
        whatsappHorario: colegio.whatsappHorario ?? '',
        whatsappMensaje: colegio.whatsappMensaje ?? '',
        horaEntrada:     colegio.horaEntrada     ?? '07:30',
        horaTardanza:    colegio.horaTardanza    ?? '08:00',
        horaSalida:      colegio.horaSalida      ?? '13:00',
        yapeNumero:       colegio.yapeNumero       ?? '',
        yapeTitular:      colegio.yapeTitular      ?? '',
        plinNumero:       colegio.plinNumero       ?? '',
        plinTitular:      colegio.plinTitular      ?? '',
        bancoNombre:      colegio.bancoNombre      ?? '',
        cuentaBancaria:   colegio.cuentaBancaria   ?? '',
        cuentaBancariaCCI: colegio.cuentaBancariaCCI ?? '',
        historia:        colegio.historia        ?? '',
        mision:          colegio.mision          ?? '',
        vision:          colegio.vision          ?? '',
      });
    }
  }, [colegio]);

  const guardarColegio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colegio?.id) return;
    await save(async () => {
      await api.patch(`/colegios/${colegio.id}`, formColegio);
      toast.success('Configuración guardada correctamente');
      mutateColegio();
    });
  };

  const subirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !colegio?.id) return;
    setLoadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await api.post(`/colegios/${colegio.id}/logo`, fd);
      toast.success('Logo actualizado');
      mutateColegio();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Error al subir logo');
    } finally { setLoadingLogo(false); }
  };

  const subirQr = async (tipo: 'yape' | 'plin' | 'banco', file: File) => {
    if (!colegio?.id) return;
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      fd.append('tipo', tipo);
      await api.post(`/colegios/${colegio.id}/pago-qr`, fd);
      toast.success('QR actualizado');
      mutateColegio();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Error al subir el QR');
    }
  };

  const setC = (k: string) => (e: any) => setFormColegio((p: any) => ({ ...p, [k]: e.target.value }));

  const TABS = [
    { id: 'colegio', label: 'Institución', icon: 'bi-building'      },
    { id: 'cuenta',  label: 'Mi Cuenta',   icon: 'bi-person-circle' },
  ] as const;

  return (
    <DashboardLayout title="Configuración" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR']}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', background: 'var(--bg-card)', borderRadius: 10, padding: '0.4rem', border: '1px solid var(--border-color)' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setTabActiva(tab.id)}
              style={{ flex: 1, padding: '0.5rem 0.25rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                background: tabActiva === tab.id ? 'var(--accent)' : 'transparent',
                color:      tabActiva === tab.id ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <i className={`bi ${tab.icon}`} />{tab.label}
            </button>
          ))}
        </div>

        {/* Tab Institución */}
        {tabActiva === 'colegio' && formColegio && (
          <motion.form className="sige-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={guardarColegio}>
            <section style={{ marginBottom: '1.15rem', padding: '1rem', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent-soft), var(--bg-card))', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <small style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Plan institucional</small>
                <strong style={{ fontSize: '1.05rem' }}>{colegio?.plan?.nombre ?? 'Sin plan asignado'}</strong>
                <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '.78rem', marginTop: 3 }}>
                  {colegio?.licenciaFin ? `Vigente hasta ${new Date(colegio.licenciaFin).toLocaleDateString('es-PE')}` : 'Consulta la vigencia con Super Admin'}
                </span>
              </div>
              <i className="bi bi-patch-check-fill" style={{ color: 'var(--accent)', fontSize: '1.8rem' }} />
            </section>
            <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              <i className="bi bi-building me-2" />Datos Institucionales
            </h3>

            <div className="school-theme-managed-notice" role="status">
              <span className="school-theme-managed-notice__swatches" aria-hidden="true">
                <i style={{ background: colegio?.colorPrimario || 'var(--school-primary)' }} />
                <i style={{ background: colegio?.colorSecundario || 'var(--school-secondary)' }} />
              </span>
              <span>
                <strong>Identidad visual administrada por Super Admin</strong>
                <small>La paleta y la mascota se aplican automáticamente en todos los módulos del colegio.</small>
              </span>
              <i className="bi bi-shield-lock" aria-hidden="true" />
            </div>

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <div onClick={() => logoRef.current?.click()}
                style={{ width: 72, height: 72, borderRadius: 12, cursor: 'pointer', overflow: 'hidden',
                  background: 'var(--bg-secondary)', border: '2px dashed var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {colegio?.logoUrl
                  ? <img src={colegio.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="logo" />
                  : <i className="bi bi-image" style={{ color: 'var(--text-muted)', fontSize: '1.5rem' }} />}
              </div>
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>Logo del colegio</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 8px' }}>PNG, JPG — Conversión automática a WebP</p>
                <button type="button" onClick={() => logoRef.current?.click()} className="btn-accent"
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }} disabled={loadingLogo}>
                  {loadingLogo ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-upload me-1" />Cambiar logo</>}
                </button>
                <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={subirLogo} style={{ display: 'none' }} />
              </div>
            </div>

            {/* Campos básicos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              {[
                ['Nombre del colegio *','nombre','1 / -1',true],
                ['Nombre corto','nombreCorto','',false],
                ['Email institucional','email','',false],
                ['Teléfono','telefono','',false],
                ['Sitio web','sitioWeb','',false],
                ['Dirección','direccion','1 / -1',false],
                ['Distrito','distrito','',false],
                ['Provincia','provincia','',false],
                ['Departamento','departamento','',false],
              ].map(([label, key, col, req]: any) => (
                <div key={key} style={col ? { gridColumn: col } : {}}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input type="text" value={formColegio[key] ?? ''} onChange={setC(key)} required={req} className="sige-input" />
                </div>
              ))}

            </div>

            {/* WhatsApp */}
            <h4 style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '1.25rem 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="bi bi-whatsapp" style={{ color: '#25D366' }} />WhatsApp Institucional
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Número</label>
                <input type="text" value={formColegio.whatsappNumero ?? ''} onChange={setC('whatsappNumero')} className="sige-input" placeholder="51999999999" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Horario de atención</label>
                <input type="text" value={formColegio.whatsappHorario ?? ''} onChange={setC('whatsappHorario')} className="sige-input" placeholder="Lun-Vie 8am-5pm" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Mensaje de bienvenida</label>
                <input type="text" value={formColegio.whatsappMensaje ?? ''} onChange={setC('whatsappMensaje')} className="sige-input" />
              </div>
            </div>

            {/* Horario de asistencia (QR) */}
            <h4 style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '1.25rem 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="bi bi-qr-code-scan" />Horario de asistencia (QR)
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '-0.5rem 0 0.75rem' }}>
              Define cómo el escáner QR de Secretaría decide si un ingreso es puntual o con tardanza.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Hora de entrada</label>
                <input type="time" value={formColegio.horaEntrada ?? '07:30'} onChange={setC('horaEntrada')} className="sige-input" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Tardanza después de</label>
                <input type="time" value={formColegio.horaTardanza ?? '08:00'} onChange={setC('horaTardanza')} className="sige-input" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Hora de salida</label>
                <input type="time" value={formColegio.horaSalida ?? '13:00'} onChange={setC('horaSalida')} className="sige-input" />
              </div>
            </div>

            {/* Datos de pago (Yape/Plin/Banco) */}
            <h4 style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '1.25rem 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="bi bi-wallet2" />Datos para el pago de pensiones
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '-0.5rem 0 0.75rem' }}>
              Los padres verán esta información al momento de pagar, para saber a dónde transferir.
              El QR es opcional — algunas apps de pago hoy solo funcionan escaneando un código.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#7c3aed', display: 'block', marginBottom: 4 }}><i className="bi bi-phone me-1" />Número Yape</label>
                <input type="text" value={formColegio.yapeNumero ?? ''} onChange={setC('yapeNumero')} className="sige-input" placeholder="999 999 999" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Titular Yape</label>
                <input type="text" value={formColegio.yapeTitular ?? ''} onChange={setC('yapeTitular')} className="sige-input" placeholder="Nombre del titular" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <QrUploader label="QR de Yape (opcional)" urlActual={colegio?.yapeQrUrl} onSubir={file => subirQr('yape', file)} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#00c2ff', display: 'block', marginBottom: 4 }}><i className="bi bi-phone me-1" />Número Plin</label>
                <input type="text" value={formColegio.plinNumero ?? ''} onChange={setC('plinNumero')} className="sige-input" placeholder="999 999 999" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Titular Plin</label>
                <input type="text" value={formColegio.plinTitular ?? ''} onChange={setC('plinTitular')} className="sige-input" placeholder="Nombre del titular" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <QrUploader label="QR de Plin (opcional)" urlActual={colegio?.plinQrUrl} onSubir={file => subirQr('plin', file)} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Banco</label>
                <input type="text" value={formColegio.bancoNombre ?? ''} onChange={setC('bancoNombre')} className="sige-input" placeholder="BCP, Interbank..." />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>N° de cuenta</label>
                <input type="text" value={formColegio.cuentaBancaria ?? ''} onChange={setC('cuentaBancaria')} className="sige-input" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>CCI (interbancario)</label>
                <input type="text" value={formColegio.cuentaBancariaCCI ?? ''} onChange={setC('cuentaBancariaCCI')} className="sige-input" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <QrUploader label="QR del banco (opcional)" urlActual={colegio?.bancoQrUrl} onSubir={file => subirQr('banco', file)} />
              </div>
            </div>

            {/* Portal institucional */}
            <h4 style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '1.25rem 0 0.75rem' }}>
              <i className="bi bi-globe me-1" />Portal institucional público
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[['Historia','historia'],['Misión','mision'],['Visión','vision']].map(([label, key]) => (
                <div key={key}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
                  <textarea value={formColegio[key] ?? ''} onChange={setC(key)} className="sige-input" style={{ minHeight: 70, resize: 'vertical' }} />
                </div>
              ))}
            </div>

            <button type="submit" className="btn-accent" disabled={saving}
              style={{ marginTop: '1.25rem', width: '100%', justifyContent: 'center', padding: '0.6rem' }}>
              {saving ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</> : <><i className="bi bi-check2 me-1" />Guardar configuración</>}
            </button>
          </motion.form>
        )}

        {/* Tabs Perfil / Contraseña — mismo componente compartido que usan los demás roles */}
        {tabActiva === 'cuenta' && <PerfilYPassword />}
      </div>
    </DashboardLayout>
  );
}
