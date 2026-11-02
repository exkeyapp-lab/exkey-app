// ==================== 基本身份 ====================

// 用戶基本身份（僅供顯示，配對邏輯不依賴這個欄位）
export type Role = "sales" | "vendor" | "both";

// 舊欄位型別（保留在資料庫但新演算法不使用）
export type ContactLevel = "junior" | "middle" | "senior";
export type Familiarity = "light" | "medium" | "deep";

// ==================== 層級（四層） ====================
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

// ==================== 一組人脈條件（找人脈／介紹人脈共用結構） ====================
export interface NetworkSide {
  industries: string[];       // 空陣列 = 不限
  regions: string[];          // 空陣列 = 不限
  departments: string[];      // 空陣列 = 不限（不含「其他」自填文字，見 customDepartment）
  customDepartment: string;   // 「其他」自行填寫的部門（選填）
  level: number;               // 0 = 不限；1~4 為層級
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

// 資料庫存的部門陣列 → 表單用的「已知清單 + 自填」
export function splitDepartments(list: string[] | null | undefined): { known: string[]; custom: string } {
  const known: string[] = [];
  const custom: string[] = [];
  (list || []).forEach((v) => (DEPARTMENTS.includes(v) ? known.push(v) : custom.push(v)));
  return { known, custom: custom.join("、") };
}

// ==================== 人脈案件：一個人可以登錄多筆 ====================
// kind = "seek" 找人脈（我想找什麼樣的關鍵人脈）
// kind = "offer" 介紹人脈（我能介紹什麼樣的關鍵人脈）
export type EntryKind = "seek" | "offer";

export interface NetworkEntry {
  id: string;
  profile_id: string;
  kind: EntryKind;
  industries: string[];
  regions: string[];
  departments: string[];
  level: number;            // 0 = 不限
  note: string | null;
  created_at: string;
}

export const ENTRY_COLUMNS = "id, profile_id, kind, industries, regions, departments, level, note, created_at";

export function kindLabel(k: EntryKind): string {
  return k === "seek" ? "找人脈" : "介紹人脈";
}

// 資料庫的一筆案件 → 表單結構
export function entryToSide(e: NetworkEntry): NetworkSide {
  const dep = splitDepartments(e.departments);
  return {
    industries: e.industries || [],
    regions: e.regions || [],
    departments: dep.known,
    customDepartment: dep.custom,
    level: e.level || 0,
    note: e.note || "",
  };
}

// 表單結構 → 要送進 save_entry 的內容
export function sideToPayload(kind: EntryKind, side: NetworkSide, id?: string | null) {
  return {
    id: id || null,
    kind,
    industries: side.industries,
    regions: side.regions,
    departments: mergedDepartments(side),
    level: side.level || 0,
    note: side.note.trim() || null,
  };
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

  // 舊的單筆條件欄位（已改為人脈案件表，這些欄位保留但不再使用）
  offer_industries: string[];
  offer_regions: string[];
  offer_departments: string[];
  offer_level: number | null;
  offer_note: string | null;
  has_offer: boolean;
  seek_industries: string[];
  seek_regions: string[];
  seek_departments: string[];
  seek_level: number | null;
  seek_note: string | null;

  // 更舊的欄位（保留在資料庫，不使用）
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

// ==================== 註冊過程中暫存的資料 ====================
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
export const PUBLIC_PROFILE_COLUMNS =
  "id, user_id, name, company, bio, role, is_verified, is_active, created_at";

export interface PublicProfile {
  id: string;
  user_id: string | null;
  name: string;
  company: string | null;
  bio: string | null;
  role: Role;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}
