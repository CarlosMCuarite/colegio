'use client';
// app/(dashboard)/secretaria/qr/pantalla/page.tsx
// Vista de "pantalla pública" para el escáner QR — pensada para un tablet o
// monitor instalado en la entrada del colegio. No muestra el sidebar, topbar,
// ni ningún dato administrativo: solo la cámara y el resultado del último
// escaneo, en grande, para que se vea bien desde lejos.
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useQRSesion } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface ScanResult {
  ok: boolean;
  duplicado?: boolean;
  mensaje: string;
  estudiante?: { nombres: string; apellidos: string; fotoUrl?: string; grado?: string; seccion?: string; };
  asistencia?: { estado: string; horaLlegada?: string; };
}

const ROLES_PERMITIDOS = ['SUPERADMIN', 'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIA'];

function Pantalla() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { data: sesion, mutate: mutateSesion } = useQRSesion();
  const [scanning, setScanning] = useState(true);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [reloj, setReloj]         = useState(new Date());
  const scannerRef = useRef<any>(null);
  // Evita procesar el MISMO carné una y otra vez mientras alguien lo sostiene
  // frente a la cámara — antes cada frame decodificado disparaba una petición
  // nueva, generando decenas de llamadas simultáneas (de ahí el aluvión de
  // "Error al procesar QR" / timeouts cuando había varios alumnos seguidos).
  const ultimoCodigoRef = useRef<{ codigo: string; hora: number } | null>(null);
  const limpiarResultadoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
    if (!loading && user && !ROLES_PERMITIDOS.includes(user.rol)) router.push('/unauthorized');
  }, [user, loading, router]);

  useEffect(() => {
    const t = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!scanning || !user) return;
    let scanner: any;
    const init = async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      scanner = new Html5Qrcode('qr-reader-pantalla', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], // no pierde tiempo probando otros formatos de código de barras
        verbose: false,
      } as any);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 20, // más cuadros por segundo = detecta más rápido
          qrbox: { width: 220, height: 220 }, // caja más chica = menos área que procesar por cuadro
          aspectRatio: 1,
          disableFlip: true, // el carné no se muestra espejado, evita un procesamiento extra
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }, // usa la API nativa del navegador si está disponible (mucho más rápida que el decodificador en JS)
        },
        handleScan,
        () => {},
      );
    };
    init().catch(() => toast.error('No se pudo acceder a la cámara'));
    return () => { scanner?.stop().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, user]);

  const handleScan = async (codigoQR: string) => {
    const ahora = Date.now();
    // Mismo código leído hace menos de 8s → lo ignora (sigue siendo el mismo
    // alumno con el carné frente a la cámara, no un escaneo nuevo).
    if (ultimoCodigoRef.current && ultimoCodigoRef.current.codigo === codigoQR && ahora - ultimoCodigoRef.current.hora < 8000) return;
    if (procesando) return;
    ultimoCodigoRef.current = { codigo: codigoQR, hora: ahora };
    setProcesando(true);
    try {
      const res = await api.post<ScanResult>('/qr/escanear', { codigoQR });
      setLastScan(res.data);
      mutateSesion();
      // Se limpia solo a los 4s para no confundir al siguiente alumno en fila.
      if (limpiarResultadoRef.current) clearTimeout(limpiarResultadoRef.current);
      limpiarResultadoRef.current = setTimeout(() => setLastScan(null), 4000);
    } catch (err: any) {
      const msg = err?.code === 'ECONNABORTED'
        ? 'La conexión tardó demasiado — revisa la red'
        : (err?.response?.data?.error ?? 'Error al procesar QR');
      // id fijo: si sigue fallando, actualiza el mismo toast en vez de apilar uno nuevo por cada intento.
      toast.error(msg, { id: 'qr-scan-error' });
    } finally {
      setTimeout(() => setProcesando(false), 1500);
    }
  };

  const pantallaCompleta = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  if (loading || !user) return <div style={{ minHeight: '100vh', background: '#0b0f19' }} />;

  const s = sesion as any;
  const estadoColor: Record<string, string> = { PRESENTE: '#10b981', TARDANZA: '#f59e0b', AUSENTE: '#ef4444' };

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#fff', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
      {/* Barra superior discreta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user.colegio?.logoUrl && <img src={user.colegio.logoUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{user.colegio?.nombre ?? 'Registro de Asistencia'}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Escáner QR de ingreso</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {reloj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {reloj.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <button onClick={pantallaCompleta} title="Pantalla completa"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '0.5rem 0.7rem', cursor: 'pointer', color: '#fff' }}>
            <i className="bi bi-arrows-fullscreen" />
          </button>
          <a href="/secretaria/qr" title="Salir a la vista de administración"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '0.5rem 0.7rem', color: '#fff', textDecoration: 'none' }}>
            <i className="bi bi-box-arrow-left" />
          </a>
        </div>
      </div>

      {/* Cuerpo: cámara + resultado */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', minHeight: 0 }}>
        <div style={{ background: '#111827', borderRadius: 16, padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div id="qr-reader-pantalla" style={{ width: '100%', maxWidth: 520, borderRadius: 12, overflow: 'hidden' }} />
          <p style={{ color: '#94a3b8', marginTop: '1rem', fontSize: '0.95rem', textAlign: 'center' }}>
            Acerca tu carné escolar a la cámara
          </p>
          {s && (
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span><b style={{ color: '#10b981' }}>{s.registrados}</b> registrados</span>
              <span><b style={{ color: '#f59e0b' }}>{s.pendientes}</b> pendientes</span>
              {s.horaTardanza && <span>Tardanza después de <b style={{ color: '#fff' }}>{s.horaTardanza}</b></span>}
            </div>
          )}
        </div>

        <div style={{ background: '#111827', borderRadius: 16, padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatePresence mode="wait">
            {lastScan ? (
              <motion.div key={JSON.stringify(lastScan)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: 120, height: 120, borderRadius: '50%',
                  background: lastScan.duplicado ? '#78350f' : lastScan.asistencia?.estado === 'TARDANZA' ? '#78350f' : '#064e3b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem',
                  border: `4px solid ${lastScan.duplicado ? '#f59e0b' : lastScan.asistencia?.estado === 'TARDANZA' ? '#f59e0b' : '#10b981'}`,
                }}>
                  {lastScan.duplicado ? 'ℹ️' : lastScan.asistencia?.estado === 'TARDANZA' ? '⏰' : '✅'}
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.8rem' }}>
                  {lastScan.estudiante?.nombres} {lastScan.estudiante?.apellidos}
                </div>
                <div style={{ fontSize: '1rem', color: '#94a3b8' }}>
                  {lastScan.estudiante?.grado} {lastScan.estudiante?.seccion ? `— Sección ${lastScan.estudiante.seccion}` : ''}
                </div>
                <div style={{
                  padding: '0.6rem 1.5rem', borderRadius: 99, fontWeight: 700, fontSize: '1.1rem',
                  background: `${estadoColor[lastScan.asistencia?.estado ?? ''] ?? '#10b981'}22`,
                  color: estadoColor[lastScan.asistencia?.estado ?? ''] ?? '#10b981',
                }}>
                  {lastScan.mensaje}
                </div>
                {lastScan.asistencia?.horaLlegada && (
                  <div style={{ fontSize: '1rem', color: '#94a3b8' }}>
                    {new Date(lastScan.asistencia.horaLlegada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </motion.div>
            ) : (
              <div style={{ textAlign: 'center', color: '#475569' }}>
                <i className="bi bi-qr-code-scan" style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }} />
                <p style={{ fontSize: '1.1rem' }}>Esperando el próximo escaneo…</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function PantallaQRPage() {
  return (
    <AuthProvider>
      <Pantalla />
    </AuthProvider>
  );
}
