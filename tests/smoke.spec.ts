import { expect, test, type Page } from '@playwright/test'

const operatorEmail = process.env.E2E_OPERATOR_EMAIL
const operatorPassword = process.env.E2E_OPERATOR_PASSWORD
const customerEmail = process.env.E2E_CUSTOMER_EMAIL
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD
const runWriteTests = process.env.E2E_WRITE_TESTS === 'true'

async function login(page: Page, email: string, password: string) {
  await page.goto('/auth/login')
  await page.getByRole('textbox').first().fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForLoadState('networkidle')
}

test('public landing page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toContainText(/SiteSync|jobsite|equipment/i)
})

test('public quote form loads', async ({ page }) => {
  await page.goto('/quotes')
  await expect(page.locator('form, body')).toContainText(/quote|request/i)
})

test('operator login redirects to operator dashboard', async ({ page }) => {
  test.skip(!operatorEmail || !operatorPassword, 'Set E2E_OPERATOR_EMAIL and E2E_OPERATOR_PASSWORD to run authenticated smoke tests.')
  await login(page, operatorEmail!, operatorPassword!)
  await expect(page).toHaveURL(/dashboard\/operator|dashboard/)
})

test('customer login reaches customer dashboard', async ({ page }) => {
  test.skip(!customerEmail || !customerPassword, 'Set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD to run customer smoke tests.')
  await login(page, customerEmail!, customerPassword!)
  await expect(page).toHaveURL(/dashboard\/customer|dashboard/)
})

test('operator clients page renders rows', async ({ page }) => {
  test.skip(!operatorEmail || !operatorPassword, 'Authenticated operator credentials required.')
  await login(page, operatorEmail!, operatorPassword!)
  await page.goto('/dashboard/operator/clients')
  await expect(page.locator('body')).toContainText(/client|customer/i)
  await expect(page.locator('body')).not.toContainText(/try again/i)
})

test('operator jobs page renders', async ({ page }) => {
  test.skip(!operatorEmail || !operatorPassword, 'Authenticated operator credentials required.')
  await login(page, operatorEmail!, operatorPassword!)
  await page.goto('/dashboard/operator/jobs')
  await expect(page.locator('body')).toContainText(/job|profile|project/i)
})

test('profile import exposes OCR and manual paths', async ({ page }) => {
  test.skip(!operatorEmail || !operatorPassword, 'Authenticated operator credentials required.')
  await login(page, operatorEmail!, operatorPassword!)
  await page.goto('/dashboard/operator/billing/profile-import')
  await expect(page.locator('body')).toContainText(/drop|upload|profile/i)
  await expect(page.getByRole('button', { name: /enter manually/i })).toBeVisible()
})

test('manual job import can be opened', async ({ page }) => {
  test.skip(!operatorEmail || !operatorPassword, 'Authenticated operator credentials required.')
  await login(page, operatorEmail!, operatorPassword!)
  await page.goto('/dashboard/operator/billing/profile-import')
  await page.getByRole('button', { name: /enter manually/i }).click()
  await expect(page.locator('body')).toContainText(/legal company name|jobsite name|one-bin/i)
})

test('dispatcher route page renders', async ({ page }) => {
  test.skip(!operatorEmail || !operatorPassword, 'Authenticated operator credentials required.')
  await login(page, operatorEmail!, operatorPassword!)
  await page.goto('/dashboard/operator/routes')
  await expect(page.locator('body')).toContainText(/route|driver|dispatch/i)
})

test('driver mobile route page renders', async ({ page }) => {
  test.skip(!operatorEmail || !operatorPassword, 'Driver/operator credentials required.')
  await login(page, operatorEmail!, operatorPassword!)
  await page.goto('/dashboard/driver')
  await expect(page.locator('body')).toContainText(/route|stop|driver/i)
})

test('write flow placeholder stays opt-in', async ({ page }) => {
  test.skip(!runWriteTests, 'Set E2E_WRITE_TESTS=true after staging seed data is ready.')
  test.skip(!operatorEmail || !operatorPassword, 'Authenticated operator credentials required.')
  await login(page, operatorEmail!, operatorPassword!)
  await page.goto('/dashboard/operator/billing/profile-import')
  await page.getByRole('button', { name: /enter manually/i }).click()
  await expect(page.locator('body')).toContainText(/save|submit|billing/i)
})
