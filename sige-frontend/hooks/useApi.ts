// hooks/useApi.ts
import useSWR, { mutate as revalidarGlobal, SWRConfiguration } from 'swr';
import { fetcher } from '../lib/api';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function useData<T>(url: string | null, opts?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR<T>(url, fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshWhenHidden: false,
    dedupingInterval: 2000,
    ...opts,
  });
  return { data, error, isLoading, mutate };
}

export function useMutation<TData = unknown>() {
  const [loading, setLoading] = useState(false);
  const mutate = async (
    fn: () => Promise<TData>,
    opts?: { successMsg?: string; errorMsg?: string },
  ): Promise<TData | null> => {
    setLoading(true);
    try {
      const result = await fn();
      // Toda mutación refresca inmediatamente las consultas visibles. Las
      // demás se mantienen al día mediante polling ligero cada 10 segundos.
      await revalidarGlobal(key => typeof key === 'string' && key.startsWith('/'), undefined, { revalidate: true });
      if (opts?.successMsg) toast.success(opts.successMsg);
      return result;
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? opts?.errorMsg ?? 'Error al procesar';
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };
  return { loading, mutate };
}

export const useEstudiantes        = (params = '') => useData<any>(`/estudiantes?${params}`);
export const usePadres             = (params = '') => useData<any>(`/padres?${params}`);
export const useMatriculas         = (params = '') => useData<any>(`/matriculas?${params}`);
export const useAsistencia         = (params = '') => useData<any>(`/asistencia?${params}`);
export const usePagos              = (params = '') => useData<any>(`/pagos?${params}`);
export const useConceptosPago      = (params = '') => useData<any>(`/conceptos-pago?${params}`);
export const usePagosLicencia      = (params = '') => useData<any>(`/pagos-licencia?${params}`);
export const useConfigPlataforma   = () => useData<any>('/plataforma/config');
export const useComunicados        = (params = '') => useData<any>(`/comunicados?${params}`, { keepPreviousData: true });
export const useEventos            = (params = '') => useData<any>(`/eventos?${params}`);
export const useEncuestas          = (params = '') => useData<any>(`/encuestas?${params}`);
export const useDashboardEjecutivo = () => useData<any>('/dashboard/ejecutivo');
export const useDashboardPadre     = () => useData<any>('/dashboard/padre');
export const useQRSesion           = () => useData<any>('/qr/sesion', { refreshInterval: 10000 });
export const useAuditoria          = (params = '') => useData<any>(`/auditoria?${params}`);
export const useMiPlan             = () => useData<any>('/membresias/mi-plan');
export const useNivelesGrados      = () => useData<any>('/aulas/niveles-grados');
export const useHorarios           = (params = '') => useData<any>(`/horarios?${params}`);
export const useUsuarios           = (params = '') => useData<any>(`/usuarios?${params}`);
