// lib/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const api = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const colegioId = localStorage.getItem('sige-colegio-id');
    if (colegioId) config.headers['X-Colegio-Id'] = colegioId;
  }
  return config;
});

interface ErrorApi {
  error?: string;
  detalle?: Array<{ campo: string; mensaje: string }>;
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _sessionRetry?: boolean;
}

let refreshPromise: Promise<void> | null = null;

function limpiarSesionLocal() {
  localStorage.removeItem('sige-token'); // limpia sesiones de versiones anteriores
  localStorage.removeItem('sige-user');
  localStorage.removeItem('sige-colegio-id');
  localStorage.removeItem('sige-colegio-slug');
}

function estaEnPantallaPublicaDeAuth() {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/auth/login'
    || window.location.pathname.startsWith('/auth/recuperacion-')
    || /^\/colegio\/[^/]+\/login\/?$/.test(window.location.pathname);
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<ErrorApi>) => {
    const config = err.config as RetryConfig | undefined;
    const url = config?.url ?? '';
    const puedeRenovar = err.response?.status === 401
      && !!config
      && !config._sessionRetry
      && !url.includes('/auth/login')
      && !url.includes('/auth/refresh')
      && !url.includes('/auth/recuperacion-');

    if (puedeRenovar) {
      config._sessionRetry = true;
      try {
        refreshPromise ??= axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
          .then(() => undefined)
          .finally(() => { refreshPromise = null; });
        await refreshPromise;
        return api.request(config);
      } catch {
        // Continúa al cierre de sesión controlado de abajo.
      }
    }

    const detalle = err.response?.data?.detalle;
    // Si el backend envió el detalle campo-por-campo (validación Zod, código 422),
    // mostrarlo tal cual en vez del genérico "Datos de entrada inválidos" — el
    // usuario necesita saber EXACTAMENTE qué campo falló y por qué.
    const msg = detalle?.length
      ? detalle.map(d => `• ${d.campo || 'campo'}: ${d.mensaje}`).join('\n')
      : err.response?.data?.error ?? err.message;

    const esColegioBloqueado = err.response?.status === 403 &&
      (msg?.includes('suspendido') || msg?.includes('inactivo') || msg?.includes('licencia') || msg?.includes('venció'));

    if (err.response?.status === 401 || esColegioBloqueado) {
      const slug = typeof window !== 'undefined' ? localStorage.getItem('sige-colegio-slug') : null;
      limpiarSesionLocal();
      if (typeof window !== 'undefined') {
        // /auth/me devuelve 401 normalmente cuando se abre el login sin sesión.
        // No se debe redirigir al mismo URL: eso produciría una recarga infinita.
        if (!estaEnPantallaPublicaDeAuth()) {
          toast.error(msg);
          window.location.replace(slug ? `/colegio/${slug}/login` : '/auth/login');
        }
      }
      return Promise.reject(err);
    }
    if (err.response?.status !== 404) toast.error(msg, detalle?.length ? { duration: 9000 } : undefined);
    return Promise.reject(err);
  },
);

export default api;

// fetcher devuelve body completo: { ok, data, meta }
// Los componentes acceden con:  hookData?.data  y  hookData?.meta
export async function fetcher<T = any>(url: string): Promise<T> {
  const res = await api.get<T>(url);
  return res.data;
}
