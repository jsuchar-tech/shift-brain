export async function fetchWithTimeout(url, options = {}, timeoutMs = 20_000) {
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(new Error('Request timed out')), timeoutMs)

  let signal = timeoutController.signal
  if (options.signal) {
    signal = AbortSignal.any([options.signal, timeoutController.signal])
  }

  try {
    return await fetch(url, { ...options, signal })
  } finally {
    clearTimeout(timeout)
  }
}
