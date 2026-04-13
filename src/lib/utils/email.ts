const ALLOWED_EMAIL_DOMAIN = 'skillrev.dev'

export function isAllowedEmailDomain(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return normalized.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)
}

export function getAllowedEmailDomainLabel() {
  return ALLOWED_EMAIL_DOMAIN
}