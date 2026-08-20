"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
}: {
  title: string;
  subtitle: string;
  level: number;
  onSelect: (v: number) => void;
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
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const supabase = createClient();
  const [data, setData] = useState<OnboardingData>(emptyOnboardingData());
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 靜默偵測登入狀態：已登入者記住帳號 ID（最後一步免填帳密）；
  // 已建過檔案者直接導向會員專區，避免重複建檔。未登入者照常填寫。
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", data.user.id)
        .limit(1);
      if (existing && existing.length > 0) router.replace("/member");
    });
  }, []);

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

  async function handleSubmit() {
    setSaving(true);
    setError("");

    // 未登入者：先建立帳號。Email 已被註冊時，改用同組帳密嘗試登入（填好的資料都會保留）
    let uid = userId;
    if (!uid) {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) {
        if (signUpErr.message.toLowerCase().includes("already registered")) {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) {
            setError("這個 Email 已經註冊過，但密碼不符。請輸入正確密碼再送出，你填的資料都還在。");
            setSaving(false);
            return;
          }
          uid = signInData.user?.id ?? null;
        } else {
          setError("帳號建立失敗：" + signUpErr.message);
          setSaving(false);
          return;
        }
      } else {
        uid = signUpData.user?.id ?? null;
      }
      if (!uid) {
        setError("帳號建立失敗，請稍後再試");
        setSaving(false);
        return;
      }
      setUserId(uid);
    }

    // 防重複建檔：這個帳號已有檔案就直接前往會員專區
    const { data: existing } = await supabase.from("profiles").select("id").eq("user_id", uid).limit(1);
    if (existing && existing.length > 0) {
      router.push("/member");
      return;
    }

    const seekDepartments = mergedDepartments(data.seek);
    const offerDepartments = data.hasOffer ? mergedDepartments(data.offer) : [];

    const { error: insertError } = await supabase.from("profiles").insert({
      user_id: uid,
      name: data.name,
      company: data.company || null,
      bio: data.bio || null,
      line_id: data.line_id || null,
      role: data.role,

      seek_industries: data.seek.industries,
      seek_regions: data.seek.regions,
      seek_departments: seekDepartments,
      seek_level: data.seek.level || null,
      seek_note: data.seek.note || null,

      has_offer: data.hasOffer,
      offer_industries: data.hasOffer ? data.offer.industries : [],
      offer_regions: data.hasOffer ? data.offer.regions : [],
      offer_departments: offerDepartments,
      offer_level: data.hasOffer ? data.offer.level || null : null,
      offer_note: data.hasOffer ? data.offer.note || null : null,

      // 舊欄位：維持有值，避免踩到既有資料庫限制
      industries: data.seek.industries,
      regions: data.seek.regions,
      contact_level: "middle",
      familiarity: "medium",
      is_active: true,
      is_verified: false,
    });

    if (insertError) {
      setError("儲存失敗：" + insertError.message);
      setSaving(false);
      return;
    }

    router.push("/discover");
  }

  const nextDisabled =
    (step === "role" && !data.role) ||
    (step === "basic" && !data.name.trim()) ||
    (step === "line_id" &&
      (!data.line_id.trim() || saving || (!userId && (!email.trim() || password.length < 6))));

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            EK
          </div>
          <span className="text-lg font-bold text-purple-900">ExKey</span>
        </div>
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>{STEP_TITLES[step]}</span>
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
                className="w-full text-left p-4 rounded-xl border border-purple-600 bg-purple-100"
              >
                <div className="font-semibold text-gray-900">好，我要填</div>
                <div className="text-sm text-gray-500">例：我認識台積電採購課長</div>
              </button>
              <button
                onClick={() => {
                  setData((p) => ({ ...p, hasOffer: false }));
                  goNext();
                }}
                className="w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-purple-400"
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
          />
        )}

        {step === "line_id" && (
          <div>
            <div className="inline-block bg-gold-100 text-gold-900 text-xs px-3 py-1 rounded-full mb-3">
              ✨ 最後一步
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

            {!userId && (
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
                <p className="text-xs text-gray-400 mt-2">已有帳號？直接輸入原本的 Email 和密碼即可</p>
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
                {saving ? "儲存中..." : "註冊完成，馬上幫你找符合的人脈 →"}
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
}  "seek_level",
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
  line_id: "聯絡方式",
};

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
}: {
  title: string;
  subtitle: string;
  level: number;
  onSelect: (v: number) => void;
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
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const supabase = createClient();
  const [data, setData] = useState<OnboardingData>(emptyOnboardingData());
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  // 未登入者導回登入頁；已登入則記住帳號 ID，寫入資料時綁定
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
    });
  }, []);

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

  async function handleSubmit() {
    setSaving(true);
    setError("");

    const seekDepartments = mergedDepartments(data.seek);
    const offerDepartments = data.hasOffer ? mergedDepartments(data.offer) : [];

    const { error: insertError } = await supabase.from("profiles").insert({
      user_id: userId,
      name: data.name,
      company: data.company || null,
      bio: data.bio || null,
      line_id: data.line_id || null,
      role: data.role,

      seek_industries: data.seek.industries,
      seek_regions: data.seek.regions,
      seek_departments: seekDepartments,
      seek_level: data.seek.level || null,
      seek_note: data.seek.note || null,

      has_offer: data.hasOffer,
      offer_industries: data.hasOffer ? data.offer.industries : [],
      offer_regions: data.hasOffer ? data.offer.regions : [],
      offer_departments: offerDepartments,
      offer_level: data.hasOffer ? data.offer.level || null : null,
      offer_note: data.hasOffer ? data.offer.note || null : null,

      // 舊欄位：維持有值，避免踩到既有資料庫限制
      industries: data.seek.industries,
      regions: data.seek.regions,
      contact_level: "middle",
      familiarity: "medium",
      is_active: true,
      is_verified: false,
    });

    if (insertError) {
      setError("儲存失敗：" + insertError.message);
      setSaving(false);
      return;
    }

    sessionStorage.setItem("exkey_name", data.name);
    sessionStorage.setItem("exkey_role", data.role);
    sessionStorage.setItem(
      "exkey_seek",
      JSON.stringify({
        industries: data.seek.industries,
        regions: data.seek.regions,
        departments: seekDepartments,
        level: data.seek.level,
      })
    );
    sessionStorage.setItem("exkey_has_offer", String(data.hasOffer));
    sessionStorage.setItem(
      "exkey_offer",
      JSON.stringify({
        industries: data.hasOffer ? data.offer.industries : [],
        regions: data.hasOffer ? data.offer.regions : [],
        departments: offerDepartments,
        level: data.hasOffer ? data.offer.level : 0,
      })
    );
    router.push("/discover");
  }

  const nextDisabled =
    (step === "role" && !data.role) ||
    (step === "basic" && !data.name.trim()) ||
    (step === "line_id" && (!data.line_id.trim() || saving));

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            EK
          </div>
          <span className="text-lg font-bold text-purple-900">ExKey</span>
        </div>
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>{STEP_TITLES[step]}</span>
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
                className="w-full text-left p-4 rounded-xl border border-purple-600 bg-purple-100"
              >
                <div className="font-semibold text-gray-900">好，我要填</div>
                <div className="text-sm text-gray-500">例：我認識台積電採購課長</div>
              </button>
              <button
                onClick={() => {
                  setData((p) => ({ ...p, hasOffer: false }));
                  goNext();
                }}
                className="w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-purple-400"
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
          />
        )}

        {step === "line_id" && (
          <div>
            <div className="inline-block bg-gold-100 text-gold-900 text-xs px-3 py-1 rounded-full mb-3">
              ✨ 最後一步
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
                {saving ? "儲存中..." : "註冊完成，馬上幫你找符合的人脈 →"}
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
