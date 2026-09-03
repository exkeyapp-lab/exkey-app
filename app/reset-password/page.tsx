"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function ResetPassword() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // 從重設信連結進來時，網址會帶著臨時登入權杖；確認權杖有效才顯示表單
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setReady(true);
      } else {
        setInvalid(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit() {
    setError("");
    if (password.length < 6) {
      setError("密碼至少 6 個字元");
      return;
    }
    if (password !== password2) {
      setError("兩次輸入的密碼不一致");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError("設定失敗：" + err.message);
      return;
    }
    setDone(true);
  }

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6 flex items-center">
      <div className="max-w-md mx-auto w-full">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            EK
          </div>
          <span className="text-lg font-bold text-purple-900">ExKey</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          {!ready && !invalid && (
            <p className="text-center text-sm text-gray-400 py-4">確認連結中...</p>
          )}

          {invalid && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-700 mb-2">連結無效或已過期</p>
              <p className="text-xs text-gray-500 mb-4">請回登入頁重新申請一次重設密碼</p>
              <button
                onClick={() => router.push("/login")}
                className="text-sm text-purple-600 underline"
              >
                回登入頁
              </button>
            </div>
          )}

          {ready && done && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-700 mb-4">密碼已更新，之後請用新密碼登入</p>
              <button
                onClick={() => router.push("/member")}
                className="w-full bg-purple-600 text-white font-medium py-3 rounded-xl"
              >
                前往會員專區 →
              </button>
            </div>
          )}

          {ready && !done && (
            <div className="space-y-4">
              <h1 className="text-lg font-bold text-gray-900">設定新密碼</h1>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 個字元"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">再輸入一次</label>
                <input
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="確認新密碼"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                disabled={busy}
                onClick={handleSubmit}
                className="w-full bg-purple-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl"
              >
                {busy ? "設定中..." : "確認更新密碼"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
