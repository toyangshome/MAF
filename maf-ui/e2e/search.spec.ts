import { test, expect } from '@playwright/test';
import { waitForAppReady, waitForSidebar } from './helpers';

test.describe('搜索测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForSidebar(page);
  });

  test('Cmd+K 打开全局搜索', async ({ page }) => {
    // 按 Cmd+K (Mac) 或 Ctrl+K (Windows/Linux)
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }

    // 搜索对话框应该出现
    const searchDialog = page.locator('input[placeholder*="Search"]');
    await expect(searchDialog).toBeVisible({ timeout: 3_000 });
  });

  test('搜索输入框打开后自动聚焦', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
    await expect(searchInput).toBeFocused();
  });

  test('搜索 "Orchestrator" 返回 Agent 结果', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
    await searchInput.fill('Orchestrator');

    // 等待搜索结果出现
    await page.waitForTimeout(500);

    // 应该有 Agent 类型的结果
    const agentsGroup = page.locator('text=Agents');
    await expect(agentsGroup).toBeVisible({ timeout: 3_000 });
  });

  test('搜索 "auth" 返回 Task 结果', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
    await searchInput.fill('auth');

    await page.waitForTimeout(500);

    // 应该有 Tasks 或 Agents 的结果
    const tasksGroup = page.locator('text=Tasks');
    await expect(tasksGroup).toBeVisible({ timeout: 3_000 });
  });

  test('搜索不存在的内容显示无结果', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
    await searchInput.fill('xyznonexistent12345');

    await page.waitForTimeout(500);

    // 应该显示无结果
    const noResults = page.locator('text=No results found');
    await expect(noResults).toBeVisible({ timeout: 3_000 });
  });

  test('点击搜索结果跳转到对应页面', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
    await searchInput.fill('Orchestrator');

    await page.waitForTimeout(500);

    // 点击第一个搜索结果
    const firstResult = page.locator('button').filter({ hasText: 'Orchestrator' }).first();
    if (await firstResult.count() > 0) {
      await firstResult.click();

      // 搜索框应该关闭
      await expect(searchInput).toBeHidden({ timeout: 3_000 });

      // 页面应该跳转到 workflow（Agent 类型结果跳转到 workflow）
      const main = page.locator('[role="main"]');
      await expect(main).toHaveAttribute('aria-label', /工作流|workflow/i, { timeout: 5_000 });
    }
  });

  test('Esc 关闭搜索对话框', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');

    await expect(searchInput).toBeHidden({ timeout: 3_000 });
  });

  test('搜索触发按钮（Header 中）存在', async ({ page }) => {
    const searchBtn = page.locator('button[aria-label="Search (Cmd+K)"]');
    await expect(searchBtn).toBeVisible();
  });

  test('点击搜索触发按钮打开搜索', async ({ page }) => {
    const searchBtn = page.locator('button[aria-label="Search (Cmd+K)"]');
    await searchBtn.click();

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
  });
});
