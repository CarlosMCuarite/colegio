'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const DEFINICIONES: Record<string, { nombre: string; unidad: string }> = {
  asistencia_qr: { nombre: 'Asistencia registrada por QR', unidad: '%' },
  morosidad: { nombre: 'Morosidad', unidad: '%' },
  tiempo_notificacion_asistencia: { nombre: 'Tiempo de notificación', unidad: 'min' },
  notas_consultadas: { nombre: 'Notas consultadas', unidad: '%' },
  tiempo_notas: { nombre: 'Tiempo de consulta de notas', unidad: 'horas' },
};

const fmt = (v: any) => v == null ? '—' : Number(v).toLocaleString('es-PE', { maximumFractionDigits: 2 });

export default function TesisPage() {
  const { data: colegiosResp } = useData<any>('/colegios');
  const colegios = Array.isArray(colegiosResp?.data) ? colegiosResp.data : [];
  const [colegioId, setColegioId] = useState('');
  const [indicador, setIndicador] = useState('asistencia_qr');
  const [valorAntes, setValorAntes] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<any[]>([]);
  const [analisis, setAnalisis] = useState<any[]>([]);
  const [metodologia, setMetodologia] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!colegioId && colegios[0]?.id) setColegioId(colegios[0].id); }, [colegios, colegioId]);

  const cargar = async () => {
    if (!colegioId) return;
    setLoading(true);
    try {
      const [l, a] = await Promise.all([api.get('/tesis/lineas-base', { params: { colegioId } }), api.get('/tesis/analisis', { params: { colegioId } })]);
      setLineas(l.data.data ?? []); setAnalisis(a.data.data ?? []); setMetodologia(a.data.metodologia ?? '');
    } finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, [colegioId]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colegioId || valorAntes === '') return;
    await api.post('/tesis/lineas-base', { colegioId, indicador, valorAntes: Number(valorAntes), unidad: DEFINICIONES[indicador].unidad, observaciones: observaciones || null });
    setValorAntes(''); setObservaciones(''); toast.success('Observación de línea base registrada'); await cargar();
  };
  const eliminar = async (id: string) => { await api.delete(`/tesis/lineas-base/${id}`); await cargar(); };
  const chart = useMemo(() => analisis.map(x => ({ nombre: x.nombre.replace('Asistencias registradas por QR', 'Asistencia QR').replace('Tiempo de notificación al padre', 'Notificación'), Antes: x.valorAntes, Después: x.valorDespues })), [analisis]);

  return <DashboardLayout title="Tesis · Medición de impacto" allowedRoles={['SUPERADMIN']}>
    <div className="tesis-shell">
      <section className="tesis-hero">
        <div><span className="tesis-eyebrow">ANÁLISIS PREEXPERIMENTAL</span><h2>Impacto medible de SIGE</h2><p>Compara la línea base con datos operativos reales, sin utilizar registros de auditoría.</p></div>
        <label>Colegio<select value={colegioId} onChange={e => setColegioId(e.target.value)}>{colegios.map((c:any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      </section>

      <div className="tesis-grid">
        <form className="tesis-card tesis-form" onSubmit={guardar}>
          <div className="tesis-card-title"><i className="bi bi-database-add"/><div><b>Registrar línea base</b><small>Agrega una fila por observación “antes”.</small></div></div>
          <label>Indicador<select value={indicador} onChange={e => setIndicador(e.target.value)}>{Object.entries(DEFINICIONES).map(([k,v]) => <option value={k} key={k}>{v.nombre}</option>)}</select></label>
          <div className="tesis-input-row"><label>Valor antes<input type="number" step="any" required value={valorAntes} onChange={e => setValorAntes(e.target.value)}/></label><label>Unidad<input value={DEFINICIONES[indicador].unidad} disabled/></label></div>
          <label>Observación<textarea rows={3} maxLength={500} value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Fuente, fecha o contexto de la medición"/></label>
          <button className="tesis-primary" disabled={loading}><i className="bi bi-plus-lg"/> Guardar observación</button>
        </form>
        <section className="tesis-card tesis-chart"><div className="tesis-card-title"><i className="bi bi-bar-chart-line"/><div><b>Antes vs. después</b><small>Promedios por indicador y unidad.</small></div></div>
          <ResponsiveContainer width="100%" height={280}><BarChart data={chart} margin={{left:0,right:10,bottom:34}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="nombre" angle={-18} textAnchor="end" height={62} fontSize={11}/><YAxis fontSize={11}/><Tooltip/><Legend/><Bar dataKey="Antes" fill="#94a3b8" radius={[5,5,0,0]}/><Bar dataKey="Después" fill="var(--accent)" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer>
        </section>
      </div>

      <section className="tesis-card">
        <div className="tesis-card-title"><i className="bi bi-clipboard-data"/><div><b>Resultados e inferencia</b><small>{metodologia}</small></div><button className="tesis-refresh" onClick={cargar} disabled={loading}><i className={`bi bi-arrow-clockwise ${loading?'spin':''}`}/> Calcular efecto</button></div>
        <div className="tesis-results">{analisis.map((x:any) => <motion.article initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} key={x.indicador} className="tesis-result">
          <header><span>{x.nombre}</span><em className={x.mejora===true?'good':x.mejora===false?'bad':''}>{x.mejora==null?'Sin comparación':x.mejora?'Mejora':'Revisar'}</em></header>
          <div className="tesis-values"><div><small>Antes</small><strong>{fmt(x.valorAntes)} {x.unidad}</strong></div><i className="bi bi-arrow-right"/><div><small>Después real</small><strong>{fmt(x.valorDespues)} {x.unidad}</strong></div></div>
          {x.prueba ? <p><b>Wilcoxon:</b> W={fmt(x.prueba.estadistico)}, p={Number(x.prueba.pValor).toFixed(4)} · {x.prueba.significativo?'diferencia estadísticamente significativa':'sin evidencia suficiente de diferencia'} (n={x.prueba.n}).</p> : <p className="tesis-warning"><i className="bi bi-info-circle"/> {x.advertencia}</p>}
        </motion.article>)}</div>
      </section>

      <section className="tesis-card"><div className="tesis-card-title"><i className="bi bi-list-check"/><div><b>Observaciones registradas</b><small>{lineas.length} mediciones de línea base.</small></div></div>
        <div className="tesis-table"><table><thead><tr><th>Indicador</th><th>Valor</th><th>Observación</th><th>Fecha</th><th/></tr></thead><tbody>{lineas.map((l:any)=><tr key={l.id}><td>{DEFINICIONES[l.indicador]?.nombre??l.indicador}</td><td><b>{fmt(l.valorAntes)} {l.unidad}</b></td><td>{l.observaciones||'—'}</td><td>{new Date(l.createdAt).toLocaleDateString('es-PE')}</td><td><button aria-label="Eliminar observación" onClick={()=>eliminar(l.id)}><i className="bi bi-trash3"/></button></td></tr>)}</tbody></table></div>
      </section>
    </div>
    <style jsx>{`
      .tesis-shell{display:grid;gap:18px;padding-bottom:28px}.tesis-hero{display:flex;align-items:end;justify-content:space-between;gap:24px;padding:26px 28px;border-radius:18px;background:linear-gradient(125deg,var(--accent-strong),var(--accent));color:white;box-shadow:0 12px 30px color-mix(in srgb,var(--accent) 22%,transparent)}.tesis-hero h2{margin:4px 0;font-size:1.65rem}.tesis-hero p{margin:0;opacity:.82}.tesis-eyebrow{font-size:.7rem;font-weight:800;letter-spacing:.12em}.tesis-hero label{min-width:260px;font-size:.75rem;font-weight:700}.tesis-hero select{display:block;width:100%;margin-top:6px;background:white;color:#172033;border:0;border-radius:10px;padding:11px}.tesis-grid{display:grid;grid-template-columns:minmax(290px,380px) 1fr;gap:18px}.tesis-card{background:white;border:1px solid #dbe4f0;border-radius:16px;padding:20px;box-shadow:0 5px 16px rgba(15,23,42,.055)}.tesis-card-title{display:flex;align-items:center;gap:11px;margin-bottom:18px}.tesis-card-title>i{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:var(--accent-soft);color:var(--accent);font-size:1.05rem}.tesis-card-title div{display:grid}.tesis-card-title small{color:#64748b;margin-top:2px}.tesis-form label{display:block;font-size:.78rem;font-weight:700;color:#334155;margin-bottom:13px}.tesis-form input,.tesis-form select,.tesis-form textarea{display:block;width:100%;margin-top:6px;border:1px solid #cbd5e1;border-radius:10px;padding:10px 11px;background:#fff;color:#0f172a}.tesis-input-row{display:grid;grid-template-columns:1fr 100px;gap:10px}.tesis-primary,.tesis-refresh{border:0;border-radius:10px;background:var(--accent);color:var(--school-on-accent,#fff);padding:10px 15px;font-weight:750;cursor:pointer}.tesis-refresh{margin-left:auto}.tesis-results{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.tesis-result{border:1px solid #e2e8f0;border-radius:12px;padding:14px}.tesis-result header{display:flex;justify-content:space-between;gap:8px;font-weight:700}.tesis-result em{font-size:.68rem;font-style:normal;border-radius:999px;padding:4px 8px;background:#f1f5f9}.tesis-result em.good{background:#dcfce7;color:#166534}.tesis-result em.bad{background:#fee2e2;color:#991b1b}.tesis-values{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:15px 0}.tesis-values div{display:grid}.tesis-values small,.tesis-result p{color:#64748b;font-size:.73rem}.tesis-values strong{font-size:1rem}.tesis-warning{background:#fff7ed;padding:8px;border-radius:8px}.tesis-table{overflow:auto}.tesis-table table{width:100%;border-collapse:collapse;font-size:.8rem}.tesis-table th,.tesis-table td{text-align:left;padding:11px;border-bottom:1px solid #e2e8f0}.tesis-table th{color:#64748b;font-size:.69rem;text-transform:uppercase}.tesis-table button{border:0;background:#fee2e2;color:#b91c1c;border-radius:8px;padding:7px;cursor:pointer}@media(max-width:850px){.tesis-hero{align-items:stretch;flex-direction:column}.tesis-hero label{min-width:0}.tesis-grid{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    `}</style>
  </DashboardLayout>;
}
