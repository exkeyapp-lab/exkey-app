"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { levelLabel, PUBLIC_PROFILE_COLUMNS, type PublicProfile } from "@/lib/types";

interface SideSnapshot {
  industries: string[];
  regions: string[];
  departments: string[];
  level: number;
}

function emptySide(): SideSnapshot {
  return { industries: [], regions: [], departments: [], level: 0 };
}

// 單一維度計分：seekList 為空 = 不限，不計分也不扣分
function dimensionScore(seekList: string[], offerList: string[], weight: number): number {
  if (seekList.length === 0) return 0;
  const overlap = offerList.filter((v) => seekList.includes(v)).length;
  return overlap * weight;
}

// 職級門檻計分：seekLevel = 0 代表不限
function levelScore(seekLevel: number, offerLevel: number | null | undefined): number {
  if (!seekLevel) return 0;
  if (offerLevel == null) return 0;
  return offerLevel >= seekLevel ? 30 : 0;
}

// 單方向比對：某一方的「想找」對上另一方的「提供」
function oneDirectionScore(
  seek: SideSnapshot,
  offer: { industries: string[]; regions: string[]; departments: string[]; level: number | null | undefined }
): number {
  return (
    dimensionScore(seek.industries, offer.industries, 20) +
    dimensionScore(seek.regions, offer.regions, 15) +
    dimensionScore(seek.departments, offer.departments, 15) +
    levelScore(seek.level, offer.level)
  );
}

type Recommendation = PublicProfile & { score: number; mutual: boolean };

// 每張卡片的解鎖狀態
type UnlockState =
  | { stage: "idle" }
  | { stage: "confirm" }
  | { stage: "loading" }
  | { stage: "revealed"; lineId: string }
  | { stage: "error" };

