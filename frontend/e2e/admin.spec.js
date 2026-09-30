import { expect, test } from '@playwright/test';

/** Capture browser errors so an apparently successful workflow cannot hide client failures. */
function captureBrowserErrors(page, errors) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
}

test('candidate submission survives admin authentication, edit, delete, and reload', async ({ page }, testInfo) => {
  const errors = [];
  captureBrowserErrors(page, errors);

  await page.goto('/apply');
  await page.getByLabel('Full Name').fill('Ava Smith');
  await page.getByLabel('Email Address').fill('ava@example.com');
  await page.getByLabel('Mobile Number').fill('1234567890');
  await page.getByLabel('Department of Interest').selectOption('Engineering');
  await page.getByRole('button', { name: 'Submit Application' }).click();
  await expect(page.getByRole('status')).toBeVisible();

  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  await page.getByPlaceholder('Enter username').fill('wrong');
  await page.getByPlaceholder('Enter password').fill('wrong');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid credentials. Please try again.');
  await page.getByPlaceholder('Enter username').fill('admin');
  await page.getByPlaceholder('Enter password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('heading', { name: 'Submissions Dashboard' })).toBeVisible();
  await expect(page.getByText('Ava Smith')).toBeVisible();
  await expect(page.getByText('ava@example.com')).toBeVisible();
  await expect(page.getByText('1234567890')).toBeVisible();
  await expect(page.getByText('Engineering')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search submissions' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Department' })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search submissions' }).fill('ava@example.com');
  await expect(page.getByText('Ava Smith')).toBeVisible();
  await page.getByRole('combobox', { name: 'Department' }).selectOption('Engineering');
  await expect(page.getByText('Ava Smith')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search submissions' }).fill('missing');
  await expect(page.getByText('No submissions match the current filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('Ava Smith')).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('dialog', { name: 'Edit Submission' }).getByLabel('Full Name').fill('Ava Jones');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Ava Jones')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Ava Jones')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin-desktop-persisted-edit.png'), fullPage: true });

  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Are you sure you want to delete this submission?')).toBeVisible();
  await page.getByRole('dialog', { name: 'Delete Submission' }).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('No submissions yet.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('No submissions yet.')).toBeVisible();
  expect(errors).toEqual([]);
});
