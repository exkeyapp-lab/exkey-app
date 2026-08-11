// ==================== 基本身份 ====================

// 用戶基本身份（僅供顯示，配對邏輯不再依賴這個欄位）
export type Role = "sales" | "vendor" | "both";

// 舊欄位型別（保留在資料庫但新演算法不使用）
export type ContactLevel = "junior" | "middle" | "senior";
export type Familiarity = "light" | "medium" | "deep";

// ==================== 職級（四層） ====================
// 4=高階主管, 3=經理級, 2=課長級, 1=專員級, 0=不限
export const JOB_LEVELS = [
  { value: 4, label: "高階主管", desc: "董事長、總經理、總監等高階主管" },
  { value: 3, label: "經理級", desc: "經理、副理、廠長等中高層" },
  { value: 2, label: "課長級", desc: "課長、主任、組長等基層主管" },
  { value: 1, label: "專員級", desc: "專員、工程師、技術員等一般職" },
] as const;

export function levelLabel(lv: number | null | undefined): string {
  const found = JOB_LEVELS.find((l) => l.value === lv);
  return found ? found.label : "";
}

// ==================== 部門別（精簡版，不含「不限」「其他」） ====================
export const DEPARTMENTS = [
  "經營管理", "業務", "採購", "研發", "生產製造", "製程",
  "設備", "品保", "工程", "廠務", "自動化", "資訊", "財務",
];

// ==================== 產業 / 地區（沿用既有清單） ====================
export const INDUSTRIES = [
  "半導體", "電子製造", "面板", "醫療器材",
  "食品", "化工材料", "機械設備", "消費品", "其他"
];

export const REGIONS = [
  "台北", "新北", "桃園", "新竹",
  "台中", "台南", "高雄", "全台"
];

// ==================== 烏龜配對模型：一組人脈資料（提供側／想找側共用結構） ====================
export interface NetworkSide {
  industries: string[];       // 空陣列 = 不限
  regions: string[];          // 空陣列 = 不限
  departments: string[];      // 空陣列 = 不限（不含「其他」自填文字，見 customDepartment）
  customDepartment: string;   // 「其他」自行填寫的部門（選填）
  level: number;               // 0 = 不限；1~4 為門檻（該職級以上皆符合）
  note: string;                // 一句話說明（選填）
}

export function emptyNetworkSide(): NetworkSide {
  return { industries: [], regions: [], departments: [], customDepartment: "", level: 0, note: "" };
}

// 把 customDepartment 併入 departments，回傳最終要存進資料庫的部門陣列
export function mergedDepartments(side: NetworkSide): string[] {
  const custom = side.customDepartment.trim();
  return custom ? [...side.departments, custom] : side.departments;
}

// ==================== 用戶 Profile 的完整結構 ====================
export interface Profile {
  id: string;
  user_id: string | null;
  created_at: string;
  name: string;
  company: string | null;
  bio: string | null;
  line_id: string | null;
  role: Role;

  // 提供側（公龜：我能介紹的人脈）
  offer_industries: string[];
  offer_regions: string[];
  offer_departments: string[];
  offer_level: number | null;
  offer_note: string | null;
  has_offer: boolean;

  // 想找側（母龜：我想找的人脈）
  seek_industries: string[];
  seek_regions: string[];
  seek_departments: string[];
  seek_level: number | null;
  seek_note: string | null;

  // 舊欄位（保留在資料庫，但新演算法不使用）
  industries: string[];
  regions: string[];
  target_clients: string[];
  contact_level: ContactLevel;
  familiarity: Familiarity;
  level: number | null;
  seeking_level: number | null;

  view_count: number;
  interest_count: number;
  match_count: number;
  is_active: boolean;
  is_verified: boolean;
}

// ==================== Onboarding 過程中暫存的資料 ====================
export interface OnboardingData {
  role: Role | "";
  name: string;
  company: string;
  bio: string;
  seek: NetworkSide;
  hasOffer: boolean;
  offer: NetworkSide;
  line_id: string;
}

export function emptyOnboardingData(): OnboardingData {
  return {
    role: "",
    name: "",
    company: "",
    bio: "",
    seek: emptyNetworkSide(),
    hasOffer: false,
    offer: emptyNetworkSide(),
    line_id: "",
  };
}
// ==================== 公開查詢用（不含 line_id） ====================
// discover 頁改用逐欄查詢，line_id 不再隨整包資料送到瀏覽器
export const PUBLIC_PROFILE_COLUMNS =
  "id, name, company, bio, role, has_offer, is_verified, is_active, " +
  "offer_industries, offer_regions, offer_departments, offer_level, " +
  "seek_industries, seek_regions, seek_departments, seek_level";

export type PublicProfile = Omit<Profile, "line_id">;
