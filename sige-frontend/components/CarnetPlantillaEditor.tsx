'use client';
// components/CarnetPlantillaEditor.tsx
//
// Editor de la plantilla del carnet. DashboardLayout envuelve TODO desde
// afuera (así useAuth() funciona), y hay DOS modos de edición visual —
// anverso y reverso — donde se puede arrastrar/agrandar cada elemento
// (incluyendo la marca de agua) como un editor tipo Canva.
import { useEffect, useState } from 'react';
import { Rnd } from 'react-rnd';
import DashboardLayout from './layout/DashboardLayout';
import { useAuth } from '../lib/auth';
import { useData, useMutation } from '../hooks/useApi';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  CarnetFrente, CarnetAtras, CARD_W, CARD_H,
  DEFAULT_LAYOUT, DEFAULT_LAYOUT_ATRAS, HEADER_H, REVERSO_HEADER_H,
} from './CarnetEstudiante';
import { QrUploader } from './QrUploader';

const ESTUDIANTE_EJEMPLO = {
  id: 'ejemplo-0001', nombres: 'Juan Carlos', apellidos: 'Pérez García', dni: '12345678',
  codigoQR: 'EST-000124-EJEMPLO', fotoUrl: null, tipoSangre: 'O+', direccion: 'Jr. Los Álamos 123, Urb. Santa Anita',
  matriculas: [{ nivelGrado: { nombre: '2° Secundaria' }, seccion: { nombre: 'A' } }],
};

const ELEMENTOS_FRENTE: { clave: string; label: string; icon: string; condicion?: (f: any) => boolean }[] = [
  { clave: 'foto',         label: 'Foto',         icon: 'bi-person-square' },
  { clave: 'datos',        label: 'Nombre / DNI', icon: 'bi-card-text' },
  { clave: 'qr',           label: 'QR',           icon: 'bi-qr-code' },
  { clave: 'gradoBadge',   label: 'Grado',        icon: 'bi-mortarboard' },
  { clave: 'seccionBadge', label: 'Sección',      icon: 'bi-bookmark' },
  { clave: 'marcaAgua',    label: 'Marca de agua', icon: 'bi-image', condicion: (f) => f.mostrarMarcaAgua && !!f.marcaAguaImagenUrl },
];

const ELEMENTOS_ATRAS: { clave: string; label: string; icon: string }[] = [
  { clave: 'datosAdicionales', label: 'Datos adicionales', icon: 'bi-card-list' },
  { clave: 'infoImportante',   label: 'Información importante', icon: 'bi-info-circle' },
  { clave: 'verificacion',     label: 'QR verificación', icon: 'bi-qr-code' },
  { clave: 'firma',            label: 'Firma', icon: 'bi-pen' },
];

export default function CarnetPlantillaEditor() {
  return (
    <DashboardLayout title="Diseñador de carnet" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      <Contenido />
    </DashboardLayout>
  );
}

