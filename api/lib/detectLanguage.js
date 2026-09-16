// Broad, dependency-free language detection for short chat messages.
// It combines Unicode-script detection with common-word scoring for
// languages that share the Latin/Cyrillic alphabets. It returns ISO-639-1
// codes so the admin dashboard can display any language dynamically.

const WORD_LISTS = {
  en: 'the and you your what how why where when can could would should with from for this that are was were have has do does not into about please hello thanks thank'.split(' '),
  es: 'el la los las un una unos unas y o de del que qué como cómo cuál cuáles donde dónde está están para por porque gracias hola necesito quiero puedo ayuda con esto'.split(' '),
  fr: 'le la les un une des et ou de du que quoi comment quel quelle où est sont pour par parce merci bonjour besoin je vous pouvez aide avec dans pas'.split(' '),
  pt: 'o a os as um uma uns umas e ou de do da que como quantos quantas qual quais onde está estão para por porque obrigado obrigada olá preciso quero posso ajuda não são com'.split(' '),
  de: 'der die das den dem des ein eine einer einen und oder von zu zum zur was wie warum wo wann ist sind für mit nicht danke hallo bitte ich sie'.split(' '),
  it: 'il lo la i gli le un una e o di del della che cosa come quale dove è sono per perché grazie ciao bisogno voglio posso aiuto con non'.split(' '),
  nl: 'de het een en of van voor met wat hoe waarom waar wanneer is zijn niet dank hallo bedankt ik jij je jullie'.split(' '),
  pl: 'i oraz lub nie jest są że jak gdzie kiedy dlaczego dla z ze na do czy dziękuję cześć proszę potrzebuję chcę mogę pomoc'.split(' '),
  cs: 'a nebo ale není je jsou že jak kde kdy proč pro s se na do co děkuji ahoj prosím potřebuji chci můžu pomoc'.split(' '),
  sk: 'a alebo ale nie je sú že ako kde kedy prečo pre s so na do čo ďakujem ahoj prosím potrebujem chcem môžem môžeš môžete pomoc pomôž pomôže spraviť urobiť povedať odpoveď otázka otázku mám máš máme váš vaša moje som sme bude bolo ktorý ktorá ktoré ešte tiež veľmi teraz'.split(' '),
  sl: 'in ali ampak ni je so da kako kje kdaj zakaj za s na do kaj hvala živjo prosim potrebujem želim lahko pomoč'.split(' '),
  hr: 'i ili ali nije je su da kako gdje kada zašto za s sa na do što hvala bok molim trebam želim mogu pomoć'.split(' '),
  sr: 'i ili ali nije je su da kako gde kada zašto za s sa na do šta hvala zdravo molim treba želim mogu pomoć'.split(' '),
  ro: 'și sau este sunt că cum unde când de ce pentru cu nu mulțumesc salut vă rog am nevoie vreau pot ajutor'.split(' '),
  hu: 'és vagy nem van vannak hogy hogyan hol mikor miért számára mert köszönöm szia kérem szeretnék tudok segítség'.split(' '),
  tr: 've veya bir bu şu ne nasıl neden nerede ne zaman için ile değil teşekkür merhaba lütfen istiyorum yapabilir yardım'.split(' '),
  sv: 'och eller inte är det som hur varför var när för med tack hej snälla jag du kan hjälp'.split(' '),
  no: 'og eller ikke er det som hvordan hvorfor hvor når for med takk hei vær så snill jeg du hjelp'.split(' '),
  da: 'og eller ikke er det som hvordan hvorfor hvor hvornår for med tak hej venligst jeg du hjælp'.split(' '),
  fi: 'ja tai ei on ovat että miten miksi missä milloin varten kanssa kiitos hei ole hyvä haluan voin apua'.split(' '),
  et: 'ja või ei on ongi kuidas miks kus millal jaoks koos aitäh tere palun tahan saan abi'.split(' '),
  lv: 'un vai nav ir kāpēc kur kad par ar paldies sveiki lūdzu gribu varu palīdzība'.split(' '),
  lt: 'ir arba ne yra kaip kodėl kur kada už su ačiū sveiki prašau noriu galiu pagalba'.split(' '),
  id: 'dan atau tidak adalah yang bagaimana mengapa dimana kapan untuk dengan terima kasih halo tolong saya kamu bisa bantuan'.split(' '),
  ms: 'dan atau tidak ialah yang bagaimana mengapa di mana bila untuk dengan terima kasih hai sila saya awak boleh bantuan'.split(' '),
  vi: 'và hoặc không là những như thế nào tại sao ở đâu khi nào cho với cảm ơn xin chào làm ơn tôi bạn có thể giúp'.split(' '),
  uk: 'і або не є це як де коли чому для з за що дякую привіт будь ласка потрібно хочу можу допомога'.split(' '),
  ru: 'и или не это как где когда почему для с что спасибо привет пожалуйста нужно хочу могу помощь'.split(' '),
  bg: 'и или не е това как къде кога защо за с какво благодаря здравей моля трябва искам мога помощ'.split(' '),
  mk: 'и или не е тоа како каде кога зошто за со што благодарам здраво ве молам треба сакам можам помош'.split(' '),
  el: 'και ή δεν είναι αυτό πως πώς γιατί πού πότε για με ευχαριστώ γεια παρακαλώ θέλω μπορώ βοήθεια'.split(' '),
  ar: 'و أو لا هذا كيف لماذا أين متى من مع شكرا مرحبا من فضلك أريد أستطيع مساعدة'.split(' '),
  fa: 'و یا نه این چگونه چرا کجا کی برای با ممنون سلام لطفا میخواهم میتوانم کمک'.split(' '),
  he: 'ו או לא זה איך למה איפה מתי בשביל עם תודה שלום בבקשה רוצה יכול עזרה'.split(' '),
  hi: 'और या नहीं है यह कैसे क्यों कहाँ कब के लिए साथ धन्यवाद नमस्ते कृपया चाहता सकती मदद'.split(' '),
  bn: 'এবং অথবা নয় এই কীভাবে কেন কোথায় কখন জন্য সঙ্গে ধন্যবাদ হ্যালো অনুগ্রহ করে চাই সাহায্য'.split(' '),
  pa: 'ਅਤੇ ਜਾਂ ਨਹੀਂ ਇਹ ਕਿਵੇਂ ਕਿਉਂ ਕਿੱਥੇ ਕਦੋਂ ਲਈ ਨਾਲ ਧੰਨਵਾਦ ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਕਿਰਪਾ ਚਾਹੁੰਦਾ ਮਦਦ'.split(' '),
  ta: 'மற்றும் அல்லது இல்லை இது எப்படி ஏன் எங்கே எப்போது நன்றி வணக்கம் தயவு செய்து வேண்டும் உதவி'.split(' '),
  te: 'మరియు లేదా కాదు ఇది ఎలా ఎందుకు ఎక్కడ ఎప్పుడు ధన్యవాదాలు నమస్కారం దయచేసి కావాలి సహాయం'.split(' '),
  ml: 'ഒപ്പം അല്ലെങ്കിൽ അല്ല ഇത് എങ്ങനെ എന്തുകൊണ്ട് എവിടെ എപ്പോൾ നന്ദി ഹലോ ദയവായി വേണം സഹായം'.split(' '),
  kn: 'ಮತ್ತು ಅಥವಾ ಇಲ್ಲ ಇದು ಹೇಗೆ ಏಕೆ ಎಲ್ಲಿ ಯಾವಾಗ ಧನ್ಯವಾದ ನಮಸ್ಕಾರ ದಯವಿಟ್ಟು ಬೇಕು ಸಹಾಯ'.split(' '),
  th: 'และ หรือ ไม่ นี้ อย่างไร ทำไม ที่ไหน เมื่อไหร่ สำหรับ กับ ขอบคุณ สวัสดี กรุณา ต้องการ ช่วยเหลือ'.split(' '),
  ko: '그리고 또는 아니 이 어떻게 왜 어디 언제 위해 감사 안녕하세요 부탁 원하다 도움'.split(' '),
  ja: 'そして または ない これ どう なぜ どこ いつ ため に ありがとう こんにちは お願い したい 助け'.split(' '),
  zh: '和 或 不 这 怎么 为什么 哪里 什么时候 为了 谢谢 你好 请 我想 可以 帮助'.split(' '),
  sw: 'na au si ni hii vipi kwa nini wapi lini kwa na asante habari tafadhali nataka naweza msaada'.split(' ')
}

