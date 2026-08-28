'use client';
// components/JsonViewer.tsx
// Visor de JSON de solo lectura: árbol colapsable, búsqueda y copiar.
// No permite editar ni reimportar — únicamente visualización.
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';

function coincide(valor: any, termino: string): boolean {
  if (!termino) return true;
  const t = termino.toLowerCase();
  try {
    return JSON.stringify(valor).toLowerCase().includes(t);
  } catch {
    return false;
  }
}

function Nodo({ nombre, valor, nivel, busqueda }: { nombre: string; valor: any; nivel: number; busqueda: string }) {
  const [abierto, setAbierto] = useState(nivel < 1 || !!busqueda);
  const esObjeto = valor !== null && typeof valor === 'object';
  const esArreglo = Array.isArray(valor);

  if (!coincide(valor, busqueda)) return null;

  if (!esObjeto) {
    const tipo = typeof valor;
    const color = tipo === 'string' ? '#16a34a' : tipo === 'number' ? '#2563eb' : tipo === 'boolean' ? '#d97706' : '#94a3b8';
    return (
      <div style={{ paddingLeft: nivel * 16, fontSize: '0.8rem', fontFamily: 'monospace', lineHeight: 1.7 }}>
        <span style={{ color: 'var(--text-muted)' }}>{nombre}: </span>
        <span style={{ color }}>{valor === null ? 'null' : JSON.stringify(valor)}</span>
      </div>
    );
  }

  const entradas: Array<[string, any]> = esArreglo
    ? valor.map((v: any, i: number): [string, any] => [String(i), v])
    : Object.entries(valor);
  const etiqueta = esArreglo ? `[ ${entradas.length} ]` : `{ ${entradas.length} }`;

  return (
    <div style={{ paddingLeft: nivel * 16 }}>
      <div
        onClick={() => setAbierto(a => !a)}
        style={{ cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.7, userSelect: 'none' }}
      >
        <i className={`bi ${abierto ? 'bi-caret-down-fill' : 'bi-caret-right-fill'}`} style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }} />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{nombre}</span>
        <span style={{ color: 'var(--text-muted)' }}>{etiqueta}</span>
      </div>
      {abierto && entradas.map(([k, v]: [string, any]) => (
        <Nodo key={k} nombre={k} valor={v} nivel={nivel + 1} busqueda={busqueda} />
      ))}
    </div>
  );
}

// Traduce nombres técnicos de columnas a etiquetas legibles para personal no
// técnico (director, secretaría). Si la clave no está en el diccionario, se
// intenta separar el camelCase en palabras ("fechaNacimiento" → "Fecha Nacimiento").
const ETIQUETAS: Record<string, string> = {
  id: 'ID', dni: 'DNI', email: 'Correo', telefono: 'Teléfono', celular: 'Celular',
  nombres: 'Nombres', apellidos: 'Apellidos', createdAt: 'Creado', updatedAt: 'Actualizado',
  fechaNacimiento: 'Fecha de nacimiento', fechaInicio: 'Fecha inicio', fechaFin: 'Fecha fin',
  colegioId: 'Colegio', nivelGrado: 'Grado', seccion: 'Sección', monto: 'Monto',
  estado: 'Estado', tipo: 'Tipo', titulo: 'Título', descripcion: 'Descripción',
  activo: 'Activo', rol: 'Rol', direccion: 'Dirección', genero: 'Género',
};

function etiquetaColumna(clave: string): string {
  if (ETIQUETAS[clave]) return ETIQUETAS[clave];
  const conEspacios = clave.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}

const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function formatearValor(v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'string' && REGEX_FECHA_ISO.test(v)) {
    const f = new Date(v);
    return isNaN(f.getTime()) ? v : f.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    if (v.every(x => x === null || typeof x !== 'object')) return v.join(', ');
    return `${v.length} elemento(s)`;
  }
  if (typeof v === 'object') {
    // Objetos anidados: si tienen un campo "nombre"/"nombres" úsalo, si no, resumir claves.
    if ('nombre' in v) return String(v.nombre);
    if ('nombres' in v) return `${v.nombres ?? ''} ${v.apellidos ?? ''}`.trim();
    const resumen = JSON.stringify(v);
    return resumen.length > 40 ? resumen.slice(0, 40) + '…' : resumen;
  }
  return String(v);
}

