import { type Page } from '@playwright/test';

/**
 * 等待应用完全加载（loading spinner 消失，主内容出现）
 */
export async function waitForAppReady(page: Page) {
  // Wait for loading spinner to disappear
  await page.waitForFunction(() => {
    const main = document.querySelector('[role="main"]');
    const loading = document.querySelector('[role="status"]');
    return main !== null && loading === null;
  }, { timeout: 15_000 });
}

/**
 * Mock Tauri invoke - 注入 mock 使应用使用 mock 数据而非真实 Tauri 后端
 * 应用在非 Tauri 环境会自动降级使用 mock 数据，所以只需确保
 * __TAURI_INTERNALS__ 不存在即可
 */
export async function mockTauriEnvironment(page: Page) {
  await page.addInitScript(() => {
    // Remove Tauri internals flag to force mock fallback
    delete (window as any).__TAURI_INTERNALS__;
  });
}

/**
 * 等待侧边栏渲染完成
 */
export async function waitForSidebar(page: Page) {
  await page.waitForSelector('nav[aria-label="主导航"]', { timeout: 10_000 });
}

/**
 * 点击侧边栏中的导航项
 */
export async function clickNavItem(page: Page, label: string) {
  const nav = page.locator('nav[aria-label="主导航"]');
  await nav.locator(`button:has-text("${label}")`).click();
}

/**
 * 获取当前页面标识（通过检查侧边栏高亮项）
 */
export async function getCurrentPageLabel(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const main = document.querySelector('[role="main"]');
    return main?.getAttribute('aria-label') ?? null;
  });
}

/**
 * 等待某个页面内容加载
 */
export async function waitForPage(page: Page, pageName: string) {
  await page.waitForFunction(
    (name) => {
      const main = document.querySelector('[role="main"]');
      const label = main?.getAttribute('aria-label') ?? '';
      return label.includes(name);
    },
    pageName,
    { timeout: 10_000 }
  );
}
