import { create } from 'zustand';

let nextToastId = 1;

export const useUiStore = create((set) => ({
  toasts: [],

  mostrarToast: ({ tipo = 'info', titulo, mensaje, duracion = 3500 }) => {
    const id = nextToastId++;
    set((state) => ({
      toasts: [...state.toasts, { id, tipo, titulo, mensaje }],
    }));

    if (duracion > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        }));
      }, duracion);
    }

    return id;
  },

  quitarToast: (id) => set((state) => ({
    toasts: state.toasts.filter((toast) => toast.id !== id),
  })),
}));
