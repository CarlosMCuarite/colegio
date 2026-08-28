'use client';
// app/(dashboard)/admin/exportaciones/page.tsx
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData } from '../../../../hooks/useApi';
import JsonViewer from '../../../../components/JsonViewer';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';
import JSZip from 'jszip';

const MODULOS_DISPONIBLES = [
  { key: 'estudiantes', label: 'Estudiantes',  icon: 'bi-person-badge'       },
  { key: 'padres',      label: 'Padres',        icon: 'bi-people'             },
  { key: 'matriculas',  label: 'Matrículas',    icon: 'bi-file-earmark-text'  },
  { key: 'asistencias', label: 'Asistencias',   icon: 'bi-calendar-check'     },
  { key: 'pagos',       label: 'Pagos',         icon: 'bi-cash-stack'         },
  { key: 'eventos',     label: 'Eventos',       icon: 'bi-calendar-event'     },
  { key: 'comunicados', label: 'Comunicados',   icon: 'bi-megaphone'          },
];

interface ArchivoDentroDelZip {
  nombre: string;
  data: any;
  cantidad: number | null;
}

export default function ExportacionesPage() {
  const [seleccionados, setSeleccionados] = useState<string[]>(['estudiantes', 'padres', 'matriculas']);
  const [descargando, setDescargando]     = useState(false);
  const { data, mutate } = useData<any>('/exportaciones');

  // ── Cargar y visualizar un ZIP exportado previamente ──────────────────────
  const inputCargarRef = useRef<HTMLInputElement>(null);
  const [cargandoZip, setCargandoZip]   = useState(false);
  const [zipNombre, setZipNombre]       = useState<string | null>(null);
  const [archivosZip, setArchivosZip]   = useState<ArchivoDentroDelZip[] | null>(null);
  const [verArchivo, setVerArchivo]     = useState<ArchivoDentroDelZip | null>(null);

  const historial = data?.data ?? [];

  const toggleModulo = (key: string) =>
    setSeleccionados(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);

  const exportar = async () => {
    if (!seleccionados.length) { toast.error('Selecciona al menos un módulo'); return; }
    setDescargando(true);
    try {
      const res = await api.post('/exportaciones', { modulos: seleccionados }, { responseType: 'blob' });
      const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a    = document.createElement('a');
      const ts   = new Date().toISOString().slice(0, 10);
      a.href     = url;
      a.download = `sige-exportacion-${ts}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exportación descargada correctamente');
      mutate();
    } catch { toast.error('Error al generar la exportación'); }
    finally { setDescargando(false); }
  };

  // Carga el ZIP descargado anteriormente y lo abre para visualizar su contenido,
  // sin subir nada al servidor ni tocar la base de datos — todo ocurre en el navegador.
  const cargarZip = async (file: File) => {
    setCargandoZip(true);
    setArchivosZip(null);
    try {
      const zip = await JSZip.loadAsync(file);
      const archivos: ArchivoDentroDelZip[] = [];
      for (const [ruta, entrada] of Object.entries(zip.files)) {
        if (entrada.dir || !ruta.toLowerCase().endsWith('.json')) continue;
        const texto = await entrada.async('string');
        try {
          const data = JSON.parse(texto);
          archivos.push({ nombre: ruta, data, cantidad: Array.isArray(data) ? data.length : null });
        } catch {
          toast.error(`El archivo "${ruta}" dentro del ZIP no es un JSON válido`);
        }
      }
      if (archivos.length === 0) {
        toast.error('El archivo cargado no contiene JSONs de exportación de SIGE');
        return;
      }
      setZipNombre(file.name);
      setArchivosZip(archivos);
      toast.success(`${archivos.length} archivo(s) encontrado(s) en el ZIP`);
    } catch {
      toast.error('No se pudo leer el archivo. Verifica que sea un ZIP válido exportado desde SIGE.');
    } finally {
      setCargandoZip(false);
      if (inputCargarRef.current) inputCargarRef.current.value = '';
    }
  };

  return (
    <DashboardLayout title="Exportaciones Históricas" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* Selector de módulos para exportar */}
        <div className="sige-card">
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
            <i className="bi bi-download me-2" />Nueva Exportación
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Selecciona los módulos a exportar. Se genera un archivo ZIP con JSONs —
            libera espacio de la base de datos sin perder la información histórica.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {MODULOS_DISPONIBLES.map(m => (
              <label key={m.key} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.625rem 0.875rem', borderRadius: 8, cursor: 'pointer',
                background: seleccionados.includes(m.key) ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                border: seleccionados.includes(m.key) ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                transition: 'all 0.15s',
              }}>
                <input type="checkbox" checked={seleccionados.includes(m.key)} onChange={() => toggleModulo(m.key)}
                  style={{ accentColor: 'var(--accent)' }} />
                <i className={`bi ${m.icon}`} style={{ color: seleccionados.includes(m.key) ? 'var(--accent)' : 'var(--text-muted)', fontSize: '1rem', width: 18 }} />
                <span style={{ fontSize: '0.875rem', fontWeight: seleccionados.includes(m.key) ? 600 : 400, color: 'var(--text-primary)' }}>
                  {m.label}
                </span>
              </label>
            ))}
          </div>

          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#92400e' }}>
            <i className="bi bi-info-circle me-1" />
            Una vez exportado y verificado, puedes eliminar los registros antiguos
            desde su módulo correspondiente para aliviar la base de datos.
          </div>

          <button
            onClick={exportar}
            disabled={descargando || !seleccionados.length}
            className="btn-accent"
            style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', fontSize: '0.9rem', opacity: !seleccionados.length ? 0.5 : 1 }}
          >
            {descargando
              ? <><span className="spinner-border spinner-border-sm me-2" />Generando ZIP...</>
              : <><i className="bi bi-file-zip me-2" />Exportar {seleccionados.length} módulo(s)</>}
          </button>
        </div>

        {/* Historial */}
        <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            <i className="bi bi-clock-history me-2" />Historial de exportaciones
          </div>
          {historial.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <i className="bi bi-archive" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
              Sin exportaciones previas
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="sige-table">
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Módulos</th>
                    <th>Generado por</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((ex: any, i: number) => (
                    <motion.tr key={ex.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {ex.nombre}
                        </div>
                        {ex.tamañoKB && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ex.tamañoKB} KB</div>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {(ex.modulos ?? []).map((m: string) => (
                            <span key={m} style={{ fontSize: '0.68rem', background: 'var(--accent-soft)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 99, fontWeight: 600 }}>
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {ex.usuario?.nombres} {ex.usuario?.apellidos}
                      </td>
                      <td>
                        <span className="estado-badge" style={{
                          background: ex.estado === 'COMPLETADO' ? '#d1fae5' : ex.estado === 'ERROR' ? '#fee2e2' : '#fef3c7',
                          color:      ex.estado === 'COMPLETADO' ? '#065f46' : ex.estado === 'ERROR' ? '#991b1b' : '#92400e',
                        }}>
                          {ex.estado}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(ex.createdAt).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Cargar un ZIP ya exportado para visualizar su contenido */}
      <div className="sige-card">
        <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
          <i className="bi bi-folder2-open me-2" />Visualizar un archivo exportado
        </h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Carga aquí el archivo ZIP que descargaste anteriormente para ver su contenido
          en pantalla — sin subirlo a ningún servidor ni modificar la base de datos.
        </p>

        <div
          onClick={() => inputCargarRef.current?.click()}
          style={{
            border: '2px dashed var(--border-color)', borderRadius: 10, padding: '1.5rem',
            textAlign: 'center', cursor: cargandoZip ? 'wait' : 'pointer', background: 'var(--bg-secondary)',
            marginBottom: archivosZip ? '1.25rem' : 0,
          }}
        >
          {cargandoZip ? (
            <div style={{ color: 'var(--text-muted)' }}><span className="spinner-border spinner-border-sm me-2" />Leyendo archivo...</div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <i className="bi bi-cloud-arrow-up" style={{ fontSize: '1.8rem', display: 'block', marginBottom: 8 }} />
              Click para seleccionar el archivo .zip exportado
            </div>
          )}
          <input ref={inputCargarRef} type="file" accept=".zip" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) cargarZip(f); }} />
        </div>

        {archivosZip && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <i className="bi bi-file-zip me-1" />{zipNombre}
              </span>
              <button onClick={() => { setArchivosZip(null); setZipNombre(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                <i className="bi bi-x-lg me-1" />Cerrar
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {archivosZip.map(a => (
                <div key={a.nombre} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.625rem 0.875rem' }}>
                  <i className="bi bi-filetype-json" style={{ color: 'var(--accent)', fontSize: '1.1rem' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', fontFamily: 'monospace' }}>{a.nombre}</div>
                    {a.cantidad !== null && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.cantidad} registro(s)</div>}
                  </div>
                  <button onClick={() => setVerArchivo(a)} className="btn-accent" style={{ fontSize: '0.78rem', padding: '0.35rem 0.875rem' }}>
                    <i className="bi bi-eye me-1" />Ver contenido
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {verArchivo && (
        <JsonViewer titulo={verArchivo.nombre} data={verArchivo.data} onClose={() => setVerArchivo(null)} />
      )}
    </DashboardLayout>
  );
}
