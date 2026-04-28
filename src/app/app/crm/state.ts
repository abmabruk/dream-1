export type InquiryActionState = {
  error: string | null;
  success: string | null;
};

export const initialInquiryActionState: InquiryActionState = {
  error: null,
  success: null,
};