function Contenido() {
  const { user } = useAuth();
  const esSuperAdmin = user?.rol === 'SUPERADMIN';
  const [colegioIdSeleccionado, setColegioIdSeleccionado] = useState<string>('');
  const { data: listaColegios } = useData<any>(esSuperAdmin ? '/colegios?limit=200' : null);
  const colegioId = esSuperAdmin ? colegioIdSeleccionado : (user?.colegio?.id ?? '');

  if (!user) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner-border spinner-border-sm" /></div>;
  }

  if (esSuperAdmin && !colegioIdSeleccionado) {
    const colegios = listaColegios?.data ?? [];
    return (
      <div className="sige-card" style={{ maxWidth: 420 }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem' }}>
          <i className="bi bi-building me-2" />¿Qué colegio quieres editar?
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Como SuperAdmin no perteneces a un colegio específico — elige de cuál
          colegio quieres editar la plantilla del carnet.
        </p>
        <select className="sige-input" defaultValue="" onChange={e => setColegioIdSeleccionado(e.target.value)}>
          <option value="" disabled>Selecciona un colegio...</option>
          {colegios.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
    );
  }

  return <EditorPlantilla colegioId={colegioId} user={user} volverASeleccionar={esSuperAdmin ? () => setColegioIdSeleccionado('') : undefined} />;
}

type ModoEdicion = 'ninguno' | 'frente' | 'atras';

function EditorPlantilla({ colegioId, user, volverASeleccionar }: { colegioId: string; user: any; volverASeleccionar?: () => void }) {
  const { data, error, isLoading, mutate } = useData<any>(colegioId ? `/colegios/${colegioId}/carnet-config` : null);
  const { loading: saving, mutate: save } = useMutation();

  const [form, setForm] = useState<any>(null);
  const [modo, setModo] = useState<ModoEdicion>('ninguno');
  const [elementoActivo, setElementoActivo] = useState<string | null>(null);
  useEffect(() => { setForm(null); }, [colegioId]);
  // La API responde { ok, data }. Usar el sobre completo hacía que el editor
  // ignorara la configuración guardada y enviara una estructura inválida.
  useEffect(() => { if (data && !form) setForm((data as any).data ?? {}); }, [data, form]);

  if (error) {
    return (
      <div className="sige-card" style={{ textAlign: 'center', padding: '2.5rem', color: '#991b1b' }}>
        <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
        No se pudo cargar la plantilla del carnet.
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
          Si acabas de actualizar el sistema, corre <code>npx prisma generate</code> en el backend y reinícialo.
        </div>
        <button onClick={() => mutate()} className="btn-accent" style={{ marginTop: '1rem' }}><i className="bi bi-arrow-clockwise me-1" />Reintentar</button>
      </div>
    );
  }

  if (isLoading || !colegioId || !form) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner-border spinner-border-sm" /></div>;
  }

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const setLinea = (i: number, v: string) => {
    const lineas = [...(form.informacionImportante ?? [])];
    lineas[i] = v;
    set('informacionImportante', lineas);
  };
  const agregarLinea = () => set('informacionImportante', [...(form.informacionImportante ?? []), '']);
  const quitarLinea = (i: number) => set('informacionImportante', (form.informacionImportante ?? []).filter((_: any, idx: number) => idx !== i));

  // BUG REAL encontrado: esto antes leía `form.layout` directo del closure
  // del render actual. Si arrastrabas/redimensionabas varios recuadros
  // rápido (antes de que React re-renderizara entre uno y otro), cada
  // llamada partía de una versión VIEJA del layout y el cambio anterior se
  // perdía sin avisar (condición de carrera). Se arregla usando la forma
  // funcional de setState, que siempre parte del estado más reciente.
  //
  // Además: se redondea y se recorta (clamp) cada valor a 0-100 antes de
  // guardarlo. Sin esto, arrastrar un recuadro hasta el borde podía dar un
  // porcentaje con error de coma flotante (ej. 100.00000004) que el backend
  // rechazaba de forma silenciosa (guardaba un error 400 que quizás no se
  // notaba) — eso también hacía que "no se guardara nada" en esa sesión.
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 100) / 100));
  const setBoxPx = (layoutKey: 'layout' | 'layoutAtras', clave: string, defaults: any, xPx: number, yPx: number, wPx: number, hPx: number, editableHeight: number) => {
    setForm((f: any) => {
      const layout = { ...(f[layoutKey] ?? defaults) };
      layout[clave] = {
        xPct: clamp((xPx / CARD_W) * 100),
        yPct: clamp((yPx / editableHeight) * 100),
        wPct: clamp((wPx / CARD_W) * 100),
        hPct: clamp((hPx / editableHeight) * 100),
      };
      return { ...f, [layoutKey]: layout };
    });
  };

  const guardar = async () => {
    await save(async () => {
      const { __colegioNombre, __colegioLogoUrl, __colegioDireccion, __colegioTelefono, ...configurable } = form;
      await api.patch(`/colegios/${colegioId}/carnet-config`, configurable);
      toast.success('Plantilla de carnet guardada — ya se aplica a todos los carnets');
      await mutate();
    });
  };

  const subirImagen = async (campo: 'firmaImagenUrl' | 'marcaAguaImagenUrl', file: File) => {
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      fd.append('campo', campo);
      const res = await api.post(`/colegios/${colegioId}/carnet-config/imagen`, fd);
      setForm((f: any) => ({ ...f, [campo]: res.data.data[campo] }));
      toast.success('Imagen actualizada');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo subir la imagen');
    }
  };

  const colegioPreview = {
    id: colegioId,
    nombre: form.__colegioNombre ?? user?.colegio?.nombre ?? 'Colegio',
    logoUrl: form.__colegioLogoUrl ?? user?.colegio?.logoUrl,
    direccion: form.__colegioDireccion,
    telefono: form.__colegioTelefono,
  };
  const anoActual = new Date().getFullYear();
  const layoutFrente = { ...DEFAULT_LAYOUT, ...(form.layout ?? {}) };
  const layoutAtras  = { ...DEFAULT_LAYOUT_ATRAS, ...(form.layoutAtras ?? {}) };
  const elementosFrenteVisibles = ELEMENTOS_FRENTE.filter(el => !el.condicion || el.condicion(form));

  return (
    <>
      <section className="carnet-editor-intro">
        <div>
          <h2>Diseña la identidad estudiantil</h2>
          <p>Configura una plantilla institucional para todos los estudiantes. Revisa ambos lados antes de guardar.</p>
        </div>
        <span className="carnet-editor-status"><i className="bi bi-lightning-charge-fill" /> Vista previa en vivo</span>
        {volverASeleccionar && (
          <button onClick={volverASeleccionar} className="carnet-editor-secondary-action">
            <i className="bi bi-arrow-left me-1" />Cambiar de colegio
          </button>
        )}
      </section>

      <div className="carnet-editor-grid">
        {/* ── Formulario ── */}
        <div className="sige-card carnet-editor-controls" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="carnet-editor-section-title"><i className="bi bi-palette2" /><span>Identidad visual<small>Colores y mensaje institucional</small></span></div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <label className="sige-label">Color primario</label>
              <input type="color" value={form.colorPrimario ?? '#1e3a8a'} onChange={e => set('colorPrimario', e.target.value)} style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="sige-label">Color secundario</label>
              <input type="color" value={form.colorSecundario ?? '#dc2626'} onChange={e => set('colorSecundario', e.target.value)} style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer' }} />
            </div>
          </div>

          <div>
            <label className="sige-label">Lema (aparece bajo el nombre del colegio)</label>
            <input type="text" className="sige-input" maxLength={60} placeholder='Ej: "Formamos mejores personas"' value={form.lema ?? ''} onChange={e => set('lema', e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="carnet-editor-section-title"><i className="bi bi-eye" /><span>Datos visibles<small>Elige la información del reverso</small></span></div>
            <label className="sige-check"><input type="checkbox" checked={form.mostrarDireccionEstudiante ?? true} onChange={e => set('mostrarDireccionEstudiante', e.target.checked)} /> Mostrar dirección del estudiante</label>
            <label className="sige-check"><input type="checkbox" checked={form.mostrarTipoSangre ?? false} onChange={e => set('mostrarTipoSangre', e.target.checked)} /> Mostrar tipo de sangre <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>(no esencial, apagado por defecto)</span></label>
            <label className="sige-check"><input type="checkbox" checked={form.mostrarDireccionColegio ?? true} onChange={e => set('mostrarDireccionColegio', e.target.checked)} /> Mostrar dirección/teléfono del colegio (pie de página)</label>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <div className="carnet-editor-section-title"><i className="bi bi-layers" /><span>Marca de agua<small>Protección e identidad del colegio</small></span></div>
            <label className="sige-check"><input type="checkbox" checked={form.mostrarMarcaAgua ?? false} onChange={e => set('mostrarMarcaAgua', e.target.checked)} /> Marca de agua de fondo</label>
            {form.mostrarMarcaAgua && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <QrUploader label="Imagen de marca de agua (PNG)" urlActual={form.marcaAguaImagenUrl} onSubir={file => subirImagen('marcaAguaImagenUrl', file)} />
                {!form.marcaAguaImagenUrl && (
                  <input type="text" className="sige-input" maxLength={20} placeholder="O un texto, ej: ESTUDIANTE" value={form.textoMarcaAgua ?? ''} onChange={e => set('textoMarcaAgua', e.target.value)} />
                )}
                <div>
                  <label className="sige-label">Contraste / visibilidad ({form.marcaAguaOpacidad ?? 8}%)</label>
                  <input type="range" min={1} max={40} value={form.marcaAguaOpacidad ?? 8} onChange={e => set('marcaAguaOpacidad', Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                {form.marcaAguaImagenUrl && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                    Para mover o agrandar la imagen, usa "Editar posiciones del anverso" más abajo — ahí aparece como un recuadro más para arrastrar.
                  </p>
                )}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="carnet-editor-section-title"><i className="bi bi-vector-pen" /><span>Firma institucional<small>Responsable que valida el carnet</small></span></div>
            <QrUploader label="Firma del director (imagen)" urlActual={form.firmaImagenUrl} onSubir={file => subirImagen('firmaImagenUrl', file)} />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label className="sige-label">Firma — Nombre</label>
                <input type="text" className="sige-input" maxLength={80} placeholder="Mg. Carlos Andrade R." value={form.nombreDirector ?? ''} onChange={e => set('nombreDirector', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="sige-label">Cargo</label>
                <input type="text" className="sige-input" maxLength={60} placeholder="Director" value={form.cargoDirector ?? ''} onChange={e => set('cargoDirector', e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="carnet-editor-section-title"><i className="bi bi-bounding-box-circles" /><span>Composición<small>Mueve y redimensiona cada elemento</small></span></div>
            <button type="button" onClick={() => setModo(m => m === 'frente' ? 'ninguno' : 'frente')}
              style={{ width: '100%', background: modo === 'frente' ? 'var(--accent)' : 'var(--bg-secondary)', color: modo === 'frente' ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.55rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              <i className="bi bi-arrows-move me-1" />{modo === 'frente' ? 'Listo — salir del anverso' : 'Editar posiciones del anverso'}
            </button>
            <button type="button" onClick={() => setModo(m => m === 'atras' ? 'ninguno' : 'atras')}
              style={{ width: '100%', background: modo === 'atras' ? 'var(--accent)' : 'var(--bg-secondary)', color: modo === 'atras' ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.55rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              <i className="bi bi-arrows-move me-1" />{modo === 'atras' ? 'Listo — salir del reverso' : 'Editar posiciones del reverso'}
            </button>
            {modo !== 'ninguno' && (
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
                Arrastra cualquier recuadro en la vista previa para moverlo, o jala su esquina para agrandarlo/achicarlo.
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {form.layout && <button type="button" onClick={() => set('layout', null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.74rem' }}><i className="bi bi-arrow-counterclockwise me-1" />Anverso por defecto</button>}
              {form.layoutAtras && <button type="button" onClick={() => set('layoutAtras', null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.74rem' }}><i className="bi bi-arrow-counterclockwise me-1" />Reverso por defecto</button>}
            </div>
          </div>

          <div>
            <div className="carnet-editor-section-title"><i className="bi bi-card-checklist" /><span>Indicaciones<small>Mensajes impresos en el reverso</small></span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="sige-label" style={{ margin: 0 }}>Información importante (reverso)</label>
              <button type="button" onClick={agregarLinea} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}><i className="bi bi-plus-lg me-1" />Agregar línea</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {(form.informacionImportante ?? []).map((linea: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '0.4rem' }}>
                  <input type="text" className="sige-input" maxLength={140} value={linea} onChange={e => setLinea(i, e.target.value)} />
                  <button type="button" onClick={() => quitarLinea(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><i className="bi bi-trash" /></button>
                </div>
              ))}
              {(!form.informacionImportante || form.informacionImportante.length === 0) && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sin líneas — se usará el texto por defecto.</span>
              )}
            </div>
          </div>

          <button className="btn-accent" onClick={guardar} disabled={saving} style={{ marginTop: '0.5rem' }}>
            {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check-lg me-1" />Guardar plantilla</>}
          </button>
        </div>

        {/* ── Vista previa en vivo ── */}
        <div className="carnet-editor-preview-panel">
          <div className="carnet-editor-preview-block">
            <div style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
              Anverso (vista previa){modo === 'frente' && <span style={{ color: 'var(--accent)' }}> — arrastra los recuadros</span>}
            </div>
            {modo === 'frente' ? (
              <EditorVisual
                Componente={CarnetFrente} elementos={elementosFrenteVisibles} layout={layoutFrente} defaults={DEFAULT_LAYOUT}
                layoutKey="layout" setBoxPx={setBoxPx} elementoActivo={elementoActivo} setElementoActivo={setElementoActivo}
                estudiante={ESTUDIANTE_EJEMPLO} colegio={colegioPreview} config={form}
                extra={{ gradoSeccion: { grado: '2° Secundaria', seccion: 'A' }, anoActual, qrUrl: null }}
              />
            ) : (
              <CarnetFrente estudiante={ESTUDIANTE_EJEMPLO} colegio={colegioPreview} config={form}
                gradoSeccion={{ grado: '2° Secundaria', seccion: 'A' }} anoActual={anoActual} qrUrl={null} />
            )}
          </div>
          <div className="carnet-editor-preview-block">
            <div style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
              Reverso (vista previa){modo === 'atras' && <span style={{ color: 'var(--accent)' }}> — arrastra los recuadros</span>}
            </div>
            {modo === 'atras' ? (
              <EditorVisual
                Componente={CarnetAtras} elementos={ELEMENTOS_ATRAS} layout={layoutAtras} defaults={DEFAULT_LAYOUT_ATRAS}
                layoutKey="layoutAtras" setBoxPx={setBoxPx} elementoActivo={elementoActivo} setElementoActivo={setElementoActivo}
                estudiante={ESTUDIANTE_EJEMPLO} colegio={colegioPreview} config={form}
                extra={{ codigo: ESTUDIANTE_EJEMPLO.codigoQR, fechaNac: '15/04/2013', telefonoEmergencia: '987 654 321', qrUrl: null }}
              />
            ) : (
              <CarnetAtras estudiante={ESTUDIANTE_EJEMPLO} colegio={colegioPreview} config={form}
                codigo={ESTUDIANTE_EJEMPLO.codigoQR} fechaNac="15/04/2013" telefonoEmergencia="987 654 321" qrUrl={null} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Overlay de edición visual: dibuja los recuadros arrastrables sobre el
// carnet REAL (con el contenido "escondido" via keys fuera de rango, para no
// tener contenido y recuadro superpuestos y confusos) ────────────────────────
function EditorVisual({ Componente, elementos, layout, defaults, layoutKey, setBoxPx, elementoActivo, setElementoActivo, estudiante, colegio, config, extra }: any) {
  const headerHeight = layoutKey === 'layout' ? HEADER_H : REVERSO_HEADER_H;
  const editableHeight = CARD_H - headerHeight - 22;
  const configOculto = {
    ...config,
    [layoutKey]: {
      ...layout,
      ...Object.fromEntries(elementos.map((el: any) => [el.clave, { xPct: -999, yPct: -999, wPct: 0.01, hPct: 0.01 }])),
    },
  };
  return (
    <div className="carnet-editor-canvas" style={{ position: 'relative', width: CARD_W, height: CARD_H, margin: '0 auto' }}>
      <Componente estudiante={estudiante} colegio={colegio} config={configOculto} {...extra} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: headerHeight, height: editableHeight }}>
      {elementos.map((el: any) => {
        const box = layout[el.clave] ?? defaults[el.clave];
        const xPx = (box.xPct / 100) * CARD_W;
        const yPx = (box.yPct / 100) * editableHeight;
        const wPx = (box.wPct / 100) * CARD_W;
        const hPx = (box.hPct / 100) * editableHeight;
        return (
          <Rnd
            key={el.clave}
            bounds="parent"
            size={{ width: wPx, height: hPx }}
            position={{ x: xPx, y: yPx }}
            onDragStart={() => setElementoActivo(el.clave)}
            onResizeStart={() => setElementoActivo(el.clave)}
            onDragStop={(_e: any, d: any) => setBoxPx(layoutKey, el.clave, defaults, d.x, d.y, wPx, hPx, editableHeight)}
            onResizeStop={(_e: any, _dir: any, ref: any, _delta: any, pos: any) => setBoxPx(layoutKey, el.clave, defaults, pos.x, pos.y, ref.offsetWidth, ref.offsetHeight, editableHeight)}
            style={{
              border: `2px dashed ${elementoActivo === el.clave ? 'var(--accent)' : 'rgba(79,70,229,0.5)'}`,
              borderRadius: 6,
              background: elementoActivo === el.clave ? 'rgba(79,70,229,0.18)' : 'rgba(79,70,229,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'move', zIndex: elementoActivo === el.clave ? 10 : 5,
            }}
          >
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--accent)', background: '#fff', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' }}>
              <i className={`bi ${el.icon} me-1`} />{el.label}
            </span>
          </Rnd>
        );
      })}
      </div>
    </div>
  );
}
