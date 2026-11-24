"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

// Google 官方登入按鈕。
// 舊做法是先跳到資料庫服務的網址再跳到 Google，Google 會把那串亂碼網址顯示成「你要登入的網站」。
// 這裡改成直接在我們自己的頁面上向 Google 取得登入憑證，再交給資料庫驗證，中間不經過那串網址。

// Google 用戶端 ID（公開資訊，會出現在每一次登入的網址裡，可以放在程式碼中；
// 「用戶端密碼」才是機密，只能放在資料庫後台，絕對不能出現在這裡）
const GOOGLE_CLIENT_ID = "340957779896-rholn1kg4146d0r4fllaojh8a2tj9e7g.apps.googleusercontent.com";

const GSI_SRC = "https://accounts.google.com/gsi/client";

interface GsiCredentialResponse {
  credential?: string;
}
interface GsiId {
  initialize: (opts: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}

function getGsi(): GsiId | null {
  const w = window as unknown as { google?: { accounts?: { id?: GsiId } } };
  return w.google && w.google.accounts && w.google.accounts.id ? w.google.accounts.id : null;
}

// 防偽用的一次性字串：原文交給資料庫，雜湊後的版本交給 Google，兩邊對得上才算數
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (getGsi()) return resolve();
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`) as HTMLScriptElement | null;
    const s = existing || document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("load failed")));
    if (!existing) {
      s.src = GSI_SRC;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
  });
}

export function googleButtonConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0 && !GOOGLE_CLIENT_ID.startsWith("__");
}

export default function GoogleSignInButton({
  label,
  disabled,
  onSuccess,
  onError,
  onUnavailable,
}: {
  label: "signin" | "signup";
  disabled?: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
  // 按鈕載不出來（被擋、LINE 內建瀏覽器等）時通知外層改用舊方式
  onUnavailable: () => void;
}) {
  const supabase = createClient();
  const holder = useRef<HTMLDivElement | null>(null);
  const nonceRef = useRef<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      try {
        await loadScript();
        const gsi = getGsi();
        if (cancelled || !gsi || !holder.current) {
          if (!cancelled && !gsi) onUnavailable();
          return;
        }
        const nonce = await makeNonce();
        nonceRef.current = nonce.raw;
        gsi.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          use_fedcm_for_prompt: true,
          callback: async (resp: GsiCredentialResponse) => {
            if (!resp.credential) {
              onError("Google 沒有回傳登入資料，請再試一次");
              return;
            }
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: resp.credential,
              nonce: nonceRef.current,
            });
            if (error) {
              onError("Google 登入失敗：" + error.message);
              return;
            }
            onSuccess();
          },
        });
        holder.current.innerHTML = "";
        gsi.renderButton(holder.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: label === "signup" ? "signup_with" : "signin_with",
          logo_alignment: "center",
          locale: "zh-TW",
          width: Math.min(400, Math.max(240, holder.current.offsetWidth || 320)),
        });
        setReady(true);
      } catch {
        if (!cancelled) onUnavailable();
      }
    }
    setup();
    return () => {
      cancelled = true;
    };
    // label 改變（登入／註冊切換）時重畫按鈕
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  return (
    <div className={`relative ${disabled ? "opacity-50" : ""}`}>
      <div ref={holder} className="flex justify-center min-h-[44px]" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">Google 登入載入中...</div>
      )}
      {/* 還沒勾同意條款時蓋一層擋住點擊 */}
      {disabled && <div className="absolute inset-0 cursor-not-allowed" />}
    </div>
  );
}