export default function Discover() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [name, setName] = useState("");
  const [unlocks, setUnlocks] = useState<Record<string, UnlockState>>({});

  useEffect(() => {
    async function load() {
      const myName = sessionStorage.getItem("exkey_name") || "";
      setName(myName);

      let mySeek: SideSnapshot = emptySide();
      let myOffer: SideSnapshot = emptySide();
      try {
        mySeek = { ...emptySide(), ...JSON.parse(sessionStorage.getItem("exkey_seek") || "{}") };
      } catch {
        mySeek = emptySide();
      }
      try {
        myOffer = { ...emptySide(), ...JSON.parse(sessionStorage.getItem("exkey_offer") || "{}") };
      } catch {
        myOffer = emptySide();
      }
      const myHasOffer = sessionStorage.getItem("exkey_has_offer") === "true";

      const { data, error } = await supabase
        .from("profiles")
        .select(PUBLIC_PROFILE_COLUMNS)
        .eq("is_active", true);
      if (error || !data) {
        setLoading(false);
        return;
      }

      const scored = (data as unknown as PublicProfile[])
        .filter((p) => p.name !== myName)
        .map((p) => {
          // 主方向：我想找 vs 對方提供
          const primary = oneDirectionScore(mySeek, {
            industries: p.offer_industries || [],
            regions: p.offer_regions || [],
            departments: p.offer_departments || [],
            level: p.offer_level,
          });

          // 反方向：對方想找 vs 我提供（只有我有填提供側時才計算，達成「雙向互補」加分）
          let secondary = 0;
          if (myHasOffer) {
            secondary = oneDirectionScore(
              {
                industries: p.seek_industries || [],
                regions: p.seek_regions || [],
                departments: p.seek_departments || [],
                level: p.seek_level ?? 0,
              },
              {
                industries: myOffer.industries,
                regions: myOffer.regions,
                departments: myOffer.departments,
                level: myOffer.level,
              }
            );
          }

          return { ...p, score: primary + secondary, mutual: primary > 0 && secondary > 0 };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      setRecommendations(scored);
      setLoading(false);
    }
    load();
  }, []);

  function setUnlock(id: string, state: UnlockState) {
    setUnlocks((prev) => ({ ...prev, [id]: state }));
  }

  // 確認後才向伺服器要 LINE ID（一次一筆，伺服器端留下解鎖紀錄）
  async function handleUnlock(id: string) {
    setUnlock(id, { stage: "loading" });
    const { data, error } = await supabase.rpc("reveal_line_id", { target_id: id });
    if (error) {
      setUnlock(id, { stage: "error" });
      return;
    }
    setUnlock(id, { stage: "revealed", lineId: (data as string | null) || "" });
  }

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            EK
          </div>
          <span className="text-lg font-bold text-purple-900">ExKey</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">{name ? `${name}，為你推薦` : "推薦人脈"}</h1>
        <p className="text-sm text-gray-500 mb-6">
          {loading ? "正在尋找適合的合作夥伴..." : `為你準備了 ${recommendations.length} 位適合的合作夥伴`}
        </p>

        {loading && <div className="text-center py-12 text-gray-400">載入中...</div>}
        {!loading && recommendations.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            目前還沒有適合的推薦，
            <br />
            等更多人加入後再回來看看！
          </div>
        )}

        <div className="space-y-4">
          {recommendations.map((p) => {
            const unlock = unlocks[p.id] || { stage: "idle" };
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-900 flex items-center justify-center font-semibold text-lg">
                    {p.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {p.name}
                      {p.is_verified && (
                        <span className="text-xs bg-gold-100 text-gold-900 px-2 py-0.5 rounded-full">已驗證</span>
                      )}
                      {p.mutual && (
                        <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">雙向互補</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {p.role === "sales" ? "業務" : p.role === "vendor" ? "廠商" : "業務+廠商"}
                      {p.company ? `・${p.company}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">媒合度</div>
                    <div className="text-lg font-bold text-purple-600">{Math.min(p.score, 100)}%</div>
                  </div>
                </div>

                {p.bio && <p className="text-sm text-gray-600 mb-3">{p.bio}</p>}

                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">他能介紹</div>
                  {p.has_offer ? (
                    <div className="flex flex-wrap gap-1">
                      {(p.offer_industries || []).slice(0, 3).map((v) => (
                        <span key={`oi-${v}`} className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">
                          {v}
                        </span>
                      ))}
                      {(p.offer_regions || []).slice(0, 2).map((v) => (
                        <span
                          key={`or-${v}`}
                          className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded border border-purple-100"
                        >
                          {v}
                        </span>
                      ))}
                      {(p.offer_departments || []).slice(0, 2).map((v) => (
                        <span key={`od-${v}`} className="text-xs bg-gold-50 text-gold-900 px-2 py-1 rounded border border-gold-100">
                          {v}
                        </span>
                      ))}
                      {p.offer_level != null && (
                        <span className="text-xs bg-gold-50 text-gold-900 px-2 py-1 rounded border border-gold-100">
                          {levelLabel(p.offer_level)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">尚未填寫</div>
                  )}
                </div>

                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">他想找</div>
                  <div className="flex flex-wrap gap-1">
                    {(p.seek_industries || []).length === 0 &&
                    (p.seek_regions || []).length === 0 &&
                    (p.seek_departments || []).length === 0 &&
                    p.seek_level == null ? (
                      <span className="text-xs text-gray-400">不限</span>
                    ) : (
                      <>
                        {(p.seek_industries || []).slice(0, 3).map((v) => (
                          <span key={`si-${v}`} className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">
                            {v}
                          </span>
                        ))}
                        {(p.seek_regions || []).slice(0, 2).map((v) => (
                          <span
                            key={`sr-${v}`}
                            className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded border border-purple-100"
                          >
                            {v}
                          </span>
                        ))}
                        {(p.seek_departments || []).slice(0, 2).map((v) => (
                          <span key={`sd-${v}`} className="text-xs bg-gold-50 text-gold-900 px-2 py-1 rounded border border-gold-100">
                            {v}
                          </span>
                        ))}
                        {p.seek_level != null && (
                          <span className="text-xs bg-gold-50 text-gold-900 px-2 py-1 rounded border border-gold-100">
                            {levelLabel(p.seek_level)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {unlock.stage === "idle" && (
                  <button
                    onClick={() => setUnlock(p.id, { stage: "confirm" })}
                    className="w-full bg-purple-600 text-white font-medium py-2.5 rounded-xl hover:bg-purple-400 transition"
                  >
                    想合作，解鎖聯絡方式
                  </button>
                )}

                {unlock.stage === "confirm" && (
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                    <div className="text-sm font-medium text-gray-900 mb-1">解鎖 {p.name} 的聯絡方式</div>
                    <p className="text-xs text-gray-500 mb-3">
                      正式版將採會員點數制。<span className="font-medium text-purple-600">內測期間免費解鎖</span>，解鎖紀錄會保留。
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUnlock(p.id, { stage: "idle" })}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleUnlock(p.id)}
                        className="flex-1 bg-gold-600 text-purple-900 font-semibold py-2 rounded-lg text-sm"
                      >
                        免費解鎖
                      </button>
                    </div>
                  </div>
                )}

                {unlock.stage === "loading" && (
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center text-sm text-gray-500">
                    解鎖中...
                  </div>
                )}

                {unlock.stage === "revealed" && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500">對方的 LINE ID</div>
                      <div className="font-semibold text-gray-900">{unlock.lineId || "（未提供）"}</div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(unlock.lineId)}
                      className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg"
                    >
                      複製
                    </button>
                  </div>
                )}

                {unlock.stage === "error" && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm text-red-600 mb-2">解鎖失敗，請稍後再試</p>
                    <button
                      onClick={() => handleUnlock(p.id)}
                      className="text-sm text-purple-600 underline"
                    >
                      重試
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
