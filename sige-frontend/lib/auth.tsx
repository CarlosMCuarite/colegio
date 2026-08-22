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
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isRole: (...roles: string[]) => boolean;
  updateUser: (patch: Partial<AuthUser>) => void;
}

const Ctx = createContext<AuthCtx>({
  user: null, token: null, loading: true,
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
  const [token, setToken]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedToken = localStorage.getItem('sige-token');
    const savedUser  = localStorage.getItem('sige-user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try { setUser(JSON.parse(savedUser)); } catch {}

      // Resincroniza en segundo plano con el backend. Esto corrige sesiones
      // guardadas por una versión anterior del frontend cuyo JSON cacheado
      // no tenía campos nuevos (como colegio.slug) — sin esto, una sesión
      // vieja queda atascada para siempre porque hasta el logout depende
      // del slug, y el usuario nunca podría refrescarlo cerrando sesión.
      api.get('/auth/me')
        .then(res => {
          const fresco = res.data?.data;
          if (!fresco) return;
          setUser(prev => {
            const actualizado = { ...prev, ...fresco };
            localStorage.setItem('sige-user', JSON.stringify(actualizado));
            if (fresco.colegio?.slug) localStorage.setItem('sige-colegio-slug', fresco.colegio.slug);
            return actualizado;
          });
        })
        .catch(() => {}); // si falla (token vencido, etc.) el interceptor 401 ya maneja el logout
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ ok: boolean; token: string; refreshToken: string; usuario: AuthUser }>(
      '/auth/login', { email, password }
    );
    const { token: tk, usuario } = res.data;
    localStorage.setItem('sige-token',     tk);
    localStorage.setItem('sige-user',      JSON.stringify(usuario));
    localStorage.setItem('sige-colegio-id', usuario.colegio?.id ?? '');
    if (usuario.colegio?.slug) localStorage.setItem('sige-colegio-slug', usuario.colegio.slug);
    setToken(tk);
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
    localStorage.clear();
    setToken(null);
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
    <Ctx.Provider value={{ user, token, loading, login, logout, isRole, updateUser }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
