import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 text-white flex items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full text-center">
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

        {/* Footer */}
        <div className="mt-16 text-sm opacity-50">
          © 2026 ExKey Lab
        </div>
      </div>
    </main>
  );
}
