const REACTION_EMOJIS = [
  '👍', '❤️', '🙌', '🎉', '😂', '😮', '😢', '🤔',
  '💡', '💪', '👏', '🙏', '👋', '✅'
]

const DEFAULT_REACTION = '👍'

function reactionProbability() {
  const configured = Number(process.env.REACTION_PROBABILITY)
  if (!Number.isFinite(configured)) return 0.3
  return Math.max(0, Math.min(1, configured))
}

export async function selectMessageReaction(anthropic, message, { signal } = {}) {
  // Most messages intentionally receive no reaction. The probability check
  // happens before the model call, so skipped reactions cost nothing.
  if (Math.random() >= reactionProbability()) return null

  try {
    const response = await anthropic.messages.create({
      model: process.env.REACTION_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 16,
      temperature: 0,
      system: `Choose one emoji reaction to the user's message, as a warm and emotionally intelligent colleague would in a messaging app. Consider the message's meaning, emotion, and intent in any language. Return exactly one emoji from this list and nothing else: ${REACTION_EMOJIS.join(' ')}`,
      messages: [{ role: 'user', content: message }]
    }, { signal })

    const output = response.content
      ?.filter(block => block.type === 'text')
      .map(block => block.text)
      .join(' ')
      .trim() || ''

    return REACTION_EMOJIS.find(emoji => output.includes(emoji)) || DEFAULT_REACTION
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error('Message reaction selection failed:', error)
    }
    return DEFAULT_REACTION
  }
}

export { DEFAULT_REACTION, REACTION_EMOJIS, reactionProbability }