const COMPILED = Object.fromEntries(
  Object.entries(WORD_LISTS).map(([lang, words]) => [lang, new Set(words)])
)

function hasScript(text, start, end) {
  return [...text].some(char => {
    const code = char.codePointAt(0)
    return code >= start && code <= end
  })
}

function detectScript(text) {
  if (hasScript(text, 0xAC00, 0xD7AF)) return 'ko'
  if (hasScript(text, 0x3040, 0x30FF)) return 'ja'
  if (hasScript(text, 0x0E00, 0x0E7F)) return 'th'
  if (hasScript(text, 0x0590, 0x05FF)) return 'he'
  if (hasScript(text, 0x0600, 0x06FF)) return 'ar'
  if (hasScript(text, 0x0370, 0x03FF)) return 'el'
  if (hasScript(text, 0x0900, 0x097F)) return 'hi'
  if (hasScript(text, 0x0980, 0x09FF)) return 'bn'
  if (hasScript(text, 0x0A00, 0x0A7F)) return 'pa'
  if (hasScript(text, 0x0B80, 0x0BFF)) return 'ta'
  if (hasScript(text, 0x0C00, 0x0C7F)) return 'te'
  if (hasScript(text, 0x0D00, 0x0D7F)) return 'ml'
  if (hasScript(text, 0x0C80, 0x0CFF)) return 'kn'
  if (hasScript(text, 0x0D80, 0x0DFF)) return 'si'
  if (hasScript(text, 0x0E80, 0x0EFF)) return 'lo'
  if (hasScript(text, 0x1000, 0x109F)) return 'my'
  if (hasScript(text, 0x1780, 0x17FF)) return 'km'
  if (hasScript(text, 0x10A0, 0x10FF)) return 'ka'
  if (hasScript(text, 0x0530, 0x058F)) return 'hy'
  if (hasScript(text, 0x1200, 0x137F)) return 'am'
  if (hasScript(text, 0x0F00, 0x0FFF)) return 'bo'
  if (hasScript(text, 0x4E00, 0x9FFF)) return 'zh'

  return null
}

