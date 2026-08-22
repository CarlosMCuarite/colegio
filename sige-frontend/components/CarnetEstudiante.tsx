'use client';
// components/CarnetEstudiante.tsx
// Carnet de estudiante de dos caras, HORIZONTAL, con botón para girar en
// pantalla e impresión que muestra ambas caras. TODO el layout del anverso
// (foto, datos, badges de grado/sección, QR) es editable en posición y
// tamaño desde "Plantilla de carnet" — se guarda en `colegio.carnetConfig`.
// Si el colegio nunca personalizó el layout, se usa DEFAULT_LAYOUT (el
// diseño de fábrica) — así los carnets existentes no se rompen.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { useData } from '@/hooks/useApi';

interface Props {
  estudiante: any;
  onCerrar: () => void;
}

export const CARD_W = 400;
export const CARD_H = 254;
export const HEADER_H = 46; // alto fijo del encabezado (logo/nombre/lema) — no se mueve

// Posiciones/tamaños por defecto de cada elemento movible del anverso, en %
// relativos a toda la tarjeta (0-100). El header y el footer quedan fijos.
export const DEFAULT_LAYOUT: Record<string, { xPct: number; yPct: number; wPct: number; hPct: number }> = {
  foto:         { xPct: 8,  yPct: 21, wPct: 18, hPct: 35 },
  datos:        { xPct: 28, yPct: 21, wPct: 38, hPct: 35 },
  qr:           { xPct: 78, yPct: 22, wPct: 20, hPct: 32 },
  gradoBadge:   { xPct: 8,  yPct: 67, wPct: 41, hPct: 11 },
  seccionBadge: { xPct: 51, yPct: 67, wPct: 41, hPct: 11 },
  marcaAgua:    { xPct: 15, yPct: 21, wPct: 70, hPct: 70 },
};

export const REVERSO_HEADER_H = 40;
// Layout por defecto del REVERSO — también 100% editable (mover/agrandar)
// desde la plantilla, igual que el anverso.
export const DEFAULT_LAYOUT_ATRAS: Record<string, { xPct: number; yPct: number; wPct: number; hPct: number }> = {
  datosAdicionales: { xPct: 3,  yPct: 17, wPct: 62, hPct: 38 },
  infoImportante:   { xPct: 3,  yPct: 56, wPct: 62, hPct: 40 },
  verificacion:     { xPct: 68, yPct: 17, wPct: 29, hPct: 40 },
  firma:            { xPct: 68, yPct: 60, wPct: 29, hPct: 30 },
};

const DEFAULT_CONFIG = {
  colorPrimario: '#1e3a8a',
  colorSecundario: '#dc2626',
  lema: '',
  mostrarDireccionEstudiante: true,
  mostrarTipoSangre: false, // dato no esencial — se deja apagado por defecto, pero sigue siendo editable
  mostrarDireccionColegio: true,
  mostrarMarcaAgua: false,
  textoMarcaAgua: 'ESTUDIANTE',
  marcaAguaImagenUrl: null as string | null,
  marcaAguaOpacidad: 8,   // % (1-40) — qué tan visible es la marca de agua
  layoutAtras: null as typeof DEFAULT_LAYOUT_ATRAS | null,
  informacionImportante: [
    'Este carnet acredita la condición de estudiante de la institución.',
    'Es personal e intransferible.',
    'En caso de pérdida, comunicar inmediatamente a la institución.',
  ],
  nombreDirector: '',
  cargoDirector: 'Director(a)',
  firmaImagenUrl: null as string | null,
  layout: null as typeof DEFAULT_LAYOUT | null,
};

function useQR(valor: string) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelado = false;
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(valor, { width: 220, margin: 1, color: { dark: '#111827', light: '#ffffff' } }, (err: any, url: string) => {
        if (!cancelado && !err) setDataUrl(url);
      });
    });
    return () => { cancelado = true; };
  }, [valor]);
  return dataUrl;
}

