export type UpdateSettingsActionState = {
  error: string | null;
  message: string | null;
};

export const initialSettingsActionState: UpdateSettingsActionState = {
  error: null,
  message: null,
};
