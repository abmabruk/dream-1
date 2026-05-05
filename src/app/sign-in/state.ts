export type SignInActionState = {
  error: string | null;
  requires2fa?: boolean;
  redirect?: string | null;
};

export const initialSignInActionState: SignInActionState = {
  error: null,
  requires2fa: false,
  redirect: null,
};

export type Totp2faActionState = {
  error: string | null;
};

export const initialTotp2faActionState: Totp2faActionState = {
  error: null,
};
