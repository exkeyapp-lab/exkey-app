"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Mode = "login" | "register";

export default function Login() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setBusy(true);
    setError("");

    if (mode === "register") {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) {
        setError(
          err.message.includes("already registered")
            ? "這個 Email 已經註冊過了，請直接登入"
            : "註冊失敗：" + err.message
        );
        setBusy(false);
        return;
      }
      // 註冊成功即為登入狀態，前往填寫人脈資料
      router.push("/onboarding");
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(
        err.message.includes("Invalid login credentials")
          ? "Email 或密碼錯誤"
          : "登入失敗：" + err.message
      );
      setBusy(false);
      return;
    }
    router.push("/member");
  }

  const disabled = busy || !email.trim() || password.length < 6;

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
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                mode === "login" ? "bg-purple-600 text-white" : "bg-purple-50 text-gray-600"
              }`}
            >
              登入
            </button>
            <button
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                mode === "register" ? "bg-purple-600 text-white" : "bg-purple-50 text-gray-600"
              }`}
            >
              註冊新帳號
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 個字元"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              disabled={disabled}
              onClick={handleSubmit}
              className="w-full bg-purple-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl"
            >
              {busy ? "處理中..." : mode === "login" ? "登入" : "註冊並開始"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              {mode === "login" ? "還沒有帳號？點上方「註冊新帳號」" : "註冊即表示同意平台內測條款"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
