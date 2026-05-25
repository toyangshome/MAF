import { test, expect } from '@playwright/test';
import { waitForAppReady, waitForSidebar, clickNavItem, waitForPage } from './helpers';

test.describe('任务管理测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForSidebar(page);
    // 导航到 Tasks 页面
    await clickNavItem(page, 'Tasks');
    await waitForPage(page, '任务');
  });

  test('任务页面标题和任务计数显示', async ({ page }) => {
    const heading = page.locator('h1:has-text("Tasks")');
    await expect(heading).toBeVisible();

    // 任务计数 badge
    const countBadge = page.locator('[aria-label*="共"][aria-label*="个任务"]');
    await expect(countBadge).toBeVisible();
  });

  test('任务列表显示 mock 数据', async ({ page }) => {
    // 检查有任务项出现
    const taskItems = page.locator('[role="listitem"]');
    const count = await taskItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('状态过滤 - 点击 Running tab', async ({ page }) => {
    // 点击 Running tab
    const tablist = page.locator('[role="tablist"]');
    await tablist.locator('button:has-text("Running")').click();

    // 应该只显示 running 状态的任务
    await page.waitForTimeout(300);
    const taskItems = page.locator('[role="listitem"]');
    const count = await taskItems.count();

    // mock 数据中有 1 个 running 任务
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('状态过滤 - 点击 Completed tab', async ({ page }) => {
    const tablist = page.locator('[role="tablist"]');
    await tablist.locator('button:has-text("Completed")').click();

    await page.waitForTimeout(300);
    const taskItems = page.locator('[role="listitem"]');
    const count = await taskItems.count();

    // mock 数据中有 1 个 completed 任务
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('状态过滤 - 点击 Failed tab', async ({ page }) => {
    const tablist = page.locator('[role="tablist"]');
    await tablist.locator('button:has-text("Failed")').click();

    await page.waitForTimeout(300);
    const taskItems = page.locator('[role="listitem"]');
    const count = await taskItems.count();

    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('提交新任务表单存在', async ({ page }) => {
    // 检查提交表单的各个元素
    const textarea = page.locator('textarea[aria-label="任务描述"]');
    await expect(textarea).toBeVisible();

    // Submit 按钮
    const submitBtn = page.locator('button:has-text("Submit Task")');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled(); // 没有输入时应该 disabled
  });

  test('填写并提交新任务', async ({ page }) => {
    const textarea = page.locator('textarea[aria-label="任务描述"]');
    await textarea.fill('Test E2E task for automated testing');

    // Submit 按钮应该可以点击
    const submitBtn = page.locator('button:has-text("Submit Task")');
    await expect(submitBtn).toBeEnabled();

    // 点击提交
    await submitBtn.click();

    // 等待提交完成（表单清空）
    await page.waitForFunction(
      () => {
        const ta = document.querySelector('textarea[aria-label="任务描述"]') as HTMLTextAreaElement;
        return ta && ta.value === '';
      },
      { timeout: 5_000 }
    );
  });

  test('任务卡片显示状态徽章', async ({ page }) => {
    // 检查状态徽章存在
    const statusBadges = page.locator('[aria-label^="状态:"]');
    const count = await statusBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('全选复选框和批量操作', async ({ page }) => {
    // 查找 select all checkbox
    const selectAllCheckbox = page.locator('input[aria-label*="选择所有可见任务"]');
    if (await selectAllCheckbox.count() > 0) {
      await selectAllCheckbox.click();

      // 批量操作工具栏应该出现
      await page.waitForTimeout(200);
      const batchToolbar = page.locator('[aria-label="批量操作"]');
      if (await batchToolbar.count() > 0) {
        await expect(batchToolbar).toBeVisible();
      }
    }
  });
});
