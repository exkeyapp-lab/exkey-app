"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { INDUSTRIES, REGIONS, LEVELS, type OnboardingData } from "@/lib/types";

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
    my_level: "",
    seeking_levels: [],
    line_id: "",
  });

  const totalSteps = 6;

  function toggleArray(field: "industries" | "regions" | "seeking_levels", value: string) {
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

  async function handleSubmit() {
    setSaving(true);
    setError("");

    const { error: insertError } = await supabase.from("profiles").insert({
      name: data.name,
      company: data.company || null,
      bio: data.bio || null,
      line_id: data.line_id || null,
      role: data.role,
      industries: data.industries,
      regions: data.regions,
      my_level: data.my_level || null,
      seeking_levels: data.seeking_levels,
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
    sessionStorage.setItem("exkey_industries", JSON.stringify(data.industries));
    sessionStorage.setItem("exkey_regions", JSON.stringify(data.regions));
    sessionStorage.setItem("exkey_seeking_levels", JSON.stringify(data.seeking_levels));

    router.push("/discover");
  }

  const stepTitles = ["選擇身份", "選擇產業", "選擇地區", "基本資料", "想找的人脈", "聯絡方式"];

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">EK</div>
          <span className="text-lg font-bold text-purple-900">ExKey</span>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>{stepTitles[step - 1]}</span>
            <span>{step} / {totalSteps}</span>
          </div>
          <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
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
                <button key={opt.v} onClick={() => setData({ ...data, role: opt.v as OnboardingData["role"] })}
                  className={`w-full text-left p-4 rounded-xl border transition ${data.role === opt.v ? "border-purple-600 bg-purple-100" : "border-gray-200 bg-white hover:border-purple-400"}`}>
                  <div className="font-semibold text-gray-900">{opt.t}</div>
                  <div cl
