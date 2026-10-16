const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

export function tokenLimitsAreDisabled(env = process.env) {
  return TRUE_VALUES.has(String(env.DISABLE_TOKEN_LIMITS || '').trim().toLowerCase())
}
