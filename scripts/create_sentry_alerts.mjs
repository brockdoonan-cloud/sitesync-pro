const API_BASE = 'https://sentry.io/api/0'

const token = process.env.SENTRY_API_TOKEN || process.env.SENTRY_AUTH_TOKEN
const org = process.env.SENTRY_ORG || 'sitesync-pro'
const project = process.env.SENTRY_PROJECT || 'sitesync-pro'
const email = process.env.SENTRY_ALERT_EMAIL || 'brock.doonan@gmail.com'

if (!token) {
  console.error('Missing SENTRY_API_TOKEN or SENTRY_AUTH_TOKEN.')
  process.exit(1)
}

async function sentryRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const text = await response.text()
  const body = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed ${response.status}: ${text}`)
  }

  return body
}

async function findMemberIdByEmail() {
  try {
    const members = await sentryRequest(`/organizations/${org}/members/?query=${encodeURIComponent(email)}`)
    const exact = members.find(member => member.email?.toLowerCase() === email.toLowerCase())
    return exact?.id || members[0]?.id || null
  } catch (error) {
    console.warn(`Could not resolve ${email} to a Sentry member; falling back to default project email action.`)
    return null
  }
}

async function createMetricAlertIfMissing(name, payload) {
  const existing = await sentryRequest(`/organizations/${org}/alert-rules/`)
  const match = existing.find(rule => rule.name === name)
  if (match) return { name, id: match.id, status: 'exists' }

  const created = await sentryRequest(`/organizations/${org}/alert-rules/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return { name, id: created.id, status: 'created' }
}

async function createIssueAlertIfMissing(name, payload) {
  const existing = await sentryRequest(`/projects/${org}/${project}/rules/`)
  const match = existing.find(rule => rule.name === name)
  if (match) return { name, id: match.id, status: 'exists' }

  const created = await sentryRequest(`/projects/${org}/${project}/rules/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return { name, id: created.id, status: 'created' }
}

function emailAction(memberId) {
  if (!memberId) return { id: 'sentry.rules.actions.notify_event.NotifyEventAction' }

  return {
    id: 'sentry.mail.actions.NotifyEmailAction',
    targetType: 'Member',
    targetIdentifier: memberId,
  }
}

const memberId = await findMemberIdByEmail()
const action = emailAction(memberId)

const results = []

results.push(await createMetricAlertIfMissing('SiteSync Pro - High event spike', {
  name: 'SiteSync Pro - High event spike',
  aggregate: 'count()',
  timeWindow: 60,
  comparisonDelta: 60,
  projects: [project],
  query: 'level:error',
  thresholdType: 0,
  environment: 'production',
  dataset: 'events',
  queryType: 0,
  eventTypes: ['error', 'default'],
  triggers: [
    {
      label: 'critical',
      alertThreshold: 900,
      actions: [
        {
          type: 'email',
          targetType: 'specific',
          targetIdentifier: email,
        },
      ],
    },
  ],
}))

results.push(await createIssueAlertIfMissing('SiteSync Pro - New issue', {
  name: 'SiteSync Pro - New issue',
  frequency: 5,
  actionMatch: 'all',
  filterMatch: 'all',
  conditions: [{ id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition' }],
  filters: [{ id: 'sentry.rules.filters.level.LevelFilter', match: 'gte', level: '40' }],
  actions: [action],
  environment: 'production',
}))

results.push(await createIssueAlertIfMissing('SiteSync Pro - Unresolved 24h', {
  name: 'SiteSync Pro - Unresolved 24h',
  frequency: 1440,
  actionMatch: 'all',
  filterMatch: 'all',
  conditions: [
    {
      id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
      value: 1,
      interval: '1h',
    },
  ],
  filters: [
    {
      id: 'sentry.rules.filters.age_comparison.AgeComparisonFilter',
      comparison_type: 'older',
      value: 24,
      time: 'hour',
    },
    { id: 'sentry.rules.filters.level.LevelFilter', match: 'gte', level: '40' },
  ],
  actions: [action],
  environment: 'production',
}))

console.log(JSON.stringify({ org, project, email, memberId, results }, null, 2))
