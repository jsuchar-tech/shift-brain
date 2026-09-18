const VALID_ROLES = new Set(['admin', 'participant'])

export function verifiedPrimaryEmail(user) {
  const emails = user?.emailAddresses || []
  const verified = emails.filter(email => email?.verification?.status === 'verified')
  return verified.find(email => email.id === user?.primaryEmailAddressId)?.emailAddress
    || verified[0]?.emailAddress
    || ''
}

export function clerkProfile(user, fallback = {}) {
  const metadata = user?.publicMetadata || {}
  const signupMetadata = user?.unsafeMetadata || {}
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
  const parsedYear = Number.parseInt(metadata.shifter_year ?? fallback.shifter_year, 10)
  const role = VALID_ROLES.has(metadata.role) ? metadata.role : undefined

  return {
    full_name: fullName || user?.username || fallback.full_name || 'SHIFT User',
    // Authentication identity must only come from Clerk's verified data.
    // Request-body fallback values are intentionally never used for email.
    work_email: verifiedPrimaryEmail(user),
    country_office: metadata.country_office || signupMetadata.country_office || fallback.country_office || 'Unknown',
    shifter_year: Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : 1,
    ...(role ? { role } : {})
  }
}
