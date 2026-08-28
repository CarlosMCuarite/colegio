'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';
import toast from 'react-hot-toast';

export interface AuthUser {
  id: string;
  nombres: string;
  apellidos: string;
  email: string;
  rol: string;
  telefono?: string | null;
  avatarUrl?: string;
  colegio?: {
    id: string;
    nombre: string;
    logoUrl?: string;
    estado: string;
    slug?: string;
    whatsappNumero?: string;
    whatsappMensaje?: string;
  };
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isRole: (...roles: string[]) => boolean;
  updateUser: (patch: Partial<AuthUser>) => void;
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true,
  login: async () => {}, logout: async () => {}, isRole: () => false,
  updateUser: () => {},
});

const DESTINOS: Record<string, string> = {
  SUPERADMIN:    '/superadmin',
  ADMINISTRADOR: '/admin',
  DIRECTOR:      '/director',
  SECRETARIA:    '/secretaria',
  DOCENTE:       '/docente',
  PADRE:         '/padre',
  AUXILIAR:      '/auxiliar',
  PSICOLOGO:     '/psicologo',
  COORDINADOR:   '/docente',
  TUTOR:         '/docente',
  CONTADOR:      '/contador',
  ENFERMERIA:    '/enfermeria',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedUser  = localStorage.getItem('sige-user');
    if (savedUser) try { setUser(JSON.parse(savedUser)); } catch {}
    localStorage.removeItem('sige-token');

    // La cookie HttpOnly es la fuente de verdad y JavaScript no puede leerla.
    // /auth/me también renueva automáticamente una sesión cuyo access token venció.
    api.get('/auth/me')
      .then(res => {
        const fresco = res.data?.data;
        if (!fresco) return;
        setUser(fresco);
        localStorage.setItem('sige-user', JSON.stringify(fresco));
        localStorage.setItem('sige-colegio-id', fresco.colegio?.id ?? '');
        if (fresco.colegio?.slug) localStorage.setItem('sige-colegio-slug', fresco.colegio.slug);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ ok: boolean; usuario: AuthUser }>(
      '/auth/login', { email, password }
    );
    const { usuario } = res.data;
    localStorage.setItem('sige-user',      JSON.stringify(usuario));
    localStorage.setItem('sige-colegio-id', usuario.colegio?.id ?? '');
    if (usuario.colegio?.slug) localStorage.setItem('sige-colegio-slug', usuario.colegio.slug);
    setUser(usuario);
    const destino = DESTINOS[usuario.rol] ?? '/admin';
    router.push(destino);
    toast.success(`Bienvenido/a, ${usuario.nombres}!`);
  }, [router]);

  const logout = useCallback(async () => {
    // Fuente de verdad al momento exacto del logout: se consulta /auth/me
    // ANTES de limpiar nada, sin depender de que la sincronización en segundo
    // plano del montaje ya haya terminado, ni de que el objeto `user` en
    // memoria esté actualizado. Si esta llamada falla (token ya vencido, sin
    // red, etc.) se cae en cascada a las otras dos fuentes disponibles.
    let slug: string | null | undefined = null;
    try {
      const res = await api.get('/auth/me');
      slug = res.data?.data?.colegio?.slug;
    } catch { /* seguir con los fallbacks */ }
    if (!slug) slug = user?.colegio?.slug;
    if (!slug) slug = localStorage.getItem('sige-colegio-slug');

    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('sige-token');
    localStorage.removeItem('sige-user');
    localStorage.removeItem('sige-colegio-id');
    localStorage.removeItem('sige-colegio-slug');
    setUser(null);
    // Los usuarios de un colegio vuelven a SU login, no al login global
    router.push(slug ? `/colegio/${slug}/login` : '/auth/login');
    toast.success('Sesión cerrada');
  }, [router, user]);

  const isRole = useCallback((...roles: string[]) => !!user && roles.includes(user.rol), [user]);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem('sige-user', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, logout, isRole, updateUser }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
