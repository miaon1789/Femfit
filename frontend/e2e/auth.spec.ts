import { test, expect, login } from './fixtures'

test('valid login, session refresh and logout protect private routes', async ({ page, account }) => {
  await login(page, account)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page).toHaveURL('/auth')
  await page.goto('/records/food')
  await expect(page).toHaveURL('/auth')
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
  await expect(page.getByTestId('daily-calories')).toHaveCount(0)
})

test('incorrect credentials display an error and leave protected routes inaccessible', async ({ page, account }) => {
  await page.goto('/auth')
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill('Incorrect-password-123!')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password')
  await expect(page).toHaveURL('/auth')
  await page.goto('/records/food')
  await expect(page).toHaveURL('/auth')
})
