'use client';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useData } from '../../../hooks/useApi';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DocenteDashboard() {
  const { data, isLoading } = useData<any>('/dashboard/docente');
  const d = data?.data;
  const kpis = [
    { label: 'Alumnos asignados', value: d?.totalAlumnos ?? 0, icon: 'bi-people', tone: '#2563eb' },
    { label: 'Aulas a cargo', value: d?.totalAulas ?? 0, icon: 'bi-door-open', tone: '#7c3aed' },
    { label: 'Cursos asignados', value: d?.totalCursos ?? 0, icon: 'bi-journal-bookmark', tone: '#059669' },
    { label: 'Clases de hoy', value: d?.horarioHoy?.length ?? 0, icon: 'bi-calendar2-check', tone: '#d97706' },
  ];
  return <DashboardLayout title="Panel Docente" allowedRoles={['DOCENTE','AUXILIAR','TUTOR','COORDINADOR']}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 12, marginBottom: 16 }}>
      {kpis.map((k,i) => <motion.div key={k.label} className="sige-card" initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.05 }} style={{ display:'flex',alignItems:'center',gap:12,padding:16 }}>
        <span style={{ width:42,height:42,borderRadius:12,display:'grid',placeItems:'center',background:`${k.tone}18`,color:k.tone }}><i className={`bi ${k.icon}`} /></span>
        <div><strong style={{ display:'block',fontSize:22 }}>{isLoading ? '—' : k.value}</strong><small style={{ color:'var(--text-muted)' }}>{k.label}</small></div>
      </motion.div>)}
    </div>
    <div style={{ display:'grid',gridTemplateColumns:'minmax(0,1.5fr) minmax(280px,1fr)',gap:16,marginBottom:16 }}>
      <section className="sige-card">
        <h2 style={{ fontSize:15,margin:'0 0 4px' }}>Asistencia de mis aulas</h2><p style={{ fontSize:12,color:'var(--text-muted)',margin:'0 0 16px' }}>Tendencia de los últimos siete días.</p>
        <ResponsiveContainer width="100%" height={250}><AreaChart data={d?.asistenciaSemana ?? []}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)"/><XAxis dataKey="fecha" tick={{fontSize:11}}/><YAxis allowDecimals={false} tick={{fontSize:11}}/><Tooltip/><Legend wrapperStyle={{fontSize:11}}/>
          <Area type="monotone" dataKey="presente" name="Presentes" stroke="#16a34a" fill="#16a34a22" strokeWidth={2}/>
          <Area type="monotone" dataKey="tardanza" name="Tardanzas" stroke="#d97706" fill="#d9770614" strokeWidth={2}/>
          <Area type="monotone" dataKey="ausente" name="Ausentes" stroke="#dc2626" fill="#dc262614" strokeWidth={2}/>
        </AreaChart></ResponsiveContainer>
      </section>
      <section className="sige-card">
        <h2 style={{ fontSize:15,margin:'0 0 14px' }}>Agenda de hoy</h2>
        {(d?.horarioHoy ?? []).length ? d.horarioHoy.map((h:any) => <div key={h.id} style={{ display:'grid',gridTemplateColumns:'62px 1fr',gap:10,padding:'9px 0',borderBottom:'1px solid var(--border-color)' }}>
          <strong style={{ color:'var(--accent)',fontSize:12 }}>{h.horaInicio}</strong><div><b style={{fontSize:13}}>{h.curso?.nombre ?? h.materia}</b><small style={{display:'block',color:'var(--text-muted)'}}>{h.nivelGrado?.nombre}{h.seccion?.nombre ? ` · ${h.seccion.nombre}` : ''}</small></div>
        </div>) : <p style={{color:'var(--text-muted)',fontSize:13}}>No tienes clases programadas hoy.</p>}
      </section>
    </div>
    <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12 }}>
      {[['/docente/asistencia','bi-calendar-check','Tomar asistencia'],['/docente/notas','bi-clipboard-data','Registrar notas'],['/docente/horarios','bi-calendar3','Ver horario'],['/docente/observaciones','bi-chat-square-text','Observaciones']].map(([href,icon,label]) => <Link key={href} href={href} className="sige-card" style={{textDecoration:'none',color:'var(--text-primary)',display:'flex',gap:10,alignItems:'center',padding:14}}><i className={`bi ${icon}`} style={{color:'var(--accent)'}}/><strong style={{fontSize:13}}>{label}</strong></Link>)}
    </div>
  </DashboardLayout>;
}