function normalizeWords(text) {
  return text.toLowerCase().match(/[\p{L}]+/gu) || []
}

function scoreLanguages(words) {
  const scores = Object.fromEntries(Object.keys(COMPILED).map(lang => [lang, 0]))
  for (const word of words) {
    for (const [lang, dictionary] of Object.entries(COMPILED)) {
      if (dictionary.has(word)) scores[lang]++
    }
  }
  return Object.entries(scores).sort((a, b) => b[1] - a[1])
}

export function detectLanguage(text, fallback = 'en') {
  if (!text || typeof text !== 'string') return fallback

  // Characters unique to Slovak among the closely related Latin-script
  // languages are a stronger signal than short-message word frequency.
  if (/[äĺľôŕ]/iu.test(text)) return 'sk'

  const words = normalizeWords(text)
  if (words.length === 0) return fallback

  const ranked = scoreLanguages(words)
  const [topLang, topScore] = ranked[0]
  const secondScore = ranked[1]?.[1] || 0
  const scriptLanguage = detectScript(text)

  // When a non-Latin script identifies a language, use word scoring to
  // distinguish scripts shared by multiple languages, otherwise use the script.
  if (scriptLanguage) {
    if (topScore > 0 && topScore > secondScore) return topLang
    return scriptLanguage
  }

  if (topScore === 0) return fallback
  if (topScore === 1 && words.length <= 3) return fallback
  if (topScore === secondScore && topScore < 3) return fallback

  return topLang
}
