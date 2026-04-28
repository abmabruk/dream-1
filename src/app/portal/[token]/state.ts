export type PortalApprovalActionState = {
  error: string | null;
  success: string | null;
};

export const initialPortalApprovalActionState: PortalApprovalActionState = {
  error: null,
  success: null,
};
