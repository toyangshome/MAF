import { test, expect } from '@playwright/test';
import { waitForAppReady, waitForSidebar, clickNavItem, waitForPage } from './helpers';

test.describe('导航测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForSidebar(page);
  });

  test('点击侧边栏切换到 Logs 页面', async ({ page }) => {
    await clickNavItem(page, 'Logs');
    await waitForPage(page, '日志');

    const main = page.locator('[role="main"]');
    await expect(main).toHaveAttribute('aria-label', /日志|logs/i);
  });

  test('点击侧边栏切换到 Tasks 页面', async ({ page }) => {
    await clickNavItem(page, 'Tasks');
    await waitForPage(page, '任务');

    const main = page.locator('[role="main"]');
    await expect(main).toHaveAttribute('aria-label', /任务|tasks/i);
  });

  test('点击侧边栏切换到 Config 页面', async ({ page }) => {
    await clickNavItem(page, 'Config');
    await waitForPage(page, '配置');

    const main = page.locator('[role="main"]');
    await expect(main).toHaveAttribute('aria-label', /配置|config/i);
  });

  test('点击侧边栏切换到 Monitor 页面', async ({ page }) => {
    await clickNavItem(page, 'Monitor');
    await waitForPage(page, '监控');

    const main = page.locator('[role="main"]');
    await expect(main).toHaveAttribute('aria-label', /监控|monitor/i);
  });

  test('点击侧边栏切换到 Agents 页面', async ({ page }) => {
    await clickNavItem(page, 'Agents');
    await waitForPage(page, 'Agent');

    const main = page.locator('[role="main"]');
    await expect(main).toHaveAttribute('aria-label', /Agent/i);
  });

  test('点击侧边栏 Workflow 回到主页', async ({ page }) => {
    // 先切换到别的页面
    await clickNavItem(page, 'Tasks');
    await waitForPage(page, '任务');

    // 再切回 Workflow
    await clickNavItem(page, 'Workflow');
    await waitForPage(page, '工作流');

    const main = page.locator('[role="main"]');
    await expect(main).toHaveAttribute('aria-label', /工作流|workflow/i);
  });

  test('快捷键 1 切换到 Workflow 页面', async ({ page }) => {
    // 先切换到别的页面
    await clickNavItem(page, 'Tasks');
    await waitForPage(page, '任务');

    // 按快捷键 1
    await page.keyboard.press('1');
    await waitForPage(page, '工作流');

    const main = page.locator('[role="main"]');
    await expect(main).toHaveAttribute('aria-label', /工作流|workflow/i);
  });

  test('快捷键 2 切换到 Logs 页面', async ({ page }) => {
    await page.keyboard.press('2');
    await waitForPage(page, '日志');

    const main = page.locator('[role="main"]');
    await expect(main).toHaveAttribute('aria-label', /日志|logs/i);
  });

  test('快捷键 3 切换到 Tasks 页面', async ({ page }) => {
    await page.keyboard.press('3');
    await waitForPage(page, '任务');

    const main = page.locator('[role="main"]');
    await expect(main).toHaveAttribute('aria-label', /任务|tasks/i);
  });

  test('快捷键 4 切换到 Config 页面', async ({ page }) => {
    await page.keyboard.press('4');
    await waitForPage(page, '配置');

    const main = page.locator('[role="main"]');
    await expect(main).toHaveAttribute('aria-label', /配置|config/i);
  });

  test('快捷键 5 切换到 Monitor 页面', async ({ page }) => {
    await page.keyboard.press('5');
    await waitForPage(page, '监控');

    const main = page.locator('[role="main"]');
    await expect(main).toHaveAttribute('aria-label', /监控|monitor/i);
  });

  test('当前页面侧边栏高亮 (aria-current)', async ({ page }) => {
    // 默认应该是 Workflow
    const workflowBtn = page.locator('nav[aria-label="主导航"] button[aria-label="Workflow"]');
    await expect(workflowBtn).toHaveAttribute('aria-current', 'page');

    // 切换到 Tasks
    await clickNavItem(page, 'Tasks');
    await waitForPage(page, '任务');

    const tasksBtn = page.locator('nav[aria-label="主导航"] button[aria-label="Tasks"]');
    await expect(tasksBtn).toHaveAttribute('aria-current', 'page');

    // Workflow 不再高亮
    await expect(workflowBtn).not.toHaveAttribute('aria-current', 'page');
  });
});
