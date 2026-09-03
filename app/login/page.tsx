"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Mode = "login" | "register" | "forgot";

export default function Login() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    setError("");

    if (mode === "forgot") {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://exkey-app.vercel.app/reset-password",
      });
      setBusy(false);
      if (err) {
        setError(
          err.message.toLowerCase().includes("rate limit")
            ? "短時間內寄送次數過多，請稍後再試"
            : "寄送失敗：" + err.message
        );
        return;
      }
      setSent(true);
      return;
    }

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

  const disabled =
    busy || !email.trim() || (mode !== "forgot" && password.length < 6);

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setSent(false);
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
          {mode !== "forgot" && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => switchMode("login")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  mode === "login" ? "bg-purple-600 text-white" : "bg-purple-50 text-gray-600"
                }`}
              >
                登入
              </button>
              <button
                onClick={() => switchMode("register")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  mode === "register" ? "bg-purple-600 text-white" : "bg-purple-50 text-gray-600"
                }`}
              >
                註冊新帳號
              </button>
            </div>
          )}

          {mode === "forgot" && (
            <div className="mb-6">
              <h1 className="text-lg font-bold text-gray-900">重設密碼</h1>
              <p className="text-xs text-gray-500 mt-1">
                輸入註冊時使用的 Email，我們會寄一封重設密碼的信給你
              </p>
            </div>
          )}

          {mode === "forgot" && sent ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-700 mb-2">重設信已寄出</p>
              <p className="text-xs text-gray-500 mb-4">
                請到 {email} 收信（找不到請翻垃圾信件匣），點信中連結設定新密碼
              </p>
              <button
                onClick={() => switchMode("login")}
                className="text-sm text-purple-600 underline"
              >
                回登入頁
              </button>
            </div>
          ) : (
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
              {mode !== "forgot" && (
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
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                disabled={disabled}
                onClick={handleSubmit}
                className="w-full bg-purple-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl"
              >
                {busy
                  ? "處理中..."
                  : mode === "login"
                  ? "登入"
                  : mode === "register"
                  ? "註冊並開始"
                  : "寄送重設信"}
              </button>

              {mode === "login" && (
                <button
                  onClick={() => switchMode("forgot")}
                  className="w-full text-xs text-gray-400 underline"
                >
                  忘記密碼？
                </button>
              )}

              <p className="text-xs text-gray-400 text-center">
                {mode === "login"
                  ? "還沒有帳號？點上方「註冊新帳號」"
                  : mode === "register"
                  ? "註冊即表示同意平台內測條款"
                  : ""}
              </p>
              {mode === "forgot" && (
                <button
                  onClick={() => switchMode("login")}
                  className="w-full text-xs text-gray-400 underline"
                >
                  回登入頁
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