export function useCarnetConfig(colegioId?: string) {
  const { data } = useData<any>(colegioId ? `/colegios/${colegioId}/carnet-config` : null);
  return { ...DEFAULT_CONFIG, ...(data as any ?? {}) };
}

export default function CarnetEstudiante({ estudiante, onCerrar }: Props) {
  const { user } = useAuth();
  // BUG REAL encontrado: GET /colegios devuelve un COLEGIO para roles
  // normales, pero devuelve una LISTA (array paginado) para SuperAdmin. Si
  // un SuperAdmin abre un carnet, `colegioData.data` era un array (sin
  // `.id`), y como un array no es `null`/`undefined`, el `??` no caía al
  // respaldo de `user.colegio` — el carnet quedaba sin colegioId, y por lo
  // tanto SIN poder cargar `carnetConfig` en absoluto (se veía siempre la
  // plantilla de fábrica, sin importar lo guardado). Se corrige detectando
  // explícitamente el caso de array.
  const { data: colegioData } = useData<any>('/colegios');
  const colegioFetchado = (colegioData as any)?.data;
  const colegio = (colegioFetchado && !Array.isArray(colegioFetchado)) ? colegioFetchado : (user?.colegio ?? {});
  const config = useCarnetConfig(colegio?.id);
  const [cara, setCara] = useState<'frente' | 'atras'>('frente');
  const puedeEditarPlantilla = ['SUPERADMIN','ADMINISTRADOR','SECRETARIA'].includes(user?.rol ?? '');

  const matricula = estudiante.matriculas?.[0];
  const gradoSeccion = matricula
    ? { grado: matricula.nivelGrado?.nombre ?? '—', seccion: matricula.seccion?.nombre ?? '' }
    : { grado: 'Sin matrícula', seccion: '' };
  const codigo = estudiante.codigoQR || estudiante.id;
  const fechaNac = estudiante.fechaNacimiento ? new Date(estudiante.fechaNacimiento).toLocaleDateString('es-PE') : '—';
  const telefonoEmergencia = estudiante.padreEstudiantes?.[0]?.padre?.telefono || estudiante.padreTelefono || '—';
  const anoActual = new Date().getFullYear();

  const qrFrenteUrl = useQR(codigo);
  const qrAtrasUrl  = useQR(`https://${colegio.slug ?? 'sige'}.sige.pe/validar/${codigo}`);

  const imprimir = () => window.print();

  const propsComunes = { estudiante, colegio, config, gradoSeccion, anoActual, codigo, fechaNac, telefonoEmergencia };

  return (
    <motion.div className="sige-modal-overlay carnet-print-root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <motion.div className="sige-modal" style={{ maxWidth: 460 }} initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }} className="carnet-oculto-print">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}><i className="bi bi-person-vcard me-2" />Carnet de estudiante</h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
        </div>

        {/* Pantalla: solo la cara activa */}
        <div className="carnet-oculto-print">
          {cara === 'frente' ? <CarnetFrente {...propsComunes} qrUrl={qrFrenteUrl} /> : <CarnetAtras {...propsComunes} qrUrl={qrAtrasUrl} />}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }} className="carnet-oculto-print">
          <button onClick={() => setCara(c => c === 'frente' ? 'atras' : 'frente')}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.55rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
            <i className="bi bi-arrow-repeat me-1" />Girar carnet
          </button>
          <button onClick={imprimir} disabled={!qrFrenteUrl} className="btn-accent">
            <i className="bi bi-printer me-1" />Imprimir (ambas caras)
          </button>
          {puedeEditarPlantilla && (
            <a href="/carnet/plantilla" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.55rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem', textDecoration: 'none' }}>
            <i className="bi bi-palette me-1" />Editar plantilla
          </a>
          )}
        </div>

        {/* Solo para imprimir: las dos caras, una debajo de la otra */}
        <div className="carnet-solo-print">
          <div className="carnet-pagina-print"><CarnetFrente {...propsComunes} qrUrl={qrFrenteUrl} /></div>
          <div className="carnet-pagina-print"><CarnetAtras {...propsComunes} qrUrl={qrAtrasUrl} /></div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Caja absolutamente posicionada según el layout (foto/datos/badges/QR) ────
