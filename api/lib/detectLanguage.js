// Minimal heuristic language detector for the 4 languages SHIFT Brain
// supports. Scores the message against a short list of very common,
// language-distinguishing words and picks the best match; defaults to
// English if nothing distinctive is found (including for short/ambiguous
// messages, where guessing wrong is worse than defaulting).
const WORD_LISTS = {
  es: [
    'qué', 'que', 'como', 'cómo', 'cuántos', 'cuántas', 'cuál', 'cuáles',
    'dónde', 'donde', 'está', 'están', 'años', 'para', 'porque', 'gracias',
    'hola', 'necesito', 'quiero', 'puedo', 'ayuda', 'los', 'las', 'una', 'del'
  ],
  fr: [
    'quoi', 'comment', 'combien', 'quel', 'quelle', 'où', 'est', 'sont',
    'pour', 'parce', 'merci', 'bonjour', 'besoin', 'je', 'vous', 'pouvez',
    'aide', 'les', 'des', 'une', 'être'
  ],
  pt: [
    'que', 'como', 'quantos', 'quantas', 'qual', 'quais', 'onde', 'está',
    'estão', 'anos', 'para', 'porque', 'obrigado', 'obrigada', 'olá',
    'preciso', 'quero', 'posso', 'ajuda', 'não', 'são'
  ]
}

export function detectLanguage(text, fallback = 'en') {
  if (!text || typeof text !== 'string') return fallback

  const words = text.toLowerCase().match(/[a-zà-ÿ]+/gi) || []
  if (words.length === 0) return fallback

  const scores = { es: 0, fr: 0, pt: 0 }
  for (const word of words) {
    for (const lang of Object.keys(WORD_LISTS)) {
      if (WORD_LISTS[lang].includes(word)) scores[lang]++
    }
  }

  const [topLang, topScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return topScore > 0 ? topLang : fallback
}