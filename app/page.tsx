import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-purple-50">
      {/* Hero 區塊 */}
      <section className="bg-gradient-to-br from-purple-600 to-purple-900 text-white px-6 py-16">
        <div className="max-w-2xl mx-auto flex justify-end mb-2">
          <Link
            href="/login"
            className="text-sm text-purple-100 hover:text-white underline underline-offset-4"
          >
            會員登入
          </Link>
        </div>
        <div className="max-w-2xl mx-auto text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-900 font-bold text-lg">
              EK
            </div>
            <span className="text-2xl font-bold tracking-wide">ExKey</span>
          </div>

          {/* Badge */}
          <div className="inline-block bg-gold-600 bg-opacity-20 border border-gold-400 text-gold-100 text-sm px-4 py-1 rounded-full mb-6">
            ✨ 業務 × 廠商 智慧媒合平台
          </div>

          {/* Main Title */}
          <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">
            沒關係 <span className="text-gold-400">找</span> 關係
          </h1>
          <p className="text-xl opacity-90 mb-4">的關鍵人脈網</p>

          <p className="text-base opacity-80 mb-10 leading-relaxed">
            ExKey 幫業務找到有產品代理需求的廠商，<br />
            讓廠商找到有通路的業務代理
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/onboarding"
              className="bg-gold-600 hover:bg-gold-400 text-purple-900 font-semibold px-8 py-4 rounded-full transition shadow-lg"
            >
              免費開始媒合 →
            </Link>
            <Link
              href="#how"
              className="bg-purple-100 bg-opacity-10 hover:bg-opacity-20 border border-purple-100 text-white font-medium px-8 py-4 rounded-full transition"
            >
              了解運作方式
            </Link>
          </div>
          <p className="text-sm opacity-70 mt-4">免費註冊，約兩分鐘完成，不需要信用卡</p>
        </div>
      </section>

      {/* 運作方式區塊 */}
      <section id="how" className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">
            三步驟，找到關鍵合作夥伴
          </h2>
          <p className="text-center text-gray-500 mb-12">
            不用再靠運氣和人情，讓系統幫你精準媒合
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xl mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">建立你的檔案</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                填寫你的找人脈與介紹人脈，告訴系統你想認識誰、能介紹誰
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xl mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">自動媒合</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                系統根據產業、地區、部門、層級，自動媒合最適合你的關鍵人脈
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <div className="w-14 h-14 bg-gold-100 rounded-full flex items-center justify-center text-gold-900 font-bold text-xl mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">立即連繫</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                取得關鍵人脈的 LINE ID，立即連繫，談合作不用再繞圈子
              </p>
            </div>
          </div>

          {/* LINE ID 誰看得到 */}
          <p className="text-center text-sm text-gray-500 mt-6 leading-relaxed">
            你的 LINE ID 不會公開顯示，只有對你按下「立即連繫」的會員看得到。
            <br className="hidden sm:block" />
            平台不會把你的個人資料出售或提供給無關的第三人，詳見
            <Link href="/terms" className="text-purple-600 underline mx-0.5">
              隱私權政策
            </Link>
            。
          </p>

          {/* 媒合結果範例 */}
          <div className="mt-12">
            <h3 className="text-center text-lg font-semibold text-gray-900 mb-1">媒合結果長這樣</h3>
            <p className="text-center text-xs text-gray-400 mb-5">以下為示意範例，非真實會員資料</p>
            <div className="max-w-sm mx-auto bg-white rounded-2xl border border-purple-100 shadow-sm p-5 text-left">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
                  陳
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-purple-900">陳先生</div>
                  <div className="text-sm text-gray-500">業務・設備代理商</div>
                  <span className="inline-block mt-1.5 text-[11px] bg-purple-600 text-white px-2 py-0.5 rounded-full">
                    超級伙伴
                  </span>
                </div>
                <div className="text-center shrink-0">
                  <div className="text-2xl font-bold text-purple-900 leading-none">14</div>
                  <div className="text-[10px] text-gray-400 mt-1">筆連上</div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex gap-3">
                  <div className="w-1 rounded-full bg-purple-600 shrink-0" />
                  <div>
                    <div className="text-[11px] font-semibold text-purple-600">他能介紹你要找的</div>
                    <div className="text-sm text-gray-900">
                      連上 <span className="font-bold text-purple-900">12</span> 筆
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">新竹市・半導體・採購・經理級 等</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-1 rounded-full bg-gold-600 shrink-0" />
                  <div>
                    <div className="text-[11px] font-semibold text-gold-900">他在找你能介紹的</div>
                    <div className="text-sm text-gray-900">
                      連上 <span className="font-bold text-purple-900">2</span> 筆
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">台南・化工材料・廠務・高階主管 等</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 bg-gold-600 text-purple-900 text-center font-semibold py-2.5 rounded-xl text-sm">
                立即連繫
              </div>
            </div>
          </div>

          {/* 為誰打造 */}
          <div className="mt-16 grid md:grid-cols-2 gap-6">
            <div className="bg-purple-100 rounded-2xl p-6">
              <div className="text-2xl mb-2">💼</div>
              <h3 className="font-semibold text-purple-900 mb-2">如果你是業務</h3>
              <p className="text-sm text-purple-900 opacity-80 leading-relaxed">
                你有客戶通路，但缺好產品代理？ExKey 幫你找到願意給你代理權的優質廠商，把你的人脈變現。
              </p>
            </div>
            <div className="bg-gold-100 rounded-2xl p-6">
              <div className="text-2xl mb-2">🏭</div>
              <h3 className="font-semibold text-gold-900 mb-2">如果你是廠商</h3>
              <p className="text-sm text-gold-900 opacity-80 leading-relaxed">
                你有好產品，但打不進市場？ExKey 幫你找到有通路、有客戶關係的業務代理，加速擴展業績。
              </p>
            </div>
          </div>

          {/* 底部 CTA */}
          <div className="text-center mt-12">
            <Link
              href="/onboarding"
              className="inline-block bg-purple-600 hover:bg-purple-400 text-white font-semibold px-10 py-4 rounded-full transition shadow-lg"
            >
              免費開始媒合 →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-gray-400 border-t border-gray-100">
        <div className="mb-2">
          <Link href="/terms" className="text-gray-500 underline hover:text-purple-600">
            服務條款與隱私權政策
          </Link>
          <span className="mx-2 text-gray-300">|</span>
          聯絡我們：
          <a href="mailto:exkey.app@gmail.com" className="text-gray-500 underline hover:text-purple-600">
            exkey.app@gmail.com
          </a>
        </div>
        © 2026 ExKey Lab · 關鍵人脈媒合平台
      </footer>
    </main>
  );
}
