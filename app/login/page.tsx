"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const SITE_URL = "https://exkey-app.vercel.app";

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
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [needConfirm, setNeedConfirm] = useState(false);
  const [resent, setResent] = useState(false);

  // Google 登入：導向 Google 授權頁，完成後回到會員專區
  async function handleGoogle() {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${SITE_URL}/member` },
    });
    if (err) {
      setError("Google 登入失敗：" + err.message);
      setBusy(false);
    }
  }

  // 重寄驗證信（註冊後沒收到、或登入時發現還沒驗證）
  async function resendConfirm() {
    setError("");
    setResent(false);
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

  async function handleSubmit() {
    setBusy(true);
    setError("");
    setNeedConfirm(false);

    if (mode === "forgot") {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${SITE_URL}/reset-password`,
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
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${SITE_URL}/onboarding` },
      });
      if (err) {
        const m = err.message.toLowerCase();
        setError(
          m.includes("already registered")
            ? "這個 Email 已經註冊過了，請直接登入"
            : m.includes("rate limit") || m.includes("security purposes")
            ? "短時間內嘗試次數過多，請等幾分鐘再試"
            : "註冊失敗：" + err.message
        );
        setBusy(false);
        return;
      }
      // Supabase 對已存在的 Email 會回傳一個沒有 identities 的假成功
      const u = data.user;
      if (u && Array.isArray(u.identities) && u.identities.length === 0) {
        setError("這個 Email 已經註冊過了，請直接登入");
        setBusy(false);
        return;
      }
      if (!data.session) {
        // 需要信箱驗證
        setSent(true);
        setBusy(false);
        return;
      }
      router.push("/onboarding");
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      const m = err.message.toLowerCase();
      if (m.includes("not confirmed")) {
        setNeedConfirm(true);
        setError("這個 Email 還沒完成驗證，請先到信箱點驗證連結");
      } else if (m.includes("invalid login credentials")) {
        setError("Email 或密碼錯誤");
      } else {
        setError("登入失敗：" + err.message);
      }
      setBusy(false);
      return;
    }
    router.push("/member");
  }

  const disabled =
    busy ||
    !email.trim() ||
    (mode !== "forgot" && password.length < 6) ||
    (mode === "register" && !agreedTerms);

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setSent(false);
    setNeedConfirm(false);
    setResent(false);
  }

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6 flex items-center">
      <div className="max-w-md mx-auto w-full">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              EK
            </div>
            <span className="text-lg font-bold text-purple-900">ExKey</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          {mode !== "forgot" && !sent && (
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

          {mode !== "forgot" && !sent && (
            <>
              <button
                onClick={handleGoogle}
                disabled={busy || (mode === "register" && !agreedTerms)}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
                  />
                </svg>
                使用 Google 帳號{mode === "register" ? "註冊" : "登入"}
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">或用 Email</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            </>
          )}

          {mode === "forgot" && !sent && (
            <div className="mb-6">
              <h1 className="text-lg font-bold text-gray-900">重設密碼</h1>
              <p className="text-xs text-gray-500 mt-1">
                輸入註冊時使用的 Email，我們會寄一封重設密碼的信給你
              </p>
            </div>
          )}

          {/* 忘記密碼：已寄出 */}
          {mode === "forgot" && sent && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-700 mb-2">重設信已寄出</p>
              <p className="text-xs text-gray-500 mb-4">
                請到 {email} 收信（找不到請翻垃圾信件匣），點信中連結設定新密碼
              </p>
              <button onClick={() => switchMode("login")} className="text-sm text-purple-600 underline">
                回登入頁
              </button>
            </div>
          )}

          {/* 註冊：驗證信已寄出 */}
          {mode === "register" && sent && (
            <div className="py-2">
              <h1 className="text-lg font-bold text-purple-900 mb-2">驗證信已寄出</h1>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                已寄到 <span className="font-semibold text-gray-900">{email}</span>
                。打開信件、點裡面的連結完成驗證，接著就能建立你的人脈檔案。找不到信請翻垃圾信件匣。
              </p>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              {resent && !error && <p className="text-sm text-green-600 mb-3">已重新寄出</p>}
              <button
                onClick={() => {
                  switchMode("login");
                }}
                className="w-full bg-gold-600 text-purple-900 font-semibold py-3 rounded-xl mb-3"
              >
                我已驗證，去登入
              </button>
              <button onClick={resendConfirm} className="w-full text-sm text-purple-600 underline py-2">
                沒收到？重寄驗證信
              </button>
            </div>
          )}

          {!sent && (
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

              {mode === "register" && (
                <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    我已閱讀並同意{" "}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 underline"
                    >
                      服務條款與隱私權政策
                    </a>
                  </span>
                </label>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
              {needConfirm && (
                <div className="bg-gold-50 border border-gold-100 rounded-xl p-3">
                  {resent ? (
                    <p className="text-xs text-green-700">驗證信已重新寄出，請到 {email} 收信</p>
                  ) : (
                    <button onClick={resendConfirm} className="text-xs text-purple-600 underline">
                      沒收到驗證信？點此重寄
                    </button>
                  )}
                </div>
              )}

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
                  ? "註冊並寄驗證信"
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
                  ? "勾選上方同意條款後即可註冊，送出後會寄驗證信到你的 Email"
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
