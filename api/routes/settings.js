import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const DEFAULT_SETTINGS = {
  brain_icon_url: 'https://www.figma.com/api/mcp/asset/03794579-c631-4353-bbb8-fcce3e3805e9.png',
  plus_base_icon_url: 'https://www.figma.com/api/mcp/asset/cd672794-278f-48fa-8271-52df6c45e0be.svg',
  plus_glyph_icon_url: 'https://www.figma.com/api/mcp/asset/e6a28874-40dc-460c-8577-b110cd8a85c4.svg',
  send_base_icon_url: 'https://www.figma.com/api/mcp/asset/df6caf01-4c0b-4404-b3b9-40ab16eaff91.svg',
  send_glyph_icon_url: 'https://www.figma.com/api/mcp/asset/87d5cb37-4b71-4820-ad56-3e57816650b5.svg',
  sidebar_open_icon_url: '',
  sidebar_close_icon_url: '',
  search_icon_url: '',
  upload_file_icon_url: '',
  send_message_icon_url: '',
  color_cream: '#fdfbef',
  color_ink: '#0b0b2d',
  color_pink: '#ff008f',
  color_purple: '#302798',
  color_muted: '#b7b7b7',
  color_yellow: '#ffd000',
  color_white: '#ffffff',
  color_line: '#deddd5',
  color_soft_pink: '#ffc2df',
  color_success: '#2d7a3a',
  color_danger: '#c53030',
  login_heading: 'Hello there!',
  login_intro: 'I’m SHIFT Brain (BETA), a Fun (AI)dult that’s been trained on all the resources, tools and knowledge gathered over the last 6 years.',
  login_emphasis: 'Ask me anything related to SHIFT!',
  login_name_placeholder: 'Name',
  login_password_placeholder: 'Password',
  login_forgot_password: 'Forgot password?',
  login_create_account: 'Create an account',
  login_button: 'LOG IN',
  signup_pending_heading: 'Your account is awaiting approval',
  signup_pending_message: 'A curator needs to approve your signup before you can access SHIFT Brain. You can leave this page and return later.',
  dashboard_title: 'Curator Dashboard',
  dashboard_back_to_chat: '← Back to chat',
  dashboard_participants: 'Participants',
  dashboard_conversations: 'Conversations',
  dashboard_knowledge: 'Knowledge base',
  dashboard_usage: 'Usage stats',
  dashboard_settings: 'Settings',
  chat_welcome: 'Let’s start building your movement today!'
}

const URL_FIELDS = ['brain_icon_url', 'plus_base_icon_url', 'plus_glyph_icon_url', 'send_base_icon_url', 'send_glyph_icon_url', 'sidebar_open_icon_url', 'sidebar_close_icon_url', 'search_icon_url', 'upload_file_icon_url', 'send_message_icon_url']
const COLOR_FIELDS = ['color_cream', 'color_ink', 'color_pink', 'color_purple', 'color_muted', 'color_yellow', 'color_white', 'color_line', 'color_soft_pink', 'color_success', 'color_danger']
const TEXT_FIELDS = Object.keys(DEFAULT_SETTINGS).filter(key => !URL_FIELDS.includes(key) && !COLOR_FIELDS.includes(key))

function cleanSettings(input = {}) {
  const next = { ...DEFAULT_SETTINGS }

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (input[key] === undefined || input[key] === null) continue
    const value = String(input[key]).trim()
    if (value.length > 2000) continue
    next[key] = value
  }

  for (const key of URL_FIELDS) {
    const value = next[key].trim()
    if (!value) {
      next[key] = ''
      continue
    }
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol)) next[key] = DEFAULT_SETTINGS[key]
    } catch {
      next[key] = DEFAULT_SETTINGS[key]
    }
  }

  for (const key of COLOR_FIELDS) {
    if (!/^#[0-9a-f]{6}$/i.test(next[key])) next[key] = DEFAULT_SETTINGS[key]
  }

  for (const key of TEXT_FIELDS) {
    if (!next[key]) next[key] = DEFAULT_SETTINGS[key]
  }

  return next
}

async function readSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'branding')
    .maybeSingle()

  if (error) throw error
  return cleanSettings(data?.value || {})
}

export const publicSettingsRouter = Router()
publicSettingsRouter.get('/', async (req, res) => {
  try {
    const settings = await readSettings()
    res.set('Cache-Control', 'no-store')
    res.json({ settings })
  } catch (err) {
    // Keep the public login usable even before the settings table is created.
    console.error('Public settings error:', err)
    res.set('Cache-Control', 'no-store')
    res.json({ settings: DEFAULT_SETTINGS })
  }
})

export const adminSettingsRouter = Router()
adminSettingsRouter.use(requireAuth, requireAdmin)

adminSettingsRouter.get('/', async (req, res) => {
  try {
    res.json({ settings: await readSettings() })
  } catch (err) {
    console.error('Admin settings read error:', err)
    res.status(500).json({ error: 'Failed to load settings' })
  }
})

adminSettingsRouter.patch('/', async (req, res) => {
  try {
    const settings = cleanSettings(req.body || {})
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({ key: 'branding', value: settings, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select('value')
      .single()

    if (error) throw error
    res.json({ settings: cleanSettings(data?.value || settings) })
  } catch (err) {
    console.error('Admin settings save error:', err)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

export { DEFAULT_SETTINGS }
