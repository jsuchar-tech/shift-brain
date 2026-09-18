import yauzl from 'yauzl'
import { fileTypeFromBuffer } from 'file-type'
import { fetchWithTimeout } from './http.js'
import { supabase } from './supabase.js'

const MAX_DOCX_ENTRIES = 2_000
const MAX_DOCX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024
const ATTACHMENT_RETENTION_DAYS = Number.parseInt(process.env.ATTACHMENT_RETENTION_DAYS || '30', 10)

const EXPECTED_MIME = new Map([
  ['image/jpeg', new Set(['image/jpeg'])],
  ['image/png', new Set(['image/png'])],
  ['image/gif', new Set(['image/gif'])],
  ['image/webp', new Set(['image/webp'])],
  ['application/pdf', new Set(['application/pdf'])],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ])]
])

const MAX_BYTES_BY_MIME = new Map([
  ['text/plain', 1024 * 1024],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 5 * 1024 * 1024],
  ['application/pdf', 10 * 1024 * 1024],
  ['image/jpeg', 8 * 1024 * 1024],
  ['image/png', 8 * 1024 * 1024],
  ['image/gif', 8 * 1024 * 1024],
  ['image/webp', 8 * 1024 * 1024]
])

function validateDocxArchive(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (openError, zip) => {
      if (openError) return reject(new Error('Invalid Word document'))

      let entries = 0
      let uncompressedBytes = 0
      let hasContentTypes = false
      let hasDocument = false

      const fail = message => {
        zip.close()
        reject(new Error(message))
      }

      zip.on('entry', entry => {
        entries += 1
        uncompressedBytes += entry.uncompressedSize
        if (entry.fileName === '[Content_Types].xml') hasContentTypes = true
        if (entry.fileName === 'word/document.xml') hasDocument = true

        if ((entry.generalPurposeBitFlag & 0x1) !== 0) return fail('Encrypted Word documents are not supported')
        if (entries > MAX_DOCX_ENTRIES || uncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
          return fail('Word document expands beyond the safe processing limit')
        }
        zip.readEntry()
      })

      zip.on('end', () => {
        if (!hasContentTypes || !hasDocument) return reject(new Error('Invalid Word document structure'))
        resolve()
      })
      zip.on('error', () => reject(new Error('Invalid Word document')))
      zip.readEntry()
    })
  })
}

export async function validateUpload(file) {
  const maxBytes = MAX_BYTES_BY_MIME.get(file.mimetype)
  if (!maxBytes || file.size > maxBytes) {
    throw new Error('File exceeds the allowed size for this type')
  }

  if (file.mimetype === 'text/plain') {
    if (file.buffer.includes(0)) throw new Error('Invalid plain-text file')
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(file.buffer)
    } catch {
      throw new Error('Invalid plain-text file')
    }
    return
  }

  const detected = await fileTypeFromBuffer(file.buffer)
  if (!detected || !EXPECTED_MIME.get(file.mimetype)?.has(detected.mime)) {
    throw new Error('File contents do not match the declared file type')
  }

  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    await validateDocxArchive(file.buffer)
  }
}

export async function scanUpload(file) {
  const scannerUrl = process.env.UPLOAD_MALWARE_SCAN_URL
  if (!scannerUrl) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_UNSCANNED_UPLOADS !== 'true') {
      const error = new Error('File scanning is temporarily unavailable')
      error.code = 'SCANNER_UNAVAILABLE'
      throw error
    }
    return
  }

  const form = new FormData()
  form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname)
  const headers = process.env.UPLOAD_MALWARE_SCAN_TOKEN
    ? { Authorization: `Bearer ${process.env.UPLOAD_MALWARE_SCAN_TOKEN}` }
    : undefined
  const response = await fetchWithTimeout(scannerUrl, { method: 'POST', headers, body: form }, 30_000)
  if (!response.ok) {
    const error = new Error('File scanning is temporarily unavailable')
    error.code = 'SCANNER_UNAVAILABLE'
    throw error
  }

  const result = await response.json()
  if (result.clean !== true) {
    const error = new Error('The uploaded file did not pass the security scan')
    error.code = 'MALWARE_DETECTED'
    throw error
  }
}

export async function registerPendingUpload({ userId, storagePath, file }) {
  const expiresAt = new Date(Date.now() + ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase.from('attachment_uploads').insert({
    storage_path: storagePath,
    user_id: String(userId),
    file_name: file.originalname,
    file_type: file.mimetype,
    file_size: file.size,
    status: 'pending',
    expires_at: expiresAt
  })
  if (error) throw error
  return expiresAt
}

export async function resolvePendingUpload(storagePath, userId) {
  const { data, error } = await supabase
    .from('attachment_uploads')
    .select('*')
    .eq('storage_path', storagePath)
    .eq('user_id', String(userId))
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) throw error
  return data
}

export async function markUploadAttached(storagePath) {
  const { error } = await supabase
    .from('attachment_uploads')
    .update({ status: 'attached' })
    .eq('storage_path', storagePath)
  if (error) throw error
}

export async function cleanupExpiredUploads() {
  const { data, error } = await supabase
    .from('attachment_uploads')
    .select('storage_path')
    .lt('expires_at', new Date().toISOString())
    .limit(25)

  if (error || !data?.length) return
  const paths = data.map(item => item.storage_path)
  const { error: storageError } = await supabase.storage.from('attachments').remove(paths)
  if (storageError) return console.error('Expired attachment cleanup failed:', storageError)
  await supabase.from('message_attachments').delete().in('storage_path', paths)
  await supabase.from('attachment_uploads').delete().in('storage_path', paths)
}
