import { test, expect } from '@playwright/test';
import { waitForAppReady, waitForSidebar, waitForPage } from './helpers';

test.describe('快捷键测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForSidebar(page);
  });

  test('Cmd+B 切换侧边栏', async ({ page }) => {
    const sidebar = page.locator('nav[aria-label="主导航"]');
    await expect(sidebar).toBeVisible();

    // 记录切换前的宽度
    const widthBefore = await sidebar.evaluate((el) => window.getComputedStyle(el).width);

    // 按 Cmd+B (Mac) 或 Ctrl+B (Windows/Linux)
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+b');
    } else {
      await page.keyboard.press('Control+b');
    }

    // 等待侧边栏动画完成
    await page.waitForTimeout(300);

    const widthAfter = await sidebar.evaluate((el) => window.getComputedStyle(el).width);

    // 宽度应该变化（收窄或展开）
    expect(widthBefore).not.toEqual(widthAfter);

    // 再按一次切回
    if (isMac) {
      await page.keyboard.press('Meta+b');
    } else {
      await page.keyboard.press('Control+b');
    }

    await page.waitForTimeout(300);

    const widthFinal = await sidebar.evaluate((el) => window.getComputedStyle(el).width);
    expect(widthFinal).toEqual(widthBefore);
  });

  test('Cmd+Shift+P 打开指令面板', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+Shift+p');
    } else {
      await page.keyboard.press('Control+Shift+p');
    }

    // 指令面板应该出现
    const commandInput = page.locator('input[placeholder="Type a command..."]');
    await expect(commandInput).toBeVisible({ timeout: 3_000 });
  });

  test('指令面板输入框自动聚焦', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+Shift+p');
    } else {
      await page.keyboard.press('Control+Shift+p');
    }

    const commandInput = page.locator('input[placeholder="Type a command..."]');
    await expect(commandInput).toBeVisible({ timeout: 3_000 });
    await expect(commandInput).toBeFocused();
  });

  test('指令面板搜索命令并执行', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+Shift+p');
    } else {
      await page.keyboard.press('Control+Shift+p');
    }

    const commandInput = page.locator('input[placeholder="Type a command..."]');
    await expect(commandInput).toBeVisible({ timeout: 3_000 });

    // 搜索 "Logs"
    await commandInput.fill('Logs');
    await page.waitForTimeout(300);

    // 应该有导航到 Logs 的命令
    const logsCommand = page.locator('text=/Go to Logs|Navigate to Logs/i');
    if (await logsCommand.count() > 0) {
      await logsCommand.first().click();

      // 指令面板应该关闭，页面应该跳转到 logs
      await waitForPage(page, '日志');
    }
  });

  test('Esc 关闭指令面板', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+Shift+p');
    } else {
      await page.keyboard.press('Control+Shift+p');
    }

    const commandInput = page.locator('input[placeholder="Type a command..."]');
    await expect(commandInput).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await expect(commandInput).toBeHidden({ timeout: 3_000 });
  });

  test('? 键打开帮助面板', async ({ page }) => {
    // 确保焦点不在输入框上
    await page.locator('body').click();

    // 按 ? (Shift+/)
    await page.keyboard.press('?');

    // 帮助面板应该出现
    const helpTitle = page.locator('text=Keyboard Shortcuts');
    await expect(helpTitle).toBeVisible({ timeout: 3_000 });
  });

  test('帮助面板显示快捷键列表', async ({ page }) => {
    await page.locator('body').click();
    await page.keyboard.press('?');

    const helpTitle = page.locator('text=Keyboard Shortcuts');
    await expect(helpTitle).toBeVisible({ timeout: 3_000 });

    // 检查有快捷键列表显示
    const shortcuts = page.locator('kbd');
    const count = await shortcuts.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Esc 关闭帮助面板', async ({ page }) => {
    await page.locator('body').click();
    await page.keyboard.press('?');

    const helpTitle = page.locator('text=Keyboard Shortcuts');
    await expect(helpTitle).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await expect(helpTitle).toBeHidden({ timeout: 3_000 });
  });

  test('帮助面板中显示"全局"和"页面切换"分组', async ({ page }) => {
    await page.locator('body').click();
    await page.keyboard.press('?');

    // 检查分组标题
    const globalGroup = page.locator('text=全局');
    await expect(globalGroup).toBeVisible({ timeout: 3_000 });

    const pageSwitchGroup = page.locator('text=页面切换');
    await expect(pageSwitchGroup).toBeVisible();
  });
});
