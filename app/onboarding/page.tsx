"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  INDUSTRIES,
  REGIONS,
  DEPARTMENTS,
  JOB_LEVELS,
  type OnboardingData,
  type Role,
  emptyOnboardingData,
  mergedDepartments,
} from "@/lib/types";

const SITE_URL = "https://exkey-app.vercel.app";
const DRAFT_KEY = "exkey_pending_profile";
const REF_KEY = "exkey_ref";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StepKey =
  | "role"
  | "basic"
  | "seek_industry"
  | "seek_region"
  | "seek_department"
  | "seek_level"
  | "offer_intro"
  | "offer_industry"
  | "offer_region"
  | "offer_department"
  | "offer_level"
  | "line_id";

const BASE_STEPS: StepKey[] = [
  "role",
  "basic",
  "seek_industry",
  "seek_region",
  "seek_department",
  "seek_level",
  "offer_intro",
];
const OFFER_STEPS: StepKey[] = [
  "offer_industry",
  "offer_region",
  "offer_department",
  "offer_level",
];
const FINAL_STEPS: StepKey[] = ["line_id"];

const STEP_TITLES: Record<StepKey, string> = {
  role: "選擇身份",
  basic: "基本資料",
  seek_industry: "想找的產業",
  seek_region: "想找的地區",
  seek_department: "想找的部門",
  seek_level: "想找的職級",
  offer_intro: "你能介紹的人脈",
  offer_industry: "提供的產業",
  offer_region: "提供的地區",
  offer_department: "提供的部門",
  offer_level: "提供的職級",
  line_id: "聯絡方式與帳號",
};

// 驗證前暫存在瀏覽器的草稿：點完驗證信回來時自動建檔，不用重填
interface Draft {
  data: OnboardingData;
  ref: string;
  ts: number;
}
function saveDraft(data: OnboardingData, ref: string) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, ref, ts: Date.now() } as Draft));
  } catch {}
}
function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || !d.data || Date.now() - d.ts > DRAFT_TTL_MS) return null;
    return d;
  } catch {
    return null;
  }
}
function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(REF_KEY);
  } catch {}
}

// 資料庫存的部門陣列 → 表單用的「已知清單 + 自填」
function splitDepartments(list: string[] | null | undefined): { known: string[]; custom: string } {
  const known: string[] = [];
  const custom: string[] = [];
  (list || []).forEach((v) => (DEPARTMENTS.includes(v) ? known.push(v) : custom.push(v)));
  return { known, custom: custom.join("、") };
}

