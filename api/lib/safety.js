// Categories that trigger a redirect response
const SAFETY_CATEGORIES = {
  safeguarding: {
    keywords: [
      'abuse', 'safeguarding', 'child protection', 'harassment',
      'assault', 'exploitation', 'grooming', 'violence against'
    ],
    redirect: 'This topic relates to safeguarding. Please contact your SHIFT safeguarding focal point directly at {SAFETY_EMAIL} for guidance on this matter.'
  },
  legal: {
    keywords: [
      'legal advice', 'lawsuit', 'litigation', 'compliance law',
      'country law', 'local regulation', 'legal requirement',
      'am i liable', 'is it legal'
    ],
    redirect: 'For country-specific legal questions, please reach out directly to {SAFETY_EMAIL} who can connect you with appropriate legal counsel.'
  },
  donor_confidentiality: {
    keywords: [
      'donor name', 'funder identity', 'who funds', 'funding source',
      'donor information', 'grant confidential', 'donor list'
    ],
    redirect: 'Donor confidentiality is important to SHIFT. For questions about funding sources, please contact {SAFETY_EMAIL} directly.'
  }
}

export function checkSafetyTriggers(message) {
  const lower = message.toLowerCase()

  for (const [category, config] of Object.entries(SAFETY_CATEGORIES)) {
    const triggered = config.keywords.some(keyword =>
      lower.includes(keyword.toLowerCase())
    )

    if (triggered) {
      return {
        triggered: true,
        category,
        message: config.redirect.replace(
          '{SAFETY_EMAIL}',
          process.env.SAFETY_EMAIL || 'your SHIFT team contact'
        )
      }
    }
  }

  return { triggered: false }
}