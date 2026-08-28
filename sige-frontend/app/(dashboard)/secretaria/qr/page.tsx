'use client';
// app/(dashboard)/secretaria/qr/page.tsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useQRSesion } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

interface ScanResult {
  ok: boolean;
  duplicado?: boolean;
  mensaje: string;
  estudiante?: { nombres: string; apellidos: string; fotoUrl?: string; grado?: string; seccion?: string; };
  asistencia?: { estado: string; horaLlegada?: string; };
}

export default function QRPage() {
  const { data: sesion, mutate: mutateSesion } = useQRSesion();
  const [scanning, setScanning]   = useState(false);
  const [lastScan, setLastScan]   = useState<ScanResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Iniciar / detener escáner
  useEffect(() => {
    if (!scanning) return;
    let scanner: any;

    const init = async () => {
      const { Html5Qrcode } = await import('html5-qrcode');
      scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 20, // más cuadros/seg = detecta el QR casi al instante en vez de esperar a la siguiente pasada
          qrbox: { width: 280, height: 280 }, // caja más grande = no hay que centrar el QR con precisión
          aspectRatio: 1.0,
          disableFlip: false,
          // Usa el detector de QR nativo del navegador (hardware-acelerado) cuando está
          // disponible (Chrome/Android) en vez del decodificador JS puro — es la mejora
          // de velocidad más grande para lectura masiva de carnets en fila.
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        },
        handleScan,
        () => {},
      );
    };

    init().catch(() => { toast.error('No se pudo acceder a la cámara'); setScanning(false); });

    return () => {
      scanner?.stop().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const handleScan = async (codigoQR: string) => {
    if (loading) return;
    setLoading(true); // bloquea nuevos escaneos mientras se procesa este Y durante la pausa anti-duplicado
    try {
      const res = await api.post<ScanResult>('/qr/escanear', { codigoQR });
      setLastScan(res.data);
      mutateSesion();
      if (res.data.duplicado) toast('Ya registrado hoy', { icon: 'ℹ️' });
      else if (res.data.asistencia?.estado === 'TARDANZA') toast.error(`⏰ Tardanza: ${res.data.estudiante?.nombres}`);
      else toast.success(`✅ ${res.data.estudiante?.nombres} registrado`);
    } catch {
      toast.error('Error al procesar QR');
    } finally {
      // Pausa breve (evita registrar el mismo QR varias veces mientras sigue frente
      // a la cámara) SIN bloquear la detección del siguiente alumno más de lo necesario.
      setTimeout(() => setLoading(false), 1200);
    }
  };

  const estadoColor: Record<string, string> = {
    PRESENTE: '#10b981', TARDANZA: '#f59e0b', AUSENTE: '#ef4444',
  };

  const s = sesion as any;

  return (
    <DashboardLayout title="Registro QR de Asistencia" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <a href="/secretaria/qr/pantalla" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.4rem 0.875rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 }}>
            <i className="bi bi-arrows-fullscreen" />Abrir pantalla para la entrada del colegio
          </a>
        </div>

        {/* Métricas del día */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Estudiantes', value: s?.totalEstudiantes ?? 0, color: '#4f46e5', icon: 'bi-people' },
            { label: 'Registrados',        value: s?.registrados        ?? 0, color: '#10b981', icon: 'bi-check-circle' },
            { label: 'Pendientes',          value: s?.pendientes         ?? 0, color: '#f59e0b', icon: 'bi-clock' },
            { label: 'Fecha',               value: s?.fecha ?? new Date().toLocaleDateString('es-PE'), color: '#3b82f6', icon: 'bi-calendar-day' },
          ].map((k) => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-icon" style={{ background: `${k.color}18`, color: k.color }}>
                <i className={`bi ${k.icon}`} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--text-primary)' }}>{k.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

          {/* Panel de escaneo */}
          <div className="sige-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <h3 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, alignSelf: 'flex-start' }}>
              <i className="bi bi-qr-code-scan me-2" />Escáner QR
            </h3>

            {/* Vista cámara */}
            {scanning ? (
              <div id="qr-reader" className="qr-scanner-container" style={{ width: '100%', minHeight: 280 }} />
            ) : (
              <div style={{
                width: '100%', minHeight: 280, background: 'var(--bg-secondary)',
                borderRadius: 10, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '1rem',
                border: '2px dashed var(--border-color)',
              }}>
                <i className="bi bi-qr-code" style={{ fontSize: '4rem', color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                  Presiona para iniciar el escáner
                </p>
              </div>
            )}

            <button
              className="btn-accent"
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
              onClick={() => setScanning(p => !p)}
            >
              <i className={`bi ${scanning ? 'bi-stop-circle' : 'bi-play-circle'}`} />
              {scanning ? 'Detener escáner' : 'Iniciar escáner'}
            </button>

            {/* Entrada manual de DNI */}
            <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>O ingresa el DNI manualmente:</p>
              <ManualInput onScan={handleScan} loading={loading} />
            </div>
          </div>

          {/* Resultado del último escaneo */}
          <div className="sige-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
              <i className="bi bi-person-check me-2" />Último registro
            </h3>
            <AnimatePresence mode="wait">
              {lastScan ? (
                <motion.div
                  key={JSON.stringify(lastScan)}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '1rem' }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: lastScan.duplicado ? '#fef3c7' : lastScan.asistencia?.estado === 'TARDANZA' ? '#fef3c7' : '#d1fae5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem', fontWeight: 700,
                    color: lastScan.duplicado ? '#d97706' : lastScan.asistencia?.estado === 'TARDANZA' ? '#d97706' : '#059669',
                    border: `3px solid ${lastScan.duplicado ? '#f59e0b' : lastScan.asistencia?.estado === 'TARDANZA' ? '#f59e0b' : '#10b981'}`,
                  }}>
                    {lastScan.duplicado ? 'ℹ' : lastScan.asistencia?.estado === 'TARDANZA' ? '⏰' : '✓'}
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                      {lastScan.estudiante?.nombres} {lastScan.estudiante?.apellidos}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {lastScan.estudiante?.grado} {lastScan.estudiante?.seccion ? `— Sección ${lastScan.estudiante.seccion}` : ''}
                    </div>
                  </div>

                  <div style={{
                    padding: '0.5rem 1.25rem', borderRadius: 99,
                    background: estadoColor[lastScan.asistencia?.estado ?? ''] ? `${estadoColor[lastScan.asistencia!.estado]}18` : '#f0fdf4',
                    color: estadoColor[lastScan.asistencia?.estado ?? ''] ?? '#059669',
                    fontWeight: 700, fontSize: '0.875rem',
                  }}>
                    {lastScan.mensaje}
                  </div>

                  {lastScan.asistencia?.horaLlegada && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Hora: {new Date(lastScan.asistencia.horaLlegada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </motion.div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '0.75rem' }}>
                  <i className="bi bi-person-dash" style={{ fontSize: '3rem' }} />
                  <p style={{ fontSize: '0.875rem', margin: 0 }}>Escanea un QR para ver el resultado aquí</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ManualInput({ onScan, loading }: { onScan: (v: string) => void; loading: boolean }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onScan(val.trim()); setVal(''); } }}
        placeholder="DNI del estudiante"
        className="sige-input"
        disabled={loading}
      />
      <button
        className="btn-accent"
        disabled={loading || !val.trim()}
        onClick={() => { onScan(val.trim()); setVal(''); }}
        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        <i className="bi bi-search" />
      </button>
    </div>
  );
}