// 共用的「多選 + 不限」欄位（產業／地區／部門 皆用這個畫面元件）
function DimensionPicker({
  title,
  subtitle,
  options,
  selected,
  onToggle,
  onClear,
  extra,
}: {
  title: string;
  subtitle: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-sm text-gray-500 mb-6">{subtitle}</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onClear}
          className={`px-4 py-2 rounded-full text-sm transition ${
            selected.length === 0
              ? "bg-purple-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:border-purple-400"
          }`}
        >
          不限
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={`px-4 py-2 rounded-full text-sm transition ${
              selected.includes(opt)
                ? "bg-purple-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-purple-400"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {extra}
      <p className="text-sm text-gray-500 mt-4">
        {selected.length === 0 ? "目前設定：不限" : `已選擇 ${selected.length} 項`}
      </p>
    </div>
  );
}

// 共用的「職級」畫面元件
function LevelPicker({
  title,
  subtitle,
  level,
  onSelect,
  extra,
}: {
  title: string;
  subtitle: string;
  level: number;
  onSelect: (v: number) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-sm text-gray-500 mb-6">{subtitle}</p>
      <div className="space-y-3">
        <button
          onClick={() => onSelect(0)}
          className={`w-full text-left p-4 rounded-xl border transition ${
            level === 0
              ? "border-purple-600 bg-purple-100"
              : "border-gray-200 bg-white hover:border-purple-400"
          }`}
        >
          <div className="font-semibold text-gray-900">不限</div>
          <div className="text-sm text-gray-500">不確定或不設門檻</div>
        </button>
        {JOB_LEVELS.map((lv) => (
          <button
            key={lv.value}
            onClick={() => onSelect(lv.value)}
            className={`w-full text-left p-4 rounded-xl border transition ${
              level === lv.value
                ? "border-purple-600 bg-purple-100"
                : "border-gray-200 bg-white hover:border-purple-400"
            }`}
          >
            <div className="font-semibold text-gray-900">{lv.label}</div>
            <div className="text-sm text-gray-500">{lv.desc}</div>
          </button>
        ))}
      </div>
      {extra}
    </div>
  );
}

// 自由補充欄：勾選框表達不了的細節（例：我認識台積電採購課長、台塑廠務經理）
function NoteBox({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <p className="text-xs text-gray-400 mb-2">選填。上面的選項不夠用時，這裡可以自由寫，其他會員看得到</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={200}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none text-sm resize-none"
      />
      <p className="text-xs text-gray-400 mt-1 text-right">{value.length} / 200</p>
    </div>
  );
}

type Phase = "form" | "pending_confirm" | "activating";

export default function Onboarding() {
  const router = useRouter();
  const supabase = createClient();
  const [data, setData] = useState<OnboardingData>(emptyOnboardingData());
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [fromInvite, setFromInvite] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [resent, setResent] = useState(false);

  // 進頁面時：
  //   1. 網址帶 ?ref=推薦碼 就記起來
  //   2. 已登入且已有檔案 → ?edit=1 進編輯模式，否則回會員專區
  //   3. 已登入但沒檔案 → 若有驗證前存的草稿，直接自動建檔
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get("ref");
    if (refParam) {
      const code = refParam.trim().toUpperCase();
      setReferralCode(code);
      setFromInvite(true);
      try {
        localStorage.setItem(REF_KEY, code);
      } catch {}
    } else {
      try {
        const saved = localStorage.getItem(REF_KEY);
        if (saved) setReferralCode(saved);
      } catch {}
    }
    if (params.get("error") || params.get("error_description")) {
      setNotice("驗證連結無效或已過期。如果你已經驗證過，直接登入即可；還沒的話請重新註冊一次。");
    }
    const wantEdit = params.get("edit") === "1";

    supabase.auth.getUser().then(async ({ data: userData }) => {
      if (!userData.user) return;
      setUserId(userData.user.id);

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userData.user.id)
        .limit(1);

      if (existing && existing.length > 0) {
        if (wantEdit) {
          await loadForEdit();
        } else {
          router.replace("/member");
        }
        return;
      }

      const draft = readDraft();
      if (draft) {
        setData(draft.data);
        setReferralCode(draft.ref || "");
        setPhase("activating");
        await createProfile(userData.user.id, draft.data, draft.ref || "");
      }
    });
  }, []);

  // 編輯模式：把既有檔案讀進表單
  async function loadForEdit() {
    const { data: full, error: err } = await supabase.rpc("my_profile_full");
    if (err || !full) {
      setError("讀取檔案失敗，請重新整理再試");
      return;
    }
    const p = full as Record<string, unknown>;
    const seekDep = splitDepartments(p.seek_departments as string[] | null);
    const offerDep = splitDepartments(p.offer_departments as string[] | null);
    setData({
      role: (p.role as Role) || "",
      name: (p.name as string) || "",
      company: (p.company as string) || "",
      bio: (p.bio as string) || "",
      seek: {
        industries: (p.seek_industries as string[]) || [],
        regions: (p.seek_regions as string[]) || [],
        departments: seekDep.known,
        customDepartment: seekDep.custom,
        level: (p.seek_level as number) || 0,
        note: (p.seek_note as string) || "",
      },
      hasOffer: Boolean(p.has_offer),
      offer: {
        industries: (p.offer_industries as string[]) || [],
        regions: (p.offer_regions as string[]) || [],
        departments: offerDep.known,
        customDepartment: offerDep.custom,
        level: (p.offer_level as number) || 0,
        note: (p.offer_note as string) || "",
      },
      line_id: (p.line_id as string) || "",
    });
    setAgreedTerms(true);
    setEditMode(true);
  }

  // 依「是否要填提供側」動態組出完整步驟序列
  const steps: StepKey[] = data.hasOffer
    ? [...BASE_STEPS, ...OFFER_STEPS, ...FINAL_STEPS]
    : [...BASE_STEPS, ...FINAL_STEPS];

  const step = steps[stepIndex];
  const totalSteps = steps.length;

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function toggleSeek(field: "industries" | "regions" | "departments", value: string) {
    setData((prev) => {
      const arr = prev.seek[field];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, seek: { ...prev.seek, [field]: next } };
    });
  }
  function toggleOffer(field: "industries" | "regions" | "departments", value: string) {
    setData((prev) => {
      const arr = prev.offer[field];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, offer: { ...prev.offer, [field]: next } };
    });
  }

  // 把表單資料整理成要存進資料庫的欄位
  function buildPayload(d: OnboardingData) {
    const seekDepartments = mergedDepartments(d.seek);
    const offerDepartments = d.hasOffer ? mergedDepartments(d.offer) : [];
    return {
      name: d.name,
      company: d.company || null,
      bio: d.bio || null,
      line_id: d.line_id || null,
      role: d.role,

      seek_industries: d.seek.industries,
      seek_regions: d.seek.regions,
      seek_departments: seekDepartments,
      seek_level: d.seek.level || null,
      seek_note: d.seek.note || null,

      has_offer: d.hasOffer,
      offer_industries: d.hasOffer ? d.offer.industries : [],
      offer_regions: d.hasOffer ? d.offer.regions : [],
      offer_departments: offerDepartments,
      offer_level: d.hasOffer ? d.offer.level || null : null,
      offer_note: d.hasOffer ? d.offer.note || null : null,
    };
  }

  // 建立檔案：寫入 profiles → 存 Google 頭像（若有）→ 套用推薦碼（若有）→ 前往推薦頁
  async function createProfile(uid: string, d: OnboardingData, ref: string) {
    // 防重複建檔
    const { data: existing } = await supabase.from("profiles").select("id").eq("user_id", uid).limit(1);
    if (existing && existing.length > 0) {
      clearDraft();
      router.push("/member");
      return;
    }

    const { error: insertError } = await supabase.from("profiles").insert({
      user_id: uid,
      ...buildPayload(d),
      // 舊欄位：維持有值，避免踩到既有資料庫限制
      industries: d.seek.industries,
      regions: d.seek.regions,
      contact_level: "middle",
      familiarity: "medium",
      is_active: true,
      is_verified: false,
    });

    if (insertError) {
      setPhase("form");
      setError("儲存失敗：" + insertError.message);
      setSaving(false);
      return;
    }

    // Google 登入的人，把 Google 大頭照帶進來（失敗不影響建檔）
    try {
      const { data: userData } = await supabase.auth.getUser();
      const meta = (userData.user?.user_metadata || {}) as Record<string, unknown>;
      const avatar = (meta.avatar_url as string) || (meta.picture as string) || "";
      if (avatar) await supabase.rpc("set_my_avatar", { p_url: avatar });
    } catch {}

    // 推薦碼：由伺服器端判斷是否發點（信箱未驗證、自推、超過上限都不會發）
    if (ref) {
      try {
        await supabase.rpc("apply_referral", { p_code: ref });
      } catch {}
    }

    clearDraft();
    router.push("/discover");
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");

    // 編輯模式：直接更新
    if (editMode) {
      const { error: err } = await supabase.rpc("update_my_profile", { p: buildPayload(data) });
      if (err) {
        setError("儲存失敗：" + err.message);
        setSaving(false);
        return;
      }
      router.push("/member");
      return;
    }

    // 推薦碼先確認存在，避免打錯字白白浪費
    const ref = referralCode.trim().toUpperCase();
    if (ref) {
      const { data: ok } = await supabase.rpc("check_referral_code", { p_code: ref });
      if (ok !== true) {
        setError("推薦碼不存在，請確認後再試，或清空推薦碼欄位直接送出");
        setSaving(false);
        return;
      }
    }

    let uid = userId;

    // 未登入者：先建立帳號
    if (!uid) {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${SITE_URL}/onboarding` },
      });

      if (signUpErr) {
        const m = signUpErr.message.toLowerCase();
        if (m.includes("already registered")) {
          const r = await trySignInExisting();
          if (!r) return;
          uid = r;
        } else {
          let reason = signUpErr.message;
          if (m.includes("rate limit") || m.includes("security purposes")) {
            reason = "短時間內嘗試次數過多，請等幾分鐘再送出（你填的資料都還在）";
          } else if (m.includes("invalid")) {
            reason = "Email 格式不正確，請檢查後再試";
          } else if (m.includes("password")) {
            reason = "密碼不符合要求，請設定至少 6 個字元";
          }
          setError("帳號建立失敗：" + reason);
          setSaving(false);
          return;
        }
      } else {
        const u = signUpData.user;
        // Supabase 對已存在的 Email 會回傳一個沒有 identities 的假成功，這裡辨識出來改走登入
        const alreadyExists = u && Array.isArray(u.identities) && u.identities.length === 0;
        if (alreadyExists) {
          const r = await trySignInExisting();
          if (!r) return;
          uid = r;
        } else if (!signUpData.session) {
          // 需要信箱驗證：先把資料存起來，等對方點完信裡的連結回來自動建檔
          saveDraft(data, ref);
          setPhase("pending_confirm");
          setSaving(false);
          return;
        } else {
          uid = u?.id ?? null;
        }
      }

      if (!uid) {
        setError("帳號建立失敗，請稍後再試");
        setSaving(false);
        return;
      }
      setUserId(uid);
    }

    await createProfile(uid, data, ref);
  }

  // Email 已被註冊：用同組帳密登入。回傳 uid，失敗回傳 null（錯誤訊息已設定）
  async function trySignInExisting(): Promise<string | null> {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      const m = signInErr.message.toLowerCase();
      if (m.includes("not confirmed")) {
        saveDraft(data, referralCode.trim().toUpperCase());
        setPhase("pending_confirm");
        setSaving(false);
        return null;
      }
      setError("這個 Email 已經註冊過，但密碼不符。請輸入正確密碼再送出，你填的資料都還在。");
      setSaving(false);
      return null;
    }
    return signInData.user?.id ?? null;
  }

  // 收信頁：重寄驗證信
  async function resendConfirm() {
    setError("");
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${SITE_URL}/onboarding` },
    });
    if (err) {
      setError(
        err.message.toLowerCase().includes("rate limit")
          ? "短時間內寄送次數過多，請稍後再試"
          : "重寄失敗：" + err.message
      );
      return;
    }
    setResent(true);
  }

  // 收信頁：使用者說已經點過連結 → 用帳密登入，成功就建檔
  async function continueAfterConfirm() {
    setSaving(true);
    setError("");
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      setError(
        signInErr.message.toLowerCase().includes("not confirmed")
          ? "信箱還沒驗證完成。請先點信裡的連結，再回來按這顆按鈕"
          : "登入失敗：" + signInErr.message
      );
      setSaving(false);
      return;
    }
    const uid = signInData.user?.id;
    if (!uid) {
      setError("登入失敗，請稍後再試");
      setSaving(false);
      return;
    }
    setUserId(uid);
    setPhase("activating");
    await createProfile(uid, data, referralCode.trim().toUpperCase());
  }

  const nextDisabled =
    (step === "role" && !data.role) ||
    (step === "basic" && !data.name.trim()) ||
    (step === "line_id" &&
      (!data.line_id.trim() ||
        saving ||
        !agreedTerms ||
        (!userId && !editMode && (!email.trim() || password.length < 6))));

  // ===== 收信畫面 =====
  if (phase === "pending_confirm") {
    return (
      <main className="min-h-screen bg-purple-50 px-4 py-6">
        <div className="max-w-md mx-auto">
          <Link href="/" className="flex items-center gap-2 mb-8 w-fit">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              EK
            </div>
            <span className="text-lg font-bold text-purple-900">ExKey</span>
          </Link>
          <div className="bg-white rounded-2xl border border-purple-100 p-6 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-900 mb-4 flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-purple-900 mb-2">驗證信已寄出</h1>
            <p className="text-sm text-gray-600 leading-relaxed mb-1">
              已寄到 <span className="font-semibold text-gray-900">{email}</span>
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              打開信件、點裡面的連結，你的人脈檔案就會自動建好，不用重填。找不到信請翻垃圾信件匣。
            </p>

            <div className="bg-purple-50 rounded-xl p-3 text-xs text-gray-600 leading-relaxed mb-5">
              如果你是在別的裝置（例如手機）點的連結，回到這個畫面按下面的「我已驗證，繼續建檔」即可。
            </div>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            {resent && !error && <p className="text-sm text-green-600 mb-3">已重新寄出</p>}

            <button
              disabled={saving}
              onClick={continueAfterConfirm}
              className="w-full bg-gold-600 disabled:bg-gray-300 text-purple-900 font-semibold py-3 rounded-xl mb-3"
            >
              {saving ? "處理中..." : "我已驗證，繼續建檔"}
            </button>
            <button onClick={resendConfirm} className="w-full text-sm text-purple-600 underline py-2">
              沒收到？重寄驗證信
            </button>
            <button
              onClick={() => {
                setPhase("form");
                setError("");
              }}
              className="w-full text-xs text-gray-400 underline py-2"
            >
              換一個 Email
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ===== 驗證完回來，自動建檔中 =====
  if (phase === "activating") {
    return (
      <main className="min-h-screen bg-purple-50 px-4 py-6 flex items-center">
        <div className="max-w-md mx-auto w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-900 mx-auto mb-4 animate-pulse" />
          <p className="text-base font-semibold text-purple-900">帳號已啟用，正在建立你的檔案…</p>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>
      </main>
    );
  }

  // ===== 表單 =====
  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              EK
            </div>
            <span className="text-lg font-bold text-purple-900">ExKey</span>
          </Link>
          {editMode && (
            <button onClick={() => router.push("/member")} className="text-sm text-gray-500 underline">
              取消編輯
            </button>
          )}
        </div>

        {notice && (
          <div className="bg-gold-50 border border-gold-100 text-gold-900 text-xs rounded-xl p-3 mb-4 leading-relaxed">
            {notice}
          </div>
        )}

        {fromInvite && !editMode && stepIndex === 0 && (
          <div className="bg-gradient-to-br from-purple-600 to-purple-900 text-white rounded-2xl p-4 mb-5 shadow-lg">
            <div className="text-xs text-purple-100 mb-1">你是透過朋友的邀請連結來的</div>
            <div className="text-sm leading-relaxed">
              ExKey 幫業務與廠商配對想認識的合作對象，配對後才解鎖聯絡方式。完成註冊，你和邀請你的朋友各得{" "}
              <span className="font-bold text-gold-400">5 點</span>。推薦碼已自動帶入：
              <span className="font-bold tracking-widest text-gold-400 ml-1">{referralCode}</span>
            </div>
            <div className="text-[11px] text-purple-100/80 mt-2">
              由關鍵人脈資訊股份有限公司經營・<a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">服務條款</a>
            </div>
          </div>
        )}

        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>
              {editMode && <span className="text-purple-600 font-semibold mr-1">編輯檔案・</span>}
              {STEP_TITLES[step]}
            </span>
            <span>
              {stepIndex + 1} / {totalSteps}
            </span>
          </div>
          <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-600 transition-all"
              style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {step === "role" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">你的身份是？</h1>
            <p className="text-sm text-gray-500 mb-6">選擇最符合你的角色，作為基本資料顯示</p>
            <div className="space-y-3">
              {[
                { v: "sales", t: "業務代理", d: "我有客戶通路，想找好產品代理" },
                { v: "vendor", t: "產品廠商", d: "我有產品，想找業務夥伴拓展市場" },
                { v: "both", t: "兩者皆是", d: "我同時有產品也有通路" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setData({ ...data, role: opt.v as Role })}
                  className={`w-full text-left p-4 rounded-xl border transition ${
                    data.role === opt.v
                      ? "border-purple-600 bg-purple-100"
                      : "border-gray-200 bg-white hover:border-purple-400"
                  }`}
                >
                  <div className="font-semibold text-gray-900">{opt.t}</div>
                  <div className="text-sm text-gray-500">{opt.d}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "basic" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">讓大家認識你</h1>
            <p className="text-sm text-gray-500 mb-6">填寫基本資料，增加媒合成功率</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">稱呼 *</label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="你的名字"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">公司名稱（選填）</label>
                <input
                  type="text"
                  value={data.company}
                  onChange={(e) => setData({ ...data, company: e.target.value })}
                  placeholder="例：台灣科技股份有限公司"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">一句話介紹自己（選填）</label>
                <input
                  type="text"
                  value={data.bio}
                  onChange={(e) => setData({ ...data, bio: e.target.value })}
                  placeholder="例：10年半導體設備業務，竹科通路熟"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {step === "seek_industry" && (
          <DimensionPicker
            title="你想找的產業？"
            subtitle="想認識哪些產業的人脈？不確定就選「不限」"
            options={INDUSTRIES}
            selected={data.seek.industries}
            onToggle={(v) => toggleSeek("industries", v)}
            onClear={() => setData((p) => ({ ...p, seek: { ...p.seek, industries: [] } }))}
          />
        )}

        {step === "seek_region" && (
          <DimensionPicker
            title="你想找的地區？"
            subtitle="想認識哪些地區的人脈？不確定就選「不限」"
            options={REGIONS}
            selected={data.seek.regions}
            onToggle={(v) => toggleSeek("regions", v)}
            onClear={() => setData((p) => ({ ...p, seek: { ...p.seek, regions: [] } }))}
          />
        )}

        {step === "seek_department" && (
          <DimensionPicker
            title="你想找的部門？"
            subtitle="想認識對方公司裡的哪個部門？不確定就選「不限」"
            options={DEPARTMENTS}
            selected={data.seek.departments}
            onToggle={(v) => toggleSeek("departments", v)}
            onClear={() => setData((p) => ({ ...p, seek: { ...p.seek, departments: [] } }))}
            extra={
              <input
                type="text"
                value={data.seek.customDepartment}
                onChange={(e) =>
                  setData((p) => ({ ...p, seek: { ...p.seek, customDepartment: e.target.value } }))
                }
                placeholder="其他部門（選填，自行輸入）"
                className="w-full mt-3 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-purple-600 outline-none text-sm"
              />
            }
          />
        )}

        {step === "seek_level" && (
          <LevelPicker
            title="你想找的職級？"
            subtitle="想認識哪個職級的人脈？不確定就選「不限」"
            level={data.seek.level}
            onSelect={(v) => setData((p) => ({ ...p, seek: { ...p.seek, level: v } }))}
            extra={
              <NoteBox
                label="想找的人脈，還想補充什麼？"
                placeholder="例：想找竹科半導體廠的設備採購決策者，或能介紹科技廠總務的人"
                value={data.seek.note}
                onChange={(v) => setData((p) => ({ ...p, seek: { ...p.seek, note: v } }))}
              />
            }
          />
        )}

        {step === "offer_intro" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">你能介紹的人脈？</h1>
            <p className="text-sm text-gray-500 mb-6">
              這段完全自由，不確定或暫時沒有都可以跳過，之後隨時可以再補
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setData((p) => ({ ...p, hasOffer: true }));
                  goNext();
                }}
                className={`w-full text-left p-4 rounded-xl border ${
                  data.hasOffer ? "border-purple-600 bg-purple-100" : "border-gray-200 bg-white hover:border-purple-400"
                }`}
              >
                <div className="font-semibold text-gray-900">好，我要填</div>
                <div className="text-sm text-gray-500">例：我認識台積電採購課長</div>
              </button>
              <button
                onClick={() => {
                  setData((p) => ({ ...p, hasOffer: false }));
                  goNext();
                }}
                className={`w-full text-left p-4 rounded-xl border ${
                  !data.hasOffer && editMode ? "border-purple-600 bg-purple-100" : "border-gray-200 bg-white hover:border-purple-400"
                }`}
              >
                <div className="font-semibold text-gray-900">跳過，之後再填</div>
                <div className="text-sm text-gray-500">只想找人脈，暫時沒有可以介紹的</div>
              </button>
            </div>
          </div>
        )}

        {step === "offer_industry" && (
          <DimensionPicker
            title="你能介紹的產業？"
            subtitle="你認識的人脈屬於哪些產業？不確定就選「不限」"
            options={INDUSTRIES}
            selected={data.offer.industries}
            onToggle={(v) => toggleOffer("industries", v)}
            onClear={() => setData((p) => ({ ...p, offer: { ...p.offer, industries: [] } }))}
          />
        )}

        {step === "offer_region" && (
          <DimensionPicker
            title="你能介紹的地區？"
            subtitle="你認識的人脈在哪些地區？不確定就選「不限」"
            options={REGIONS}
            selected={data.offer.regions}
            onToggle={(v) => toggleOffer("regions", v)}
            onClear={() => setData((p) => ({ ...p, offer: { ...p.offer, regions: [] } }))}
          />
        )}

        {step === "offer_department" && (
          <DimensionPicker
            title="你能介紹的部門？"
            subtitle="你認識的人脈在對方公司的哪個部門？不確定就選「不限」"
            options={DEPARTMENTS}
            selected={data.offer.departments}
            onToggle={(v) => toggleOffer("departments", v)}
            onClear={() => setData((p) => ({ ...p, offer: { ...p.offer, departments: [] } }))}
            extra={
              <input
                type="text"
                value={data.offer.customDepartment}
                onChange={(e) =>
                  setData((p) => ({ ...p, offer: { ...p.offer, customDepartment: e.target.value } }))
                }
                placeholder="其他部門（選填，自行輸入）"
                className="w-full mt-3 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-purple-600 outline-none text-sm"
              />
            }
          />
        )}

        {step === "offer_level" && (
          <LevelPicker
            title="你能介紹的職級？"
            subtitle="你認識的人脈職級大概到哪？不確定就選「不限」"
            level={data.offer.level}
            onSelect={(v) => setData((p) => ({ ...p, offer: { ...p.offer, level: v } }))}
            extra={
              <NoteBox
                label="你能介紹的人脈，一句話說明"
                placeholder="例：我認識台積電採購課長、台塑廠務經理，另有幾位化工廠總經理"
                value={data.offer.note}
                onChange={(v) => setData((p) => ({ ...p, offer: { ...p.offer, note: v } }))}
              />
            }
          />
        )}

        {step === "line_id" && (
          <div>
            <div className="inline-block bg-gold-100 text-gold-900 text-xs px-3 py-1 rounded-full mb-3">
              {editMode ? "最後確認" : "✨ 最後一步"}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">留下聯絡方式</h1>
            <p className="text-sm text-gray-500 mb-6">配對成功後，對方可以透過 LINE 聯繫你</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">你的 LINE ID</label>
              <input
                type="text"
                value={data.line_id}
                onChange={(e) => setData({ ...data, line_id: e.target.value })}
                placeholder="例：mike_chen_tw"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">在 LINE 的「設定 → 個人檔案 → ID」可以找到</p>
            </div>

            {!userId && !editMode && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-3">建立帳號，儲存你的檔案</p>
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="設定密碼（至少 6 個字元）"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  送出後會寄一封驗證信到這個 Email，點連結即完成。已有帳號？直接輸入原本的 Email 和密碼即可
                </p>
              </div>
            )}

            {!editMode && (
              <div className="mt-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">推薦碼（選填）</label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="朋友給你的 6 碼推薦碼"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none tracking-widest uppercase"
                />
                <p className="text-xs text-gray-400 mt-1">填了推薦碼，你和推薦你的朋友各得 5 點</p>
              </div>
            )}

            <div className="mt-6 p-4 bg-white rounded-xl border border-gray-100">
              <div className="font-semibold text-gray-900 mb-2">{data.name || "（未填名稱）"}</div>
              <div className="text-sm text-gray-500 mb-2">{data.company || "—"}</div>
              <div className="flex flex-wrap gap-1">
                <span className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">
                  {data.role === "sales" ? "業務" : data.role === "vendor" ? "廠商" : "兩者皆是"}
                </span>
                <span className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">
                  想找：{data.seek.industries.length === 0 ? "不限產業" : `${data.seek.industries.length} 個產業`}
                </span>
                <span className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">
                  {data.hasOffer ? "已填寫可提供的人脈" : "尚未填寫可提供的人脈"}
                </span>
              </div>
            </div>

            {!editMode && (
              <label className="flex items-start gap-2 mt-4 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  我已閱讀並同意 <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline">服務條款與隱私權政策</a>，瞭解本平台為資訊中介，會員間的聯繫與合作由雙方自行負責，且點數一經使用不予退費。
                </span>
              </label>
            )}

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          {stepIndex > 0 && (
            <button
              onClick={goBack}
              className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600"
            >
              上一步
            </button>
          )}
          {step !== "offer_intro" &&
            (step === "line_id" ? (
              <button
                disabled={nextDisabled || saving}
                onClick={handleSubmit}
                className="flex-1 bg-gold-600 disabled:bg-gray-300 text-purple-900 font-semibold py-3 rounded-xl"
              >
                {saving
                  ? "儲存中..."
                  : editMode
                  ? "儲存變更"
                  : userId
                  ? "建立檔案，馬上幫你找符合的人脈 →"
                  : "註冊並寄驗證信 →"}
              </button>
            ) : (
              <button
                disabled={nextDisabled}
                onClick={goNext}
                className="flex-1 bg-purple-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl"
              >
                下一步
              </button>
            ))}
        </div>
      </div>
    </main>
  );
}
