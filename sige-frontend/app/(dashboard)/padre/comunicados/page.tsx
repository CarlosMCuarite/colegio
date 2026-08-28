'use client';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useComunicados } from '../../../../hooks/useApi';

export default function ComunicadosPadrePage() {
  const { data, isLoading } = useComunicados('limit=30');
  const comunicados = (data as any)?.data ?? [];
  return (
    <DashboardLayout title="Comunicados" allowedRoles={['PADRE']}>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
      ) : comunicados.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-megaphone" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />Sin comunicados
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {comunicados.map((c: any) => (
            <div key={c.id} className="sige-card">
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="bi bi-megaphone" style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{c.titulo}</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 8px' }}>{c.contenido}</p>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                    <span><i className="bi bi-person me-1" />{c.creadoPor?.nombres}</span>
                    <span><i className="bi bi-calendar me-1" />{new Date(c.createdAt).toLocaleDateString('es-PE')}</span>
                    {c.adjuntoUrl && <a href={c.adjuntoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}><i className="bi bi-paperclip me-1" />Adjunto</a>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
