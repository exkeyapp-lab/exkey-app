"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { levelLabel, PUBLIC_PROFILE_COLUMNS, type PublicProfile } from "@/lib/types";

export default function Member() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [unlockedTimes, setUnlockedTimes] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setEmail(userData.user.email || "");

      const { data } = await supabase
        .from("profiles")
        .select(PUBLIC_PROFILE_COLUMNS)
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      setProfile(data && data.length > 0 ? (data[0] as unknown as PublicProfile) : null);

      const { data: wallet } = await supabase.rpc("get_my_wallet");
      if (wallet) {
        if (typeof wallet.points === "number") setPoints(wallet.points);
        if (typeof wallet.unlocked_times === "number") setUnlockedTimes(wallet.unlocked_times);
      }
      setLoading(false);
    }
    load();
  }, []);

  // 把自己的配對條件放進 sessionStorage，讓推薦頁在任何裝置登入後都能正確計分
  function goDiscover() {
    if (profile) {
      sessionStorage.setItem("exkey_name", profile.name);
      sessionStorage.setItem("exkey_role", profile.role);
      sessionStorage.setItem(
        "exkey_seek",
        JSON.stringify({
          industries: profile.seek_industries || [],
          regions: profile.seek_regions || [],
          departments: profile.seek_departments || [],
          level: profile.seek_level ?? 0,
        })
      );
      sessionStorage.setItem("exkey_has_offer", String(profile.has_offer));
      sessionStorage.setItem(
        "exkey_offer",
        JSON.stringify({
          industries: profile.offer_industries || [],
          regions: profile.offer_regions || [],
          departments: profile.offer_departments || [],
          level: profile.offer_level ?? 0,
        })
      );
    }
    router.push("/discover");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function Tags({ items, level }: { items: string[]; level: number | null }) {
    const empty = items.length === 0 && level == null;
    if (empty) return <span className="text-xs text-gray-400">不限</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((v) => (
          <span key={v} className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">
            {v}
          </span>
        ))}
        {level != null && level > 0 && (
          <span className="text-xs bg-gold-50 text-gold-900 px-2 py-1 rounded border border-gold-100">
            {levelLabel(level)}
          </span>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              EK
            </div>
            <span className="text-lg font-bold text-purple-900">ExKey</span>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-500 underline">
            登出
          </button>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">會員專區</h1>
        <p className="text-sm text-gray-500 mb-6">{email}</p>

        {loading && <div className="text-center py-12 text-gray-400">載入中...</div>}

        {!loading && !profile && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
            <p className="text-gray-600 mb-4">你還沒有建立人脈檔案</p>
            <button
              onClick={() => router.push("/onboarding")}
              className="w-full bg-purple-600 text-white font-medium py-3 rounded-xl"
            >
              開始建立 →
            </button>
          </div>
        )}

        {!loading && profile && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-gray-900">{profile.name}</div>
                <span className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded-full">免費會員</span>
              </div>
              <div className="text-sm text-gray-500">
                {profile.role === "sales" ? "業務" : profile.role === "vendor" ? "廠商" : "業務+廠商"}
                {profile.company ? `・${profile.company}` : ""}
              </div>
              {profile.bio && <p className="text-sm text-gray-600 mt-2">{profile.bio}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <div className="text-2xl font-bold text-gold-900">{points ?? "—"}</div>
                <div className="text-xs text-gray-400 mt-1">點數餘額</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <div className="text-2xl font-bold text-purple-600">{unlockedTimes ?? "—"}</div>
                <div className="text-xs text-gray-400 mt-1">檔案被解鎖次數</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-xs text-gray-400 mb-1">我想找的人脈</div>
              <Tags items={profile.seek_industries || []} level={profile.seek_level} />
              <div className="mt-2">
                <Tags items={[...(profile.seek_regions || []), ...(profile.seek_departments || [])]} level={null} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-xs text-gray-400 mb-1">我能介紹的人脈</div>
              {profile.has_offer ? (
                <>
                  <Tags items={profile.offer_industries || []} level={profile.offer_level} />
                  <div className="mt-2">
                    <Tags items={[...(profile.offer_regions || []), ...(profile.offer_departments || [])]} level={null} />
                  </div>
                </>
              ) : (
                <span className="text-xs text-gray-400">尚未填寫</span>
              )}
            </div>

            <button
              onClick={goDiscover}
              className="w-full bg-gold-600 text-purple-900 font-semibold py-3 rounded-xl"
            >
              查看為我推薦的人脈 →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
