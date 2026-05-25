import { test, expect } from '@playwright/test';
import { waitForAppReady, waitForSidebar, clickNavItem, waitForPage } from './helpers';

test.describe('配置管理测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForSidebar(page);
    // 导航到 Config 页面
    await clickNavItem(page, 'Config');
    await waitForPage(page, '配置');
  });

  test('配置页面加载并显示标题', async ({ page }) => {
    const heading = page.locator('h1:has-text("Config")');
    await expect(heading).toBeVisible();
  });

  test('配置页面显示 Agent 列表', async ({ page }) => {
    // 检查有 agent 配置项
    const agentTabs = page.locator('button').filter({ hasText: /Orchestrator|Coder|Reviewer|Tester|Decomposer/ });
    const count = await agentTabs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Save 按钮存在', async ({ page }) => {
    const saveBtn = page.locator('button:has-text("Save")');
    await expect(saveBtn).toBeVisible();
  });

  test('Export YAML 按钮存在', async ({ page }) => {
    const exportBtn = page.locator('button[title="Export YAML"]');
    await expect(exportBtn).toBeVisible();
  });

  test('Import 按钮存在', async ({ page }) => {
    const importBtn = page.locator('button:has-text("Import")');
    await expect(importBtn).toBeVisible();
  });

  test('配置模板区域显示', async ({ page }) => {
    // 模板选择器
    const templateSection = page.locator('text=Configuration Templates');
    await expect(templateSection).toBeVisible();
  });

  test('预设模板可点击', async ({ page }) => {
    // 查找预设模板卡片
    const templateCards = page.locator('button').filter({ hasText: /Conservative|Aggressive|Balanced|Research|Creative/ });
    const count = await templateCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Save as Template 按钮存在', async ({ page }) => {
    const saveAsTemplateBtn = page.locator('button:has-text("Save as Template")');
    await expect(saveAsTemplateBtn).toBeVisible();
  });

  test('修改配置后 Save 按钮可用', async ({ page }) => {
    // 查找 Agent 标签页中的一个 agent，点击编辑
    const agentBtns = page.locator('button').filter({ hasText: /Orchestrator|Coder/ });
    if (await agentBtns.count() > 0) {
      await agentBtns.first().click();
      await page.waitForTimeout(300);
    }

    // 找到 temperature slider 或其他可编辑字段
    const slider = page.locator('input[type="range"]');
    if (await slider.count() > 0) {
      // 修改 temperature 值
      await slider.first().evaluate((el: HTMLInputElement) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(el, '0.5');
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      await page.waitForTimeout(200);
      // Save 按钮应该变为可点击
      const saveBtn = page.locator('button:has-text("Save"):not([disabled])');
      await expect(saveBtn).toBeVisible();
    }
  });

  test('全局配置显示 Provider 和 Model 选择器', async ({ page }) => {
    // 查找 provider 相关文本
    const providerText = page.locator('text=/Default Provider|Provider/i');
    const modelText = page.locator('text=/Default Model|Model/i');

    // 至少应该有其中一个存在
    const providerCount = await providerText.count();
    const modelCount = await modelText.count();
    expect(providerCount + modelCount).toBeGreaterThan(0);
  });
});