/** Tabla amigable para un arreglo de objetos (el caso típico de una exportación: N registros). */
function TablaAmigable({ filas, busqueda }: { filas: any[]; busqueda: string }) {
  const filtradas = useMemo(
    () => filas.filter(f => coincide(f, busqueda)),
    [filas, busqueda],
  );
  // Columnas: unión de claves de todos los registros, en el orden en que aparecen.
  const columnas = useMemo(() => {
    const claves: string[] = [];
    for (const f of filas) for (const k of Object.keys(f ?? {})) if (!claves.includes(k)) claves.push(k);
    return claves;
  }, [filas]);

  if (filtradas.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay registros que coincidan con la búsqueda.</div>;
  }

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead>
          <tr>
            {columnas.map(c => (
              <th key={c} style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', textAlign: 'left', padding: '0.5rem 0.6rem', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontWeight: 700 }}>
                {etiquetaColumna(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtradas.map((f, i) => (
            <tr key={f.id ?? i} style={{ borderBottom: '1px solid var(--border-color)' }}>
              {columnas.map(c => (
                <td key={c} style={{ padding: '0.5rem 0.6rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {formatearValor(f[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ficha amigable para un objeto suelto (p. ej. meta.json con datos generales de la exportación). */
function FichaAmigable({ objeto }: { objeto: Record<string, any> }) {
  const entradas = Object.entries(objeto ?? {});
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
      {entradas.map(([k, v]) => (
        <div key={k} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '0.6rem 0.75rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{etiquetaColumna(k)}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word' }}>{formatearValor(v)}</div>
        </div>
      ))}
    </div>
  );
}

export default function JsonViewer({ data, titulo, onClose }: { data: any; titulo: string; onClose: () => void }) {
  const [busqueda, setBusqueda] = useState('');
  const texto = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const esArregloDeObjetos = Array.isArray(data) && data.length > 0 && data.every(d => d && typeof d === 'object' && !Array.isArray(d));
  const esObjetoSuelto      = !Array.isArray(data) && data && typeof data === 'object';
  const hayVistaAmigable    = esArregloDeObjetos || esObjetoSuelto;
  const [modo, setModo] = useState<'amigable' | 'json'>(hayVistaAmigable ? 'amigable' : 'json');

  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    toast.success('Contenido copiado');
  };

  const descargar = () => {
    const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${titulo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sige-modal-overlay" style={{ zIndex: 1200 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sige-modal" style={{ maxWidth: 900, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>{titulo}</h3>
            <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>
              <i className="bi bi-lock me-1" />Archivo de solo lectura — no se puede reimportar
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {hayVistaAmigable && (
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <button onClick={() => setModo('amigable')}
              style={{ padding: '0.3rem 0.75rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                background: modo === 'amigable' ? 'var(--accent)' : 'var(--bg-secondary)', color: modo === 'amigable' ? '#fff' : 'var(--text-secondary)' }}>
              <i className="bi bi-table me-1" />Vista simple
            </button>
            <button onClick={() => setModo('json')}
              style={{ padding: '0.3rem 0.75rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                background: modo === 'json' ? 'var(--accent)' : 'var(--bg-secondary)', color: modo === 'json' ? '#fff' : 'var(--text-secondary)' }}>
              <i className="bi bi-code-slash me-1" />JSON avanzado
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }} />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar..."
              className="sige-input"
              style={{ paddingLeft: '2rem', fontSize: '0.82rem' }}
            />
          </div>
          <button onClick={copiar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0 0.75rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <i className="bi bi-clipboard me-1" />Copiar
          </button>
          <button onClick={descargar} className="btn-accent" style={{ fontSize: '0.8rem' }}>
            <i className="bi bi-download me-1" />Descargar
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.75rem' }}>
          {modo === 'amigable' && esArregloDeObjetos ? (
            <TablaAmigable filas={data} busqueda={busqueda} />
          ) : modo === 'amigable' && esObjetoSuelto ? (
            <FichaAmigable objeto={data} />
          ) : (
            <Nodo nombre="raíz" valor={data} nivel={0} busqueda={busqueda} />
          )}
        </div>
      </div>
    </div>
  );
}
