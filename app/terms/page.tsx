import Link from "next/link";

export const metadata = {
  title: "服務條款與隱私權政策 · ExKey",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-purple-900 mb-3">{title}</h2>
      <div className="space-y-2 text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

export default function Terms() {
  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              EK
            </div>
            <span className="text-lg font-bold text-purple-900">ExKey</span>
          </Link>
          <Link href="/login" className="text-sm text-gray-500 underline">
            會員登入
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">服務條款與隱私權政策</h1>
        <p className="text-xs text-gray-400 mb-8">最後更新：2026 年 9 月</p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm text-gray-700 leading-relaxed mb-8">
            「ExKey 關鍵人脈網」（下稱本平台）依本服務條款提供人脈媒合服務。當您註冊會員或使用本服務時，
            即表示您已閱讀、瞭解並同意本服務條款之全部內容。本平台得於必要時修改本條款，重大變更將於平台公告；
            若您不同意修改後之內容，應停止使用本服務。
          </p>

          <Section title="一、服務內容">
            <p>1. 本平台為商業人脈媒合之資訊中介服務：會員登載「想找的人脈」與「可介紹的人脈」資訊，由系統進行配對與推薦。</p>
            <p>2. 會員間的實際聯繫，透過本平台之「解鎖聯絡方式」機制取得對方留存之 LINE ID 後，由會員自行進行。</p>
            <p>3. 本平台得視營運需要調整服務內容、功能與收費方式。</p>
          </Section>

          <Section title="二、會員帳號">
            <p>1. 註冊時應提供正確、最新之電子郵件，並妥善保管密碼；帳號不得轉讓、出借或供第三人使用。</p>
            <p>2. 會員應確保其人脈檔案（含姓名或稱呼、公司、職務、產業、地區、部門、職級、LINE ID 等）為本人有權提供且內容真實；檔案內容由會員自行負責。</p>
            <p>3. 每一自然人以註冊一個帳號為原則。以不實資料註冊、大量註冊或以自動化程式註冊者，本平台得逕行停權並取消其點數。</p>
          </Section>

          <Section title="三、禁止行為">
            <p>會員不得利用本服務從事下列行為，違者本平台得暫停或終止其帳號，情節重大者將依法處理：</p>
            <p>1. 傳送或登載誹謗、詐欺、猥褻、暴力或其他違反法令之內容。</p>
            <p>2. 侵害他人智慧財產權、營業秘密、隱私權或其他權利。</p>
            <p>3. 未經同意收集其他會員之聯絡方式或個人資料，或將解鎖取得之聯絡方式提供、轉售予第三人。</p>
            <p>4. 傳送廣告信、垃圾訊息，或以本服務進行與人脈媒合無關之招攬行為。</p>
            <p>5. 以任何技術手段干擾平台運作、未經授權存取系統，或竊取他人帳號。</p>
            <p>6. 冒用他人名義建立人脈檔案，或登載未經當事人同意提供之第三人聯絡方式。</p>
          </Section>

          <Section title="四、點數條款">
            <p>1. 本平台採點數制：解鎖一位會員之聯絡方式扣除 10 點。已解鎖之對象可免費重複查看，不重複扣點。</p>
            <p>2. 點數取得方式：購買（現行方案為 100 點新臺幣 500 元）、註冊禮、分享活動贈點，或本平台不定期之活動贈點。</p>
            <p>3. 購買點數即表示同意本條款。點數僅供於本平台使用服務，其所有權歸本平台，會員取得者為使用權；點數不得轉讓、轉售，亦不得兌換現金或其他等價物。</p>
            <p>4. 購買之點數無使用期限。免費取得之贈點，本平台保留調整或使其失效之權利。</p>
            <p>5. 退費與契約解除：</p>
            <p className="pl-4">
              (1) 購買點數後七日內，且該筆點數完全未使用者，得以電子郵件（exkey.app@gmail.com）向本平台申請解除該筆交易，經確認後全額退費。
            </p>
            <p className="pl-4">
              (2) 該筆點數一經使用（含任何一次解鎖聯絡方式），即視為線上服務已開始提供。會員同意本平台點數屬「非以有形媒介提供之數位內容及一經提供即為完成之線上服務」，依通訊交易解除權合理例外情事適用準則，不適用消費者保護法第十九條第一項之七日解除權；除法律另有規定外，不予退費。
            </p>
            <p className="pl-4">(3) 會員因違反本條款遭停權者，其帳號內之點數不予返還。</p>
            <p>6. 本平台得調整點數售價與使用方式，調整前已購得之點數不受影響。</p>
            <p>7. 每筆點數之取得與使用均有系統紀錄，如有疑義以平台紀錄為準。</p>
          </Section>

          <Section title="五、會員間之合作與交易">
            <p>1. 會員經由本服務取得聯絡方式後之一切聯繫、洽談、合作、買賣或其他交易行為，均屬會員間之自主行為，其權利義務僅存在於會員雙方之間。</p>
            <p>2. 本平台不介入、不擔保會員所登載資訊之正確性，亦不擔保任何合作或交易之成立、履行與結果。</p>
            <p>3. 會員間因合作或交易所生之爭議，應由會員雙方自行解決或依法尋求救濟。</p>
          </Section>

          <Section title="六、服務終止">
            <p>會員有下列情形之一者，本平台得暫停或永久終止其使用本服務，必要時並得請求損害賠償：</p>
            <p>1. 違反本條款或現行法令。</p>
            <p>2. 干擾本平台系統運作或影響其他會員權益。</p>
            <p>3. 登載不實、冒用或侵權之資訊。</p>
            <p>本服務終止時，本平台就會員之點數與資料之處理依第四條及隱私權政策辦理；除本條款另有規定外，本平台對會員或第三人不負賠償責任。</p>
          </Section>

          <Section title="七、免責聲明">
            <p>您明確瞭解並同意：</p>
            <p>1. 本平台為資訊中介，平台上之人脈資訊均由會員自行登載，本平台不保證其正確性、完整性或時效性。</p>
            <p>2. 本平台不保證服務不中斷、無錯誤，或經由本服務取得之結果必然符合您的期待。</p>
            <p>3. 於法律許可之最大範圍內，本平台及其經營者、受僱人、代理人，對您因使用本服務所生之直接、間接、附隨、衍生或懲罰性損害不負賠償責任。</p>
          </Section>

          <Section title="八、管轄法院與準據法">
            <p>本條款之解釋與適用，及與本服務有關之爭議，均以中華民國法律為準據法，並以臺灣新竹地方法院為第一審管轄法院。</p>
          </Section>

          <div className="border-t border-gray-100 pt-8 mt-8">
            <h2 className="text-xl font-bold text-purple-900 mb-6">隱私權政策</h2>

            <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
              <p>
                <span className="font-semibold">1. 收集項目：</span>
                電子郵件、姓名或稱呼、公司名稱、職務相關資訊（產業、地區、部門、職級）、LINE ID，
                以及平台使用紀錄（含頁面瀏覽統計、點數異動與聯絡方式解鎖紀錄）。
              </p>
              <p>
                <span className="font-semibold">2. 利用目的：</span>
                提供人脈媒合服務、會員與點數管理、收費與對帳、平台安全維護及服務改善。
              </p>
              <p>
                <span className="font-semibold">3. 利用範圍：</span>
                您的 LINE ID 僅於其他會員完成解鎖程序後提供予該會員，不對未登入之訪客或未解鎖之會員公開；
                其餘檔案資訊於平台內供已登入會員瀏覽與配對。本平台不會將您的個人資料出售或提供予無關之第三人。
              </p>
              <p>
                <span className="font-semibold">4. 資料處理之委託：</span>
                本平台使用具業界標準安全防護之雲端服務儲存與處理資料，該等服務商僅於提供技術服務之必要範圍內處理資料。
              </p>
              <p>
                <span className="font-semibold">5. 會員權利：</span>
                您得依《個人資料保護法》請求查詢、閱覽、補充、更正或刪除您的個人資料，或請求停止收集、處理及利用；
                行使方式請透過平台聯絡信箱 exkey.app@gmail.com 提出。
              </p>
              <p>
                <span className="font-semibold">6. 資料保存：</span>
                點數異動與解鎖紀錄為收費對帳及爭議處理之依據，於帳號刪除後仍保留法定必要期間；
                其餘資料於帳號刪除後於合理期間內刪除或去識別化。
              </p>
              <p>
                <span className="font-semibold">7.</span> 本政策修訂時將於平台公告。
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link href="/" className="text-sm text-purple-600 underline">
            回首頁
          </Link>
        </div>
      </div>
    </main>
  );
}
