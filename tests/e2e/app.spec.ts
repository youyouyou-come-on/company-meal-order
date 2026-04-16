import { expect, test, type Page } from "@playwright/test";

const adminPassword = process.env.ADMIN_PASSWORD ?? "";
const loginPassword = process.env.LOGIN_PASSWORD ?? "hzzcgc";
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
  await page.getByTestId("login-name-input").fill(userName);
  await page.getByTestId("login-password-input").fill(loginPassword);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(userName, { exact: true })).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "退出" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "公司点餐系统" })).toBeVisible();
}

async function openMealCard(
  page: Page,
  date: string,
  week: "current" | "next",
  mealType: MealType = "lunch"
) {
  await page.goto("/");
  await page.getByRole("button", { name: week === "next" ? "下周点餐" : "本周点餐" }).click();
  await page.getByTestId(`home-day-tab-${date}`).click();
  const mealCard = page.getByTestId(`home-meal-${date}-${mealType}`);
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

async function ensureSignupState(
  page: Page,
  date: string,
  mealType: MealType,
  shouldBeSignedUp: boolean
) {
  const mealCard = await openMealCard(page, date, "next", mealType);
  const signupButton = mealCard.getByRole("button", { name: /吃$/ });
  const cancelButton = mealCard.getByRole("button", { name: /不吃了/ });

  if (shouldBeSignedUp) {
    if (await signupButton.isVisible().catch(() => false)) {
      await signupButton.click();
      await expect(cancelButton).toBeVisible();
    } else {
      await expect(cancelButton).toBeVisible();
    }
    return mealCard;
  }

  if (await cancelButton.isVisible().catch(() => false)) {
    await cancelButton.click();
    await expect(signupButton).toBeVisible();
  } else {
    await expect(signupButton).toBeVisible();
  }
  return mealCard;
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

test("login does not expose employee list and requires the shared password", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("选择你的名字")).not.toBeVisible();
  await expect(page.getByText("张英俊")).not.toBeVisible();
  await expect(page.getByTestId("login-name-input")).toBeVisible();
  await expect(page.getByTestId("login-password-input")).toBeVisible();

  const usersResponse = await page.request.get("/api/auth/users");
  expect(usersResponse.status()).toBe(404);

  await page.getByTestId("login-name-input").fill(e2eUserName);
  await page.getByTestId("login-password-input").fill("wrong-password");
  await page.getByTestId("login-submit").click();
  await expect(page.getByText("姓名或密码错误")).toBeVisible();
});

test("login locks the current ip for 15 minutes after 10 failed attempts", async ({ page }) => {
  await page.goto("/login");

  for (let i = 1; i <= 9; i += 1) {
    await page.getByTestId("login-name-input").fill(e2eUserName);
    await page.getByTestId("login-password-input").fill(`wrong-password-${i}`);
    await page.getByTestId("login-submit").click();
    await expect(page.getByText("姓名或密码错误")).toBeVisible();
  }

  await page.getByTestId("login-name-input").fill(e2eUserName);
  await page.getByTestId("login-password-input").fill("wrong-password-10");
  await page.getByTestId("login-submit").click();
  await expect(page.getByText("当前网络尝试过多，请 15 分钟后再试")).toBeVisible();

  await page.getByTestId("login-password-input").fill(loginPassword);
  await page.getByTestId("login-submit").click();
  await expect(page.getByText("当前网络尝试过多，请 15 分钟后再试")).toBeVisible();
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

test("guest can browse suggestions but must login before signing up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "请先登录" }).first()).toBeVisible();
  await page.getByRole("button", { name: "请先登录" }).first().click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/suggestions");
  await expect(page.getByText("登录后可以匿名提交建议哦")).toBeVisible();
  await expect(page.getByTestId("suggestion-input")).not.toBeVisible();
});

test("admin verification rejects wrong password and accepts the correct one", async ({ page }) => {
  test.skip(!adminPassword, "ADMIN_PASSWORD is required for admin e2e coverage.");

  await login(page);
  await page.goto("/admin");

  await page.getByTestId("admin-password-input").fill("definitely-wrong-password");
  await page.getByTestId("admin-password-submit").click();
  await expect(page.getByText("密码错误")).toBeVisible();
  await expect(page.getByTestId("admin-week-grid")).not.toBeVisible();

  await page.getByTestId("admin-password-input").fill(adminPassword);
  await page.getByTestId("admin-password-submit").click();
  await expect(page.getByTestId("admin-week-grid")).toBeVisible();
});

test("two users see consistent signup counts and attendee names", async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();
  const targetDate = nextWeekMondayIsoDate();

  try {
    await login(firstPage, e2eUserName);
    await login(secondPage, e2eSecondUserName);

    await ensureSignupState(firstPage, targetDate, "dinner", false);
    await ensureSignupState(secondPage, targetDate, "dinner", false);

    let firstMealCard = await ensureSignupState(firstPage, targetDate, "dinner", true);
    await expect(firstMealCard).toContainText("1 人");
    await expect(firstMealCard).toContainText(e2eUserName);

    let secondMealCard = await openMealCard(secondPage, targetDate, "next", "dinner");
    await secondPage.reload();
    secondMealCard = await openMealCard(secondPage, targetDate, "next", "dinner");
    await expect(secondMealCard).toContainText("1 人");
    await expect(secondMealCard).toContainText(e2eUserName);

    secondMealCard = await ensureSignupState(secondPage, targetDate, "dinner", true);
    await expect(secondMealCard).toContainText("2 人");
    await expect(secondMealCard).toContainText(e2eUserName);
    await expect(secondMealCard).toContainText(e2eSecondUserName);

    await firstPage.reload();
    firstMealCard = await openMealCard(firstPage, targetDate, "next", "dinner");
    await expect(firstMealCard).toContainText("2 人");
    await expect(firstMealCard).toContainText(e2eUserName);
    await expect(firstMealCard).toContainText(e2eSecondUserName);
  } finally {
    await ensureSignupState(firstPage, targetDate, "dinner", false).catch(() => {});
    await ensureSignupState(secondPage, targetDate, "dinner", false).catch(() => {});
    await firstContext.close();
    await secondContext.close();
  }
});
