"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { INDUSTRIES, REGIONS, type OnboardingData } from "@/lib/types";

export default function Onboarding() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState<OnboardingData>({
    role: "",
    industries: [],
    regions: [],
    name: "",
    company: "",
    bio: "",
    line_id: "",
  });

  const totalSteps = 5;

  // 切換多選項目
  function toggleArray(field: "industries" | "regions", value: string) {
    setData((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value],
      };
    });
  }

  // 送出註冊
  async function handleSubmit() {
    setSaving(true);
    setError("");

    // 用 LINE ID 當作識別，建立一個簡易帳號（無密碼登入概念）
    // 這裡直接寫入 profiles 表（user_id 留 null，內測階段簡化）
    const { error: insertError } = await supabase.from("profiles").insert({
      name: data.name,
      company: data.company || null,
      bio: data.bio || null,
      line_id: data.line_id || null,
      role: data.role,
      industries: data.industries,
      regions: data.regions,
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

    // 把名字暫存，推薦頁可以打招呼
    sessionStorage.setItem("exkey_name", data.name);
    sessionStorage.setItem("exkey_role", data.role);
    sessionStorage.setItem("exkey_industries", JSON.stringify(data.industries));
    sessionStorage.setItem("exkey_regions", JSON.stringify(data.regions));

    router.push("/discover");
  }

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            EK
          </div>
          <span className="text-lg font-bold text-purple-900">ExKey</span>
        </div>

        {/* 進度條 */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>
              {step === 1 && "選擇身份"}
              {step === 2 && "選擇產業"}
              {step === 3 && "選擇地區"}
              {step === 4 && "基本資料"}
              {step === 5 && "聯絡方式"}
            </span>
            <span>{step} / {totalSteps}</span>
          </div>
          <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-600 transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: 身份 */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">你的身份是？</h1>
            <p className="text-sm text-gray-500 mb-6">選擇最符合你的角色，幫助我們更精準媒合</p>
            <div className="space-y-3">
              {[
                { v: "sales", t: "業務代理", d: "我有客戶通路，想找好產品代理" },
                { v: "vendor", t: "產品廠商", d: "我有產品，想找業務夥伴拓展市場" },
                { v: "both", t: "兩者皆是", d: "我同時有產品也有通路" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setData({ ...data, role: opt.v as OnboardingData["role"] })}
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
            <button
              disabled={!data.role}
              onClick={() => setStep(2)}
              className="w-full mt-6 bg-purple-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition"
            >
              下一步
            </button>
          </div>
        )}

        {/* Step 2: 產業 */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">你的產業領域？</h1>
            <p className="text-sm text-gray-500 mb-6">可多選，選擇你有經驗或想拓展的產業</p>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  onClick={() => toggleArray("industries", ind)}
                  className={`px-4 py-2 rounded-full text-sm transition ${
                    data.industries.includes(ind)
                      ? "bg-purple-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-purple-400"
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 text-center mt-4">
              已選擇 {data.industries.length} 個產業
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600">
                上一步
              </button>
              <button
                disabled={data.industries.length === 0}
                onClick={() => setStep(3)}
                className="flex-1 bg-purple-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 地區 */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">你的服務地區？</h1>
            <p className="text-sm text-gray-500 mb-6">可多選，選擇你能服務或希望拓展的地區</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((reg) => (
                <button
                  key={reg}
                  onClick={() => toggleArray("regions", reg)}
                  className={`px-4 py-2 rounded-full text-sm transition ${
                    data.regions.includes(reg)
                      ? "bg-purple-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-purple-400"
                  }`}
                >
                  {reg}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 text-center mt-4">
              已選擇 {data.regions.length} 個地區
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600">
                上一步
              </button>
              <button
                disabled={data.regions.length === 0}
                onClick={() => setStep(4)}
                className="flex-1 bg-purple-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* Step 4: 基本資料 */}
        {step === 4 && (
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
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(3)} className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600">
                上一步
              </button>
              <button
                disabled={!data.name.trim()}
                onClick={() => setStep(5)}
                className="flex-1 bg-purple-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* Step 5: LINE ID */}
        {step === 5 && (
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
              <p className="text-xs text-gray-400 mt-1">
                在 LINE 的「設定 → 個人檔案 → ID」可以找到
              </p>
            </div>

            {/* 確認卡片 */}
            <div className="mt-6 p-4 bg-white rounded-xl border border-gray-100">
              <div className="font-semibold text-gray-900 mb-2">{data.name || "（未填名稱）"}</div>
              <div className="text-sm text-gray-500 mb-2">{data.company || "—"}</div>
              <div className="flex flex-wrap gap-1">
                <span className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">
                  {data.role === "sales" ? "業務" : data.role === "vendor" ? "廠商" : "兩者皆是"}
                </span>
                <span className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">
                  {data.industries.length} 個產業
                </span>
                <span className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">
                  {data.regions.length} 個地區
                </span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 mt-3">{error}</p>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(4)} className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600">
                上一步
              </button>
              <button
                disabled={saving || !data.line_id.trim()}
                onClick={handleSubmit}
                className="flex-1 bg-gold-600 disabled:bg-gray-300 text-purple-900 font-semibold py-3 rounded-xl"
              >
                {saving ? "儲存中..." : "完成，查看推薦人脈 →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
