import { expect, test, type Page } from "@playwright/test";

const adminPassword = process.env.ADMIN_PASSWORD ?? "";
const e2eUserName = "张英俊";
const e2eSecondUserName = "杜平花";
type MealType = "lunch" | "dinner";

function todayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function currentSelectableDate() {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0) {
    const monday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)
    );
    return monday.toISOString().split("T")[0];
  }
  return todayIsoDate();
}

function nextWeekMondayIsoDate() {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday + 7)
  );
  return monday.toISOString().split("T")[0];
}

function getMondayFromDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diffToMonday)
  );
  return monday.toISOString().split("T")[0];
}

async function login(page: Page, userName = e2eUserName) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "公司点餐系统" })).toBeVisible();
  await page.getByTestId("user-search-input").fill(userName);
  await page.getByRole("button", { name: userName }).click();
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(userName, { exact: true })).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "退出" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "公司点餐系统" })).toBeVisible();
}

async function openMealCard(page: Page, date: string, week: "current" | "next") {
  await page.goto("/");
  await page.getByRole("button", { name: week === "next" ? "下周点餐" : "本周点餐" }).click();
  await page.getByTestId(`home-day-tab-${date}`).click();
  const mealCard = page.getByTestId(`home-meal-${date}-lunch`);
  await expect(mealCard).toBeVisible();
  return mealCard;
}

async function getWeekMenus(page: Page, weekStart?: string) {
  const query = weekStart ? `?weekStart=${weekStart}` : "";
  const response = await page.request.get(`/api/menus/week${query}`);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return data.menus as Array<{ date: string; mealType: MealType; dishes: string }>;
}

async function verifyAdmin(page: Page) {
  await page.goto("/admin");
  const passwordInput = page.getByTestId("admin-password-input");
  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(adminPassword);
    await page.getByTestId("admin-password-submit").click();
  }
  await expect(page.getByTestId("admin-week-grid")).toBeVisible();
}

async function setAdminMenuByApi(
  page: Page,
  date: string,
  mealType: MealType,
  dishes: string | null
) {
  const response = dishes
    ? await page.request.post("/api/admin/menus", {
        data: { date, mealType, dishes },
      })
    : await page.request.delete("/api/admin/menus", {
        data: { date, mealType },
      });

  expect(response.ok()).toBeTruthy();
}

test.describe.configure({ mode: "serial" });

test("user can login and view current meal cards", async ({ page }) => {
  await login(page, e2eUserName);
  const activeDate = currentSelectableDate();

  await expect(page.getByTestId(`home-day-tab-${activeDate}`)).toBeVisible();
  await expect(page.getByTestId(`home-selected-day-${activeDate}`)).toBeVisible();
  await expect(page.getByTestId(`home-meal-${activeDate}-lunch`)).toBeVisible();
  await expect(page.getByTestId(`home-meal-${activeDate}-dinner`)).toBeVisible();
  await expect(page.getByRole("link", { name: "建议专区" })).toBeVisible();
  await expect(page.getByRole("link", { name: "管理菜单" })).toBeVisible();
});

test("user can login and logout repeatedly", async ({ page }) => {
  await login(page, e2eUserName);
  await logout(page);

  await login(page, e2eSecondUserName);
  await logout(page);

  await login(page, e2eUserName);
  await expect(page.getByText(e2eUserName, { exact: true })).toBeVisible();
});

test("logged-in user can create a suggestion and it persists after reload", async ({ page }) => {
  await login(page);
  await page.goto("/suggestions");

  const suggestionText = `E2E建议-${Date.now()}`;
  await page.getByTestId("suggestion-input").fill(suggestionText);
  await page.getByTestId("suggestion-submit").click();

  const item = page.getByText(suggestionText, { exact: true });
  await expect(item).toBeVisible();
  await expect(page.getByText("匿名同事")).toBeVisible();

  await page.reload();
  await expect(page.getByText(suggestionText, { exact: true })).toBeVisible();

  const row = page.locator("div").filter({ has: item }).first();
  await row.getByRole("button", { name: "删除" }).click();
  await expect(item).not.toBeVisible();
});

