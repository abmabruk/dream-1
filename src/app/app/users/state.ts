export type UserAdminActionState = {
  error: string | null;
  message: string | null;
};

export const initialUserAdminActionState: UserAdminActionState = {
  error: null,
  message: null,
};
