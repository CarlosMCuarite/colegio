'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function VerificarCarnetPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    fetch(`${base}/public/carnet/${encodeURIComponent(codigo)}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.data; })
      .then(setData).catch(e => setError(e.message || 'No se pudo verificar el carnet'));
  }, [codigo]);
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f7fb', fontFamily: 'system-ui' }}>
    <section style={{ width: 'min(440px,100%)', background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 18px 60px rgba(15,23,42,.12)', textAlign: 'center' }}>
      {!data && !error && <><div className="spinner-border" /><p>Verificando carnet…</p></>}
      {error && <><i className="bi bi-x-circle" style={{ fontSize: 46, color: '#dc2626' }} /><h1 style={{ fontSize: 21 }}>Carnet no válido</h1><p style={{ color: '#64748b' }}>{error}</p></>}
      {data && <>
        <i className="bi bi-patch-check-fill" style={{ fontSize: 48, color: '#16a34a' }} />
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Carnet SIGE verificado</h1>
        <p style={{ color: '#64748b', marginTop: 0 }}>{data.colegio?.nombre}</p>
        {data.fotoUrl && <img src={data.fotoUrl} alt="Foto del estudiante" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '4px solid #e2e8f0' }} />}
        <h2 style={{ fontSize: 18 }}>{data.nombres} {data.apellidos}</h2>
        <p>{data.matriculas?.[0]?.nivelGrado?.nombre ?? 'Sin matrícula'} {data.matriculas?.[0]?.seccion?.nombre ? `· Sección ${data.matriculas[0].seccion.nombre}` : ''}</p>
        <span style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 99, background: data.estado === 'ACTIVO' ? '#dcfce7' : '#fee2e2', color: data.estado === 'ACTIVO' ? '#166534' : '#991b1b', fontWeight: 700 }}>{data.estado}</span>
      </>}
    </section>
  </main>;
}
