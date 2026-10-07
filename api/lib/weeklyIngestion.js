import { spawn } from 'node:child_process'
import { supabase } from './supabase.js'
import { acquireGlobalGuard, releaseGuard } from '../middleware/rateLimit.js'
import { clearRetrievalCache } from './retrieval.js'

const JOB_NAME = 'knowledge-ingestion'
const WEEK_SECONDS = 7 * 24 * 60 * 60
const LEASE_SECONDS = 60 * 60
const CHECK_INTERVAL_MS = 60 * 60 * 1000
const INITIAL_CHECK_DELAY_MS = 15 * 1000
const INGESTION_TIMEOUT_MS = 55 * 60 * 1000

async function finishScheduledRun(succeeded, error = null) {
  const { error: finishError } = await supabase.rpc('finish_scheduled_job', {
    p_job_name: JOB_NAME,
    p_succeeded: succeeded,
    p_error: error
  })

  if (finishError) {
    console.error('Failed to record the weekly ingestion result:', finishError)
  }
}

function runIngestionWorker() {
  return new Promise(resolve => {
    const child = spawn(process.env.PYTHON_BIN || 'python3', ['-m', 'ingestion.main'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let finished = false
    let timedOut = false

    const complete = result => {
      if (finished) return
      finished = true
      resolve(result)
    }

    const timeout = setTimeout(() => {
      timedOut = true
      console.error('Weekly ingestion exceeded 55 minutes; terminating the worker')
      child.kill('SIGTERM')
      setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL')
      }, 5_000).unref()
    }, INGESTION_TIMEOUT_MS)
    timeout.unref()

    child.stdout.on('data', chunk => console.log(`Weekly ingestion: ${String(chunk).trimEnd()}`))
    child.stderr.on('data', chunk => console.error(`Weekly ingestion: ${String(chunk).trimEnd()}`))
    child.once('error', error => {
      clearTimeout(timeout)
      complete({ succeeded: false, error: error.message })
    })
    child.once('close', code => {
      clearTimeout(timeout)
      complete({
        succeeded: code === 0 && !timedOut,
        error: timedOut ? 'Ingestion timed out' : code === 0 ? null : `Worker exited with code ${code}`
      })
    })
  })
}

async function checkWeeklyIngestion() {
  try {
    const { data: claimed, error: claimError } = await supabase.rpc('claim_scheduled_job', {
      p_job_name: JOB_NAME,
      p_interval_seconds: WEEK_SECONDS,
      p_lease_seconds: LEASE_SECONDS
    })

    if (claimError) throw claimError
    if (!claimed) return

    const guard = await acquireGlobalGuard(JOB_NAME, LEASE_SECONDS)
    if (!guard?.allowed) {
      await finishScheduledRun(false, 'Another ingestion job is already running')
      return
    }

    console.log('Starting scheduled weekly Drive and Notion ingestion')
    let result
    try {
      result = await runIngestionWorker()
    } finally {
      await releaseGuard(JOB_NAME, 'global')
    }

    await finishScheduledRun(result.succeeded, result.error)
    if (result.succeeded) {
      clearRetrievalCache()
      console.log('Scheduled weekly Drive and Notion ingestion completed')
    } else {
      console.error(`Scheduled weekly ingestion failed: ${result.error}`)
    }
  } catch (error) {
    // A missing migration or temporary database outage must not prevent the API
    // from starting. The hourly check will retry automatically.
    console.error('Weekly ingestion scheduler check failed:', error)
  }
}

export function startWeeklyIngestionScheduler() {
  if (process.env.DISABLE_WEEKLY_INGESTION === 'true') {
    console.log('Weekly knowledge ingestion is disabled')
    return
  }

  const initialCheck = setTimeout(() => void checkWeeklyIngestion(), INITIAL_CHECK_DELAY_MS)
  initialCheck.unref()

  const interval = setInterval(() => void checkWeeklyIngestion(), CHECK_INTERVAL_MS)
  interval.unref()
}
