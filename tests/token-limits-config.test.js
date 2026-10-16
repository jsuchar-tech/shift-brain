import test from 'node:test'
import assert from 'node:assert/strict'

import { tokenLimitsAreDisabled } from '../api/lib/tokenLimitsConfig.js'

test('token-limit bypass accepts common explicit true values', () => {
  for (const value of ['true', 'TRUE', '1', 'yes', 'ON', ' true ']) {
    assert.equal(tokenLimitsAreDisabled({ DISABLE_TOKEN_LIMITS: value }), true)
  }
})

test('token limits remain enabled by default and for false values', () => {
  for (const value of [undefined, '', 'false', '0', 'off', 'random']) {
    assert.equal(tokenLimitsAreDisabled({ DISABLE_TOKEN_LIMITS: value }), false)
  }
})
