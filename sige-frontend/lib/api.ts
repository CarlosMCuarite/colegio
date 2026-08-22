// lib/api.ts
import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token     = localStorage.getItem('sige-token');
    const colegioId = localStorage.getItem('sige-colegio-id');
    if (token)     config.headers.Authorization = `Bearer ${token}`;
    if (colegioId) config.headers['X-Colegio-Id'] = colegioId;
  }
  return config;
});

interface ErrorApi {
  error?: string;
  detalle?: Array<{ campo: string; mensaje: string }>;
}

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<ErrorApi>) => {
    const detalle = err.response?.data?.detalle;
    // Si el backend envió el detalle campo-por-campo (validación Zod, código 422),
    // mostrarlo tal cual en vez del genérico "Datos de entrada inválidos" — el
    // usuario necesita saber EXACTAMENTE qué campo falló y por qué.
    const msg = detalle?.length
      ? detalle.map(d => `• ${d.campo || 'campo'}: ${d.mensaje}`).join('\n')
      : err.response?.data?.error ?? err.message;

    const esColegioBloqueado = err.response?.status === 403 &&
      (msg?.includes('suspendido') || msg?.includes('inactivo'));

    if (err.response?.status === 401 || esColegioBloqueado) {
      const slug = typeof window !== 'undefined' ? localStorage.getItem('sige-colegio-slug') : null;
      localStorage.removeItem('sige-token');
      localStorage.removeItem('sige-user');
      localStorage.removeItem('sige-colegio-id');
      localStorage.removeItem('sige-colegio-slug');
      if (typeof window !== 'undefined') {
        toast.error(msg);
        window.location.href = slug ? `/colegio/${slug}/login` : '/auth/login';
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
