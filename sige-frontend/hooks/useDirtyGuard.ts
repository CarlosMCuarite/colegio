// hooks/useDirtyGuard.ts
import { useCallback, useState } from 'react';

/**
 * Protege un modal con formulario para que un clic afuera o la tecla Escape
 * no cierren el modal perdiendo lo escrito. Si hay cambios sin guardar,
 * muestra una confirmación antes de cerrar.
 *
 * Uso:
 *   const { confirmClose, ConfirmDialog } = useDirtyGuard(isDirty, onReallyClose);
 *   <div onClick={e => { if (e.target === e.currentTarget) confirmClose(); }}>
 *   <ConfirmDialog />
 */
export function useDirtyGuard(isDirty: boolean, onClose: () => void) {
  const [showConfirm, setShowConfirm] = useState(false);

  const confirmClose = useCallback(() => {
    if (isDirty) setShowConfirm(true);
    else onClose();
  }, [isDirty, onClose]);

  const salirSinGuardar = useCallback(() => {
    setShowConfirm(false);
    onClose();
  }, [onClose]);

  const cancelarSalida = useCallback(() => setShowConfirm(false), []);

  return { confirmClose, showConfirm, salirSinGuardar, cancelarSalida };
}