test("all main page navigations work", async ({ page }) => {
  await login(page);

  await page.getByRole("link", { name: "建议专区" }).click();
  await expect(page).toHaveURL(/\/suggestions$/);
  await expect(page.getByRole("heading", { name: "建议专区" })).toBeVisible();

  await page.getByRole("link", { name: "管理菜单" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("管理员验证")).toBeVisible();

  await page.getByRole("link", { name: "🍽️ 公司点餐" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "下周点餐" })).toBeVisible();

  await logout(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("user can repeatedly sign up and cancel next week's lunch", async ({ page }) => {
  await login(page);
  const targetDate = nextWeekMondayIsoDate();
  const mealCard = await openMealCard(page, targetDate, "next");
  await expect(page.getByTestId(`home-meal-${targetDate}-lunch-status-note`)).toContainText("还能改回");

  const cancelButton = mealCard.getByRole("button", { name: /不吃了/ });
  if (await cancelButton.isVisible().catch(() => false)) {
    await cancelButton.click();
    await expect(mealCard.getByRole("button", { name: /吃$/ })).toBeVisible();
  }

  for (let i = 0; i < 2; i += 1) {
    await mealCard.getByRole("button", { name: /吃$/ }).click();
    await expect(mealCard.getByRole("button", { name: /不吃了/ })).toBeVisible();
    await expect(page.getByTestId(`home-meal-${targetDate}-lunch-status-note`)).toContainText("可以点“不吃了”取消");

    await mealCard.getByRole("button", { name: /不吃了/ }).click();
    await expect(mealCard.getByRole("button", { name: /吃$/ })).toBeVisible();
    await expect(page.getByTestId(`home-meal-${targetDate}-lunch-status-note`)).toContainText("还能改回");
  }
});

test("admin page requires password before menu management is shown", async ({ page }) => {
  await login(page);
  await page.goto("/admin");

  await expect(page.getByText("管理员验证")).toBeVisible();
  await expect(page.getByTestId("admin-password-input")).toBeVisible();
  await expect(page.getByTestId("admin-password-submit")).toBeVisible();
});

test("admin can save a menu and the saved value survives reload", async ({ page }) => {
  test.skip(!adminPassword, "ADMIN_PASSWORD is required for admin e2e coverage.");

  await login(page);
  const targetDate = nextWeekMondayIsoDate();
  const weekStart = getMondayFromDate(targetDate);
  const originalMenu = (await getWeekMenus(page, weekStart)).find(
    (item) => item.date === targetDate && item.mealType === "lunch"
  );
  const updatedDishes = `E2E菜单-${Date.now()} 红烧排骨`;

  try {
    await verifyAdmin(page);
    await page.getByRole("button", { name: "下一周 →" }).click();

    const slot = page.getByTestId(`meal-slot-${targetDate}-lunch`);
    await expect(slot).toBeVisible();
    await slot.click();

    await page.getByTestId(`meal-editor-${targetDate}-lunch`).fill(updatedDishes);
    await page.getByTestId(`meal-save-${targetDate}-lunch`).click();
    await expect(page.getByTestId(`meal-dishes-${targetDate}-lunch`)).toContainText(updatedDishes);

    await page.reload();
    await page.getByRole("button", { name: "下一周 →" }).click();
    await expect(page.getByTestId(`meal-dishes-${targetDate}-lunch`)).toContainText(updatedDishes);
  } finally {
    await verifyAdmin(page);
    await setAdminMenuByApi(page, targetDate, "lunch", originalMenu?.dishes ?? null);
  }
});

test("signup data persists after reload and re-login", async ({ page }) => {
  await login(page);
  const targetDate = nextWeekMondayIsoDate();

  let mealCard = await openMealCard(page, targetDate, "next");
  const cancelButton = mealCard.getByRole("button", { name: /不吃了/ });
  if (await cancelButton.isVisible().catch(() => false)) {
    await cancelButton.click();
    await expect(mealCard.getByRole("button", { name: /吃$/ })).toBeVisible();
  }

  await mealCard.getByRole("button", { name: /吃$/ }).click();
  await expect(mealCard.getByRole("button", { name: /不吃了/ })).toBeVisible();

  await page.reload();
  mealCard = await openMealCard(page, targetDate, "next");
  await expect(mealCard.getByRole("button", { name: /不吃了/ })).toBeVisible();

  await logout(page);
  await login(page);
  mealCard = await openMealCard(page, targetDate, "next");
  await expect(mealCard.getByRole("button", { name: /不吃了/ })).toBeVisible();

  await mealCard.getByRole("button", { name: /不吃了/ }).click();
  await expect(mealCard.getByRole("button", { name: /吃$/ })).toBeVisible();
});
