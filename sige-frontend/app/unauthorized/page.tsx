'use client';
// app/unauthorized/page.tsx
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</div>
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: 8 }}>Acceso no autorizado</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>No tienes permisos para acceder a esta sección.</p>
        <Link href="/auth/login" style={{ background: 'var(--accent)', color: '#fff', padding: '0.6rem 1.5rem', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
