import { redirect } from 'next/navigation'

export default async function LoginAliasPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = await searchParams
  const params = new URLSearchParams()

  Object.entries(resolvedSearchParams || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => params.append(key, item))
    } else if (value) {
      params.set(key, value)
    }
  })

  const query = params.toString()
  redirect(`/auth/login${query ? `?${query}` : ''}`)
}
