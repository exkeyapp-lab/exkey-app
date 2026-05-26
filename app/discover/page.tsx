"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

function calcScore(
  me: { industries: string[]; regions: string[]; seekingLevel: number },
  p: Profile
): number {
  const industryOverlap = p.industries.filter((i) => me.industries.includes(i)).length;
  const regionOverlap = p.regions.filter((r) => me.regions.includes(r)).length;
  const famBonus = p.familiarity === "deep" ? 30 : p.familiarity === "medium" ? 15 : 5;
  // 職級門檻加分：對方層級 >= 我想找的門檻 → 大加分
  let levelBonus = 0;
  if (me.seekingLevel && p.level) {
    levelBonus = p.level >= me.seekingLevel ? 40 : 0;
  }
  return industryOverlap * 30 + regionOverlap * 20 + levelBonus + famBonus;
}

export default function Discover() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<(Profile & { score: number })[]>([]);
  const [name, setName] = useState("");
  const [revealedId, setRevealedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const myName = sessionStorage.getItem("exkey_name") || "";
      const myIndustries = JSON.parse(sessionStorage.getItem("exkey_industries") || "[]");
      const myRegions = JSON.parse(sessionStorage.getItem("exkey_regions") || "[]");
      const myRole = sessionStorage.getItem("exkey_role") || "";
      const mySeekingLevel = Number(sessionStorage.getItem("exkey_seeking_level") || "0");
      setName(myName);

      const { data, error } = await supabase.from("profiles").select("*").eq("is_active", true);
      if (error || !data) { setLoading(false); return; }

      const scored = data
        .filter((p: Profile) => p.name !== myName)
        .filter((p: Profile) => {
          if (myRole === "sales") return p.role === "vendor" || p.role === "both";
          if (myRole === "vendor") return p.role === "sales" || p.role === "both";
          return true;
        })
        .map((p: Profile) => ({
          ...p,
          score: calcScore({ industries: myIndustries, regions: myRegions, seekingLevel: mySeekingLevel }, p),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      setRecommendations(scored);
      setLoading(false);
    }
    load();
  }, []);

  const levelLabel = (lv: number | null) =>
    lv === 3 ? "高層主管" : lv === 2 ? "中層主管" : lv === 1 ? "基層主管" : "";

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">EK</div>
          <span className="text-lg font-bold text-purple-900">ExKey</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">{name ? `${name}，為你推薦` : "推薦人脈"}</h1>
        <p className="text-sm text-gray-500 mb-6">
          {loading ? "正在尋找適合的合作夥伴..." : `為你準備了 ${recommendations.length} 位適合的合作夥伴`}
        </p>

        {loading && <div className="text-center py-12 text-gray-400">載入中...</div>}
        {!loading && recommendations.length === 0 && (
          <div className="text-center py-12 text-gray-400">目前還沒有適合的推薦，<br />等更多人加入後再回來看看！</div>
        )}

        <div className="space-y-4">
          {recommendations.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-900 flex items-center justify-center font-semibold text-lg">{p.name[0]}</div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    {p.name}
                    {p.is_verified && <span className="text-xs bg-gold-100 text-gold-900 px-2 py-0.5 rounded-full">已驗證</span>}
                  </div>
                  <div className="text-sm text-gray-500">
                    {p.role === "sales" ? "業務" : p.role === "vendor" ? "廠商" : "業務+廠商"}
                    {p.company ? `・${p.company}` : ""}
                    {p.level ? `・${levelLabel(p.level)}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">媒合度</div>
                  <div className="text-lg font-bold text-purple-600">{Math.min(p.score, 100)}%</div>
                </div>
              </div>
              {p.bio && <p className="text-sm text-gray-600 mb-3">{p.bio}</p>}
              <div className="flex flex-wrap gap-1 mb-3">
                {p.industries.slice(0, 3).map((ind) => (<span key={ind} className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">{ind}</span>))}
                {p.regions.slice(0, 2).map((reg) => (<span key={reg} className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded border border-purple-100">{reg}</span>))}
              </div>
              {revealedId === p.id ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">對方的 LINE ID</div>
                    <div className="font-semibold text-gray-900">{p.line_id || "（未提供）"}</div>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(p.line_id || "")} className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg">複製</button>
                </div>
              ) : (
                <button onClick={() => setRevealedId(p.id)} className="w-full bg-purple-600 text-white font-medium py-2.5 rounded-xl hover:bg-purple-400 transition">想合作，查看 LINE ID</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
