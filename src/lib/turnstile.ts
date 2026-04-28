// Cloudflare Turnstile bot protection
// Free tier: unlimited verifications

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA' // test key (always passes)
export const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA' // test secret

export async function verifyTurnstile(token: string): Promise<boolean> {
  if (!token) return false
  
  // In development or if using test keys, always pass
  if (TURNSTILE_SECRET_KEY.includes('0000000000000000000000000000000AA')) return true
  
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${TURNSTILE_SECRET_KEY}&response=${token}`,
    })
    const data = await res.json()
    return data.success === true
  } catch {
    return false
  }
}