export function Caja({ layout, defaults, clave, children, style }: { layout: Record<string, any>; defaults: Record<string, any>; clave: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const box = layout[clave] ?? defaults[clave];
  return (
    <div style={{
      position: 'absolute',
      left: `${box.xPct}%`, top: `${box.yPct}%`, width: `${box.wPct}%`, height: `${box.hPct}%`,
      boxSizing: 'border-box', ...style,
    }}>
      {children}
    </div>
  );
}

export function CarnetFrente({ estudiante, colegio, config, gradoSeccion, anoActual, qrUrl }: any) {
  const c = { ...DEFAULT_CONFIG, ...config };
  const layout = { ...DEFAULT_LAYOUT, ...(c.layout ?? {}) };
  return (
    <div className="carnet-tarjeta" style={{
      background: '#fff', borderRadius: 14, overflow: 'hidden', margin: '0 auto', width: CARD_W, height: CARD_H,
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0', fontFamily: 'system-ui, sans-serif',
      position: 'relative',
    }}>
      {/* Marca de agua opcional (editable): imagen PNG subida por el colegio
          (convertida a WebP), con posición/tamaño/opacidad 100% ajustables
          arrastrando el recuadro — o si no hay imagen, el texto de siempre
          como respaldo (centrado, no movible). */}
      {c.mostrarMarcaAgua && c.marcaAguaImagenUrl && (
        <Caja layout={layout} defaults={DEFAULT_LAYOUT} clave="marcaAgua" style={{ zIndex: 0, pointerEvents: 'none' }}>
          <img src={c.marcaAguaImagenUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: (c.marcaAguaOpacidad ?? 8) / 100 }} />
        </Caja>
      )}
      {c.mostrarMarcaAgua && !c.marcaAguaImagenUrl && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: 'rotate(-28deg)', opacity: (c.marcaAguaOpacidad ?? 8) / 100, pointerEvents: 'none', zIndex: 0,
        }}>
          <span style={{ fontSize: '2.6rem', fontWeight: 900, color: c.colorPrimario, whiteSpace: 'nowrap', letterSpacing: '0.1em' }}>
            {(c.textoMarcaAgua || 'ESTUDIANTE').repeat(3)}
          </span>
        </div>
      )}

      <div style={{ height: HEADER_H, background: `linear-gradient(135deg, ${c.colorPrimario}, ${c.colorPrimario}dd)`, padding: '0.5rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1, boxSizing: 'border-box' }}>
        {colegio?.logoUrl ? <img src={colegio.logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', background: '#fff' }} /> : <i className="bi bi-shield-fill" style={{ color: '#fff', fontSize: '1.2rem' }} />}
        <div style={{ color: '#fff', lineHeight: 1.1, flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{colegio?.nombre ?? 'Colegio'}</div>
          {c.lema && <div style={{ fontSize: '0.58rem', opacity: 0.85 }}>{c.lema}</div>}
        </div>
        <div style={{ textAlign: 'right', color: '#fff' }}>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.04em', opacity: 0.9 }}>CARNET DE ESTUDIANTE</div>
          <div style={{ display: 'inline-block', background: c.colorSecundario, fontSize: '0.62rem', fontWeight: 700, padding: '0px 8px', borderRadius: 3, marginTop: 1 }}>{anoActual}</div>
        </div>
      </div>

      {/* Cuerpo: todo lo de acá abajo es movible/redimensionable desde el editor */}
      <div style={{ position: 'absolute', left: 0, top: HEADER_H, right: 0, bottom: 22, zIndex: 1 }}>
        <Caja layout={layout} defaults={DEFAULT_LAYOUT} clave="foto">
          <div style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1' }}>
            {estudiante.fotoUrl
              ? <img src={estudiante.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#64748b' }}>{estudiante.nombres?.[0]}{estudiante.apellidos?.[0]}</span>}
          </div>
        </Caja>

        <Caja layout={layout} defaults={DEFAULT_LAYOUT} clave="datos">
          <div style={{ fontSize: '0.65rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: 3, height: '100%', justifyContent: 'center', overflow: 'hidden' }}>
            <div><span style={{ color: '#94a3b8' }}>NOMBRE COMPLETO</span><br /><strong style={{ fontSize: '0.72rem' }}>{estudiante.nombres} {estudiante.apellidos}</strong></div>
            <div><span style={{ color: '#94a3b8' }}>DNI</span> <strong>{estudiante.dni}</strong></div>
            <div><span style={{ color: '#94a3b8' }}>CÓDIGO</span> <strong style={{ fontFamily: 'monospace' }}>{estudiante.codigoQR?.slice(0, 12) ?? estudiante.id.slice(0, 10)}</strong></div>
          </div>
        </Caja>

        <Caja layout={layout} defaults={DEFAULT_LAYOUT} clave="qr">
          <div style={{ width: '100%', height: '100%', background: '#fff', border: '2px solid ' + c.colorPrimario, borderRadius: 8, padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            {qrUrl ? <img src={qrUrl} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null}
          </div>
        </Caja>

        <Caja layout={layout} defaults={DEFAULT_LAYOUT} clave="gradoBadge">
          <div style={{ width: '100%', height: '100%', background: c.colorPrimario, color: '#fff', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.56rem', opacity: 0.85 }}>GRADO</span>
            <span style={{ fontWeight: 800, fontSize: '0.78rem' }}>{gradoSeccion.grado}</span>
          </div>
        </Caja>

        {gradoSeccion.seccion && (
          <Caja layout={layout} defaults={DEFAULT_LAYOUT} clave="seccionBadge">
            <div style={{ width: '100%', height: '100%', background: c.colorSecundario, color: '#fff', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.56rem', opacity: 0.9 }}>SECCIÓN</span>
              <span style={{ fontWeight: 800, fontSize: '0.78rem' }}>{gradoSeccion.seccion}</span>
            </div>
          </Caja>
        )}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 22, background: '#f1f5f9', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', color: '#64748b', fontWeight: 600, zIndex: 1 }}>
        <i className="bi bi-calendar3 me-1" />AÑO ESCOLAR {anoActual}
      </div>
    </div>
  );
}

export function CarnetAtras({ estudiante, colegio, config, codigo, fechaNac, telefonoEmergencia, qrUrl }: any) {
  const c = { ...DEFAULT_CONFIG, ...config };
  const layout = { ...DEFAULT_LAYOUT_ATRAS, ...(c.layoutAtras ?? {}) };
  const infoImportante: string[] = (c.informacionImportante?.length ? c.informacionImportante : DEFAULT_CONFIG.informacionImportante)
    .map((linea: string) => linea.replace('{colegio}', colegio?.nombre ?? 'la institución').replace('{anio}', String(new Date().getFullYear())));
  return (
    <div className="carnet-tarjeta" style={{
      background: '#fff', borderRadius: 14, overflow: 'hidden', margin: '0 auto', width: CARD_W, height: CARD_H,
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0', fontFamily: 'system-ui, sans-serif',
      position: 'relative',
    }}>
      <div style={{ height: REVERSO_HEADER_H, background: `linear-gradient(135deg, ${c.colorPrimario}, ${c.colorPrimario}dd)`, padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxSizing: 'border-box' }}>
        {colegio?.logoUrl ? <img src={colegio.logoUrl} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover', background: '#fff' }} /> : <i className="bi bi-shield-fill" style={{ color: '#fff' }} />}
        <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.72rem' }}>{colegio?.nombre ?? 'Colegio'}</div>
      </div>

      {/* Todo lo de acá abajo es movible/redimensionable desde el editor,
          igual que en el anverso. */}
      <div style={{ position: 'absolute', left: 0, top: REVERSO_HEADER_H, right: 0, bottom: 22 }}>
        <Caja layout={layout} defaults={DEFAULT_LAYOUT_ATRAS} clave="datosAdicionales">
          <div style={{ fontSize: '0.62rem', color: '#334155', height: '100%', overflow: 'hidden' }}>
            <div style={{ fontWeight: 800, color: c.colorPrimario, fontSize: '0.64rem', marginBottom: '0.3rem' }}>DATOS ADICIONALES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 0.5rem' }}>
              <div><span style={{ color: '#94a3b8' }}>F. nacimiento</span><br /><strong>{fechaNac}</strong></div>
              {c.mostrarTipoSangre && <div><span style={{ color: '#94a3b8' }}>Tipo de sangre</span><br /><strong>{estudiante.tipoSangre ?? '—'}</strong></div>}
              {c.mostrarDireccionEstudiante && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#94a3b8' }}>Dirección</span><br /><strong>{estudiante.direccion ?? '—'}</strong></div>}
              <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#94a3b8' }}>Tel. emergencia</span><br /><strong>{telefonoEmergencia}</strong></div>
            </div>
          </div>
        </Caja>

        <Caja layout={layout} defaults={DEFAULT_LAYOUT_ATRAS} clave="infoImportante">
          <div style={{ fontSize: '0.58rem', color: '#334155', height: '100%', overflow: 'hidden' }}>
            <div style={{ fontWeight: 800, color: c.colorPrimario, fontSize: '0.64rem', marginBottom: '0.2rem' }}>INFORMACIÓN IMPORTANTE</div>
            <ul style={{ margin: 0, paddingLeft: '0.9rem', lineHeight: 1.35 }}>
              {infoImportante.slice(0, 4).map((l: string, i: number) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        </Caja>

        <Caja layout={layout} defaults={DEFAULT_LAYOUT_ATRAS} clave="verificacion">
          <div style={{ textAlign: 'center', height: '100%' }}>
            <div style={{ fontWeight: 700, color: c.colorPrimario, fontSize: '0.58rem' }}>VERIFICACIÓN</div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 3, margin: '3px auto 0', width: '80%', aspectRatio: '1' }}>
              {qrUrl ? <img src={qrUrl} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null}
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, background: `${c.colorSecundario}22`, color: c.colorSecundario, display: 'inline-block', padding: '0 4px', borderRadius: 3, marginTop: 3, fontSize: '0.54rem' }}>{codigo.slice(0, 12)}</div>
          </div>
        </Caja>

        {/* Firma: la imagen (si hay) va ARRIBA de la línea, nombre/cargo van
            ABAJO de la línea — ese es el orden correcto de un bloque de
            firma (antes la imagen quedaba debajo de la línea, al revés). */}
        {(c.nombreDirector || c.firmaImagenUrl) && (
          <Caja layout={layout} defaults={DEFAULT_LAYOUT_ATRAS} clave="firma">
            <div style={{ width: '100%', textAlign: 'center' }}>
              {c.firmaImagenUrl && (
                <img src={c.firmaImagenUrl} alt="Firma" style={{ height: 30, maxWidth: '100%', objectFit: 'contain', margin: '0 auto', display: 'block' }} />
              )}
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: 2, marginTop: c.firmaImagenUrl ? 2 : 0 }}>
                {!c.firmaImagenUrl && c.nombreDirector && <div style={{ fontSize: '0.56rem', fontStyle: 'italic', fontFamily: 'cursive' }}>{c.nombreDirector}</div>}
                {c.firmaImagenUrl && c.nombreDirector && <div style={{ fontSize: '0.54rem', fontWeight: 600 }}>{c.nombreDirector}</div>}
                <div style={{ fontSize: '0.5rem', color: '#94a3b8' }}>{c.cargoDirector}</div>
              </div>
            </div>
          </Caja>
        )}
      </div>

      {c.mostrarDireccionColegio && (colegio?.direccion || colegio?.telefono) && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 22, background: '#f1f5f9', padding: '0 0.8rem', fontSize: '0.56rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{colegio.direccion}</span>
          <span>{colegio.telefono}</span>
        </div>
      )}
    </div>
  );
}
