// 用戶身份類型
export type Role = "sales" | "vendor" | "both";

// 聯絡層級
export type ContactLevel = "junior" | "middle" | "senior";

// 熟悉度
export type Familiarity = "light" | "medium" | "deep";

// 用戶 Profile 的完整結構
export interface Profile {
  id: string;
  user_id: string | null;
  created_at: string;
  name: string;
  company: string | null;
  bio: string | null;
  line_id: string | null;
  role: Role;
  industries: string[];
  regions: string[];
  target_clients: string[];
  contact_level: ContactLevel;
  familiarity: Familiarity;
  my_level: string | null;
  seeking_levels: string[];
  view_count: number;
  interest_count: number;
  match_count: number;
  is_active: boolean;
  is_verified: boolean;
}

// Onboarding 過程中暫存的資料
export interface OnboardingData {
  role: Role | "";
  industries: string[];
  regions: string[];
  name: string;
  company: string;
  bio: string;
  my_level: string;
  seeking_levels: string[];
  line_id: string;
}

// 產業選項
export const INDUSTRIES = [
  "半導體", "電子製造", "面板", "醫療器材",
  "食品", "化工材料", "機械設備", "消費品", "其他"
];

// 地區選項
export const REGIONS = [
  "台北", "新北", "桃園", "新竹",
  "台中", "台南", "高雄", "全台"
];

// 職級選項（精簡 6 層）
export const LEVELS = [
  "負責人 / 高階主管",
  "協理 / 處長 / 廠長",
  "經理 / 副理",
  "課長 / 主任 / 組長",
  "工程師 / 專員",
  "其他"
];
