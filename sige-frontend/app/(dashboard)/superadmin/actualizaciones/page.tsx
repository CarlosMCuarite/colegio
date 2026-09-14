'use client';
import { FormEvent, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import api, { fetcher } from '../../../../lib/api';

export default function ActualizacionesPage() {
  const { data, mutate, isLoading } = useSWR<any>('/actualizaciones', fetcher);
  const [saving, setSaving] = useState(false);
  async function publicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      await api.post('/actualizaciones', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 });
      toast.success('Actualización publicada para Android');
      e.currentTarget.reset(); await mutate();
    } finally { setSaving(false); }
  }
  const releases = data?.data ?? [];
  return <DashboardLayout title="Actualizaciones de la aplicación" allowedRoles={['SUPERADMIN']}>
    <div className="enterprise-page">
      <section className="enterprise-card" style={{ padding: 24 }}>
        <div className="enterprise-section-title"><div><span>Android privado</span><h3>Publicar una versión de SIGE</h3></div><p>Los celulares detectarán la versión y solicitarán confirmación antes de instalar.</p></div>
        <form onSubmit={publicar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, marginTop: 20 }}>
          <label>Versión<input required name="version" className="sige-input" placeholder="1.1.0" /></label>
          <label>Número de compilación<input required name="build" type="number" min="1" className="sige-input" /></label>
          <label>Versión mínima<input name="versionMinima" className="sige-input" placeholder="Opcional" /></label>
          <label>Archivo APK<input required name="apk" type="file" accept=".apk,application/vnd.android.package-archive" className="sige-input" /></label>
          <label style={{ gridColumn: '1/-1' }}>Novedades<textarea required minLength={5} name="notas" className="sige-input" rows={4} /></label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="obligatoria" value="true" /> Actualización obligatoria</label>
          <button className="btn-primary" disabled={saving}>{saving ? 'Publicando…' : 'Publicar actualización'}</button>
        </form>
      </section>
      <section className="enterprise-card" style={{ padding: 24, marginTop: 20 }}>
        <h3>Historial</h3>
        {isLoading ? <p>Cargando versiones…</p> : releases.length === 0 ? <p>Aún no hay versiones publicadas.</p> : releases.map((r: any) =>
          <article key={r.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <strong>v{r.version} · build {r.build}</strong> {r.activa && <span className="badge badge-success">Activa</span>}
            <p>{r.notas}</p><small>SHA-256: {r.sha256}</small>
          </article>)}
      </section>
    </div>
  </DashboardLayout>;
}
