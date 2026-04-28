export type OrderStatusActionState = {
  error: string | null;
  success: string | null;
};

export type AssignmentActionState = {
  error: string | null;
  success: string | null;
};

export type PortalAccessActionState = {
  error: string | null;
  success: string | null;
};

export const initialOrderStatusActionState: OrderStatusActionState = {
  error: null,
  success: null,
};

export const initialAssignmentActionState: AssignmentActionState = {
  error: null,
  success: null,
};

export const initialPortalAccessActionState: PortalAccessActionState = {
  error: null,
  success: null,
};
