import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__MERDEKA_TEST__));
  await expect(page.locator("#gameCanvas")).toBeVisible();
  expect(errors).toEqual([]);
});

test("starts and launches with keyboard", async ({ page }) => {
  await page.keyboard.press("Space");
  await page.keyboard.down("Space");
  await page.waitForTimeout(150);
  await page.keyboard.up("Space");
  const snapshot = await page.evaluate(() => window.__MERDEKA_TEST__.snapshot());
  expect(snapshot.state).toBe("playing");
  expect(snapshot.rules.ballInPlay).toBe(true);
});

test("completes deterministic Rainstorm route", async ({ page }) => {
  const result = await page.evaluate(() => {
    const testApi = window.__MERDEKA_TEST__;
    testApi.scenario("multiball");
    testApi.emit("coast", { coast: "west" });
    testApi.emit("coast", { coast: "east" });
    testApi.emit("skybridge");
    return testApi.snapshot();
  });
  expect(result.rules.mode).toBe("completed");
  expect(result.rules.modeCompletions).toBe(1);
  expect(result.balls).toHaveLength(2);
});

test("cabinet is large and canvas is high-DPI aware", async ({ page }) => {
  const box = await page.locator(".cabinet").boundingBox();
  const viewport = page.viewportSize();
  expect(box.height).toBeGreaterThan(viewport.height * 0.7);
  const dimensions = await page.locator("#gameCanvas").evaluate((canvas) => ({ css: canvas.clientWidth, backing: canvas.width }));
  expect(dimensions.backing).toBeGreaterThanOrEqual(dimensions.css);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
