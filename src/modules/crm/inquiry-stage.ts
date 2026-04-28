export const INQUIRY_STAGE_VALUES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "QUOTED",
  "WON",
  "LOST",
] as const;

export const INQUIRY_SOURCE_VALUES = [
  "INSTAGRAM",
  "TIKTOK",
  "SNAPCHAT",
  "WHATSAPP",
  "GOOGLE",
  "REFERRAL",
  "WALK_IN",
  "OTHER",
] as const;

export type InquiryStage = (typeof INQUIRY_STAGE_VALUES)[number];
export type InquirySource = (typeof INQUIRY_SOURCE_VALUES)[number];

export const OPEN_INQUIRY_STAGE_VALUES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "QUOTED",
] as const satisfies InquiryStage[];

export const INQUIRY_STAGE_LABELS: Record<InquiryStage, string> = {
  NEW: "جديد",
  CONTACTED: "تم التواصل",
  QUALIFIED: "مؤهل",
  QUOTED: "تم تقديم عرض سعر",
  WON: "تم الفوز",
  LOST: "خسارة",
};

export const INQUIRY_SOURCE_LABELS: Record<InquirySource, string> = {
  INSTAGRAM: "إنستغرام",
  TIKTOK: "تيك توك",
  SNAPCHAT: "سناب شات",
  WHATSAPP: "واتساب",
  GOOGLE: "جوجل",
  REFERRAL: "إحالة",
  WALK_IN: "زيارة مباشرة",
  OTHER: "أخرى",
};
