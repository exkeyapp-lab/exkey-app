import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-purple-50">
      {/* Hero 區塊 */}
      <section className="bg-gradient-to-br from-purple-600 to-purple-900 text-white px-6 py-16">
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
                30 秒填寫身份、產業、地區，告訴系統你是誰、想找誰
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xl mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">智慧媒合推薦</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                系統根據產業、地區、人脈層級，自動推薦最適合你的合作對象
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <div className="w-14 h-14 bg-gold-100 rounded-full flex items-center justify-center text-gold-900 font-bold text-xl mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">直接聯繫合作</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                看到媒合對象的 LINE ID，立即聯繫，談合作不用再繞圈子
              </p>
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
              立即免費開始 →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-gray-400 border-t border-gray-100">
        © 2026 ExKey Lab · 關鍵人脈媒合平台
      </footer>
    </main>
  );
}
