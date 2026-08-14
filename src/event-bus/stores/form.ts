import { create } from "zustand";

export const useFormStore = create((set) => ({
  forms: {},

  setValue: (form: string, field: string, value: any) =>
    set((state:any) => ({
      forms: {
        ...state.forms,
        [form]: {
          ...state.forms[form],
          [field]: value,
        },
      },
    })),

  reset: (form: string) =>
    set((state:any) => ({
      forms: {
        ...state.forms,
        [form]: {},
      },
    })),
}));