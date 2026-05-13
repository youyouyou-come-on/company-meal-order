import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  addBusinessDays,
  getBusinessDateWeekday,
  getChinaTodayString,
  getChinaWeekStart,
} from "../../src/lib/china-date";

const adminPassword = process.env.ADMIN_PASSWORD ?? "";
const loginPassword = process.env.LOGIN_PASSWORD ?? "hzzcgc";
const loginLockMaxFailedAttempts = Number.parseInt(
  process.env.LOGIN_LOCK_MAX_FAILED_ATTEMPTS ?? "10",
  10
);
const loginLockDurationMinutes = Number.parseInt(
  process.env.LOGIN_LOCK_DURATION_MINUTES ?? "15",
  10
);
const e2eUserName = "张英俊";
const e2eSecondUserName = "杜平花";
type MealType = "lunch" | "dinner";

function todayIsoDate() {
  return getChinaTodayString();
}

function currentSelectableDate() {
  const today = todayIsoDate();
  const day = getBusinessDateWeekday(today);
  if (day === 0) {
    return addBusinessDays(today, -6);
  }
  return today;
}

function currentWeekPastDate() {
  const mondayStr = getChinaWeekStart();

  return mondayStr < todayIsoDate() ? mondayStr : null;
}

function nextWeekMondayIsoDate() {
  return getChinaWeekStart(new Date(), 1);
}

function getMondayFromDate(dateStr: string) {
  const day = getBusinessDateWeekday(dateStr);
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addBusinessDays(dateStr, diffToMonday);
}

async function login(page: Page, userName = e2eUserName) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "广众&众创内部点餐系统" })).toBeVisible();
  await page.getByTestId("login-name-input").fill(userName);
  await page.getByTestId("login-password-input").fill(loginPassword);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(userName, { exact: true })).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "退出" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "广众&众创内部点餐系统" })).toBeVisible();
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
  await verifyAdminRoute(page, "/admin", "admin-week-grid");
}

async function verifyEmployeeAdmin(page: Page) {
  await verifyAdminRoute(page, "/employees", "admin-employee-panel");
}

async function verifyAdminRoute(page: Page, path: string, readyTestId: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // 管理员状态会在客户端异步恢复，先给页面一次从验证框切到后台内容的机会。
  await page.waitForTimeout(500);
  if (await page.getByTestId(readyTestId).isVisible().catch(() => false)) {
    return;
  }

  const passwordInput = page.getByTestId("admin-password-input");
  await expect(passwordInput).toBeVisible();
  await passwordInput.fill(adminPassword);
  await page.getByTestId("admin-password-submit").click();
  await expect(page.getByTestId(readyTestId)).toBeVisible();
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

async function readMealTotalQuantity(mealCard: Locator) {
  const value = await mealCard.locator('[data-testid$="-total-quantity"]').textContent();
  return Number.parseInt(value ?? "0", 10);
}

async function setMealQuantity(mealCard: Locator, quantity: number) {
  await mealCard.locator('input[data-testid$="-quantity-input"]').fill(String(quantity));
}

async function confirmMealQuantity(mealCard: Locator) {
  const confirmButton = mealCard.locator('button[data-testid$="-confirm"]');
  if (!(await confirmButton.isDisabled())) {
    await confirmButton.click();
  }
}

async function ensureMealQuantity(
  page: Page,
  date: string,
  mealType: MealType,
  quantity: number
) {
  const mealCard = await openMealCard(page, date, "next", mealType);
  const confirmButton = mealCard.locator('button[data-testid$="-confirm"]');
  const cancelButton = mealCard.locator('button[data-testid$="-cancel"]');
  const quantityInput = mealCard.locator('input[data-testid$="-quantity-input"]');

  if (quantity === 0) {
    if (await cancelButton.isVisible().catch(() => false)) {
      await cancelButton.click();
      await expect(confirmButton).toBeVisible();
    } else {
      await expect(confirmButton).toBeVisible();
    }
    return mealCard;
  }

  await setMealQuantity(mealCard, quantity);
  await confirmMealQuantity(mealCard);
  await expect(cancelButton).toBeVisible();
  await expect(quantityInput).toHaveValue(String(quantity));
  return mealCard;
}

test.describe.configure({ mode: "serial" });

test("user can login and view current meal cards", async ({ page }) => {
  await login(page, e2eUserName);
  const activeDate = currentSelectableDate();

  await expect(page.getByTestId(`home-day-tab-${activeDate}`)).toBeVisible();
  await expect(page.getByTestId(`home-selected-day-${activeDate}`)).toBeVisible();
  await expect(page.getByTestId(`home-selected-day-summary-${activeDate}-lunch`)).toBeVisible();
  await expect(page.getByTestId(`home-selected-day-summary-${activeDate}-dinner`)).toBeVisible();
  await expect(page.getByText("午餐总份数")).toBeVisible();
  await expect(page.getByText("晚餐总份数")).toBeVisible();
  await expect(page.getByTestId(`home-meal-${activeDate}-lunch`)).toBeVisible();
  await expect(page.getByTestId(`home-meal-${activeDate}-dinner`)).toBeVisible();
  await expect(page.getByText("当天合计")).not.toBeVisible();
  await expect(page.getByRole("link", { name: "建议专区" })).toBeVisible();
  await expect(page.getByRole("link", { name: "管理菜单" })).toBeVisible();
  await expect(page.getByRole("link", { name: "员工管理" })).toBeVisible();
});

test("past dates are marked as expired instead of available", async ({ page }) => {
  const expiredDate = currentWeekPastDate();
  test.skip(!expiredDate, "当前周没有已过期日期可验证。");

  await login(page, e2eUserName);
  await expect(page.getByTestId(`home-day-tab-${expiredDate}`)).toContainText("已过期");
  await expect(page.getByTestId(`home-day-tab-${expiredDate}`)).not.toContainText("可点餐日");
});

test("login does not expose employee list and requires the shared password", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("选择你的名字")).not.toBeVisible();
  await expect(page.getByText("张英俊")).not.toBeVisible();
  await expect(page.getByTestId("login-name-input")).toBeVisible();
  await expect(page.getByTestId("login-password-input")).toBeVisible();

  const usersResponse = await page.request.get("/api/auth/users");
  expect(usersResponse.status()).toBe(404);

  const failedLoginResponse = await page.request.post("/api/auth/login", {
    headers: {
      "x-forwarded-for": "198.51.100.10",
    },
    data: {
      name: e2eUserName,
      password: "wrong-password",
    },
  });
  expect(failedLoginResponse.status()).toBe(400);
  await expect(failedLoginResponse.json()).resolves.toMatchObject({
    error: "姓名或密码错误",
  });
});

test("login locks the current ip after repeated failed attempts", async ({ page }) => {
  const lockedIp = "198.51.100.11";

  for (let i = 1; i < loginLockMaxFailedAttempts; i += 1) {
    const response = await page.request.post("/api/auth/login", {
      headers: {
        "x-forwarded-for": lockedIp,
      },
      data: {
        name: e2eUserName,
        password: `wrong-password-${i}`,
      },
    });
    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "姓名或密码错误",
    });
  }

  const lockedResponse = await page.request.post("/api/auth/login", {
    headers: {
      "x-forwarded-for": lockedIp,
    },
    data: {
      name: e2eUserName,
      password: `wrong-password-${loginLockMaxFailedAttempts}`,
    },
  });
  expect(lockedResponse.status()).toBe(429);
  await expect(lockedResponse.json()).resolves.toMatchObject({
    error: `当前网络尝试过多，请 ${loginLockDurationMinutes} 分钟后再试`,
  });

  const blockedCorrectPasswordResponse = await page.request.post("/api/auth/login", {
    headers: {
      "x-forwarded-for": lockedIp,
    },
    data: {
      name: e2eUserName,
      password: loginPassword,
    },
  });
  expect(blockedCorrectPasswordResponse.status()).toBe(429);
  await expect(blockedCorrectPasswordResponse.json()).resolves.toMatchObject({
    error: `当前网络尝试过多，请 ${loginLockDurationMinutes} 分钟后再试`,
  });
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

  await page.getByRole("link", { name: "员工管理" }).click();
  await expect(page).toHaveURL(/\/employees$/);
  await expect(page.getByText("管理员验证")).toBeVisible();

  await page.getByRole("link", { name: "点餐" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "下周点餐" })).toBeVisible();

  await logout(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/employees");
  await expect(page).toHaveURL(/\/login$/);
});

test("user can adjust next week's lunch quantity and cancel it later", async ({ page }) => {
  await login(page);
  const targetDate = nextWeekMondayIsoDate();
  await openMealCard(page, targetDate, "next");
  await expect(page.getByTestId(`home-meal-${targetDate}-lunch-status-note`)).toContainText("请选择 1 份或多份");

  await ensureMealQuantity(page, targetDate, "lunch", 0);
  await page.reload();

  const refreshedMealCard = await openMealCard(page, targetDate, "next");
  const baselineTotal = await readMealTotalQuantity(refreshedMealCard);

  await setMealQuantity(refreshedMealCard, 2);
  await confirmMealQuantity(refreshedMealCard);
  await expect(refreshedMealCard.locator('button[data-testid$="-cancel"]')).toBeVisible();
  await expect(refreshedMealCard.locator('input[data-testid$="-quantity-input"]')).toHaveValue("2");
  await expect(refreshedMealCard.locator('[data-testid$="-total-quantity"]')).toHaveText(
    String(baselineTotal + 2)
  );
  await expect(page.getByTestId(`home-selected-day-summary-${targetDate}-lunch`)).toContainText(
    String(baselineTotal + 2)
  );
  await expect(refreshedMealCard).toContainText(`${e2eUserName} × 2`);
  await expect(page.getByTestId(`home-meal-${targetDate}-lunch-status-note`)).toContainText("你当前已点 2 份");

  await page.getByTestId(`home-selected-day-summary-${targetDate}-lunch`).click();
  await expect(page.getByTestId("home-summary-modal")).toBeVisible();
  await expect(page.getByTestId("home-summary-modal")).toContainText("午餐点餐名单");
  await expect(page.getByTestId("home-summary-modal")).toContainText(e2eUserName);
  await expect(page.getByTestId("home-summary-modal")).toContainText("2 份");
  await page.getByTestId("home-summary-modal-close").click();
  await expect(page.getByTestId("home-summary-modal")).not.toBeVisible();

  await setMealQuantity(refreshedMealCard, 3);
  await confirmMealQuantity(refreshedMealCard);
  await expect(refreshedMealCard.locator('input[data-testid$="-quantity-input"]')).toHaveValue("3");
  await expect(refreshedMealCard.locator('[data-testid$="-total-quantity"]')).toHaveText(
    String(baselineTotal + 3)
  );
  await expect(refreshedMealCard).toContainText(`${e2eUserName} × 3`);

  await refreshedMealCard.locator('button[data-testid$="-cancel"]').click();
  await expect(refreshedMealCard.locator('[data-testid$="-total-quantity"]')).toHaveText(
    String(baselineTotal)
  );
  await expect(page.getByTestId(`home-selected-day-summary-${targetDate}-lunch`)).toContainText(
    String(baselineTotal)
  );
  await expect(refreshedMealCard).not.toContainText(`${e2eUserName} × 3`);
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

  await ensureMealQuantity(page, targetDate, "lunch", 0);
  let mealCard = await ensureMealQuantity(page, targetDate, "lunch", 2);
  await expect(mealCard.locator('button[data-testid$="-cancel"]')).toBeVisible();

  await page.reload();
  mealCard = await openMealCard(page, targetDate, "next");
  await expect(mealCard.locator('button[data-testid$="-cancel"]')).toBeVisible();
  await expect(mealCard.locator('input[data-testid$="-quantity-input"]')).toHaveValue("2");
  await expect(mealCard).toContainText(`${e2eUserName} × 2`);

  await logout(page);
  await login(page);
  mealCard = await openMealCard(page, targetDate, "next");
  await expect(mealCard.locator('button[data-testid$="-cancel"]')).toBeVisible();
  await expect(mealCard.locator('input[data-testid$="-quantity-input"]')).toHaveValue("2");

  await mealCard.locator('button[data-testid$="-cancel"]').click();
  await expect(mealCard.locator('button[data-testid$="-confirm"]')).toBeVisible();
  await expect(mealCard).not.toContainText(`${e2eUserName} × 2`);
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

test("employee management route uses the same admin password", async ({ page }) => {
  test.skip(!adminPassword, "ADMIN_PASSWORD is required for employee management e2e coverage.");

  await login(page);
  await page.goto("/employees");

  await expect(page.getByText("管理员验证")).toBeVisible();
  await page.getByTestId("admin-password-input").fill("definitely-wrong-password");
  await page.getByTestId("admin-password-submit").click();
  await expect(page.getByText("密码错误")).toBeVisible();
  await expect(page.getByTestId("admin-employee-panel")).not.toBeVisible();

  await page.getByTestId("admin-password-input").fill(adminPassword);
  await page.getByTestId("admin-password-submit").click();
  await expect(page.getByRole("heading", { name: "员工管理" }).first()).toBeVisible();
  await expect(page.getByTestId("admin-employee-panel")).toBeVisible();
});

test("employee management can search employees by name", async ({ page }) => {
  test.skip(!adminPassword, "ADMIN_PASSWORD is required for employee management e2e coverage.");

  await login(page);
  await verifyEmployeeAdmin(page);

  await expect(page.getByTestId("admin-employee-row").filter({ hasText: "张小龙" })).toBeVisible();

  await page.getByTestId("admin-employee-search-input").fill("张小龙");
  await expect(page.getByTestId("admin-employee-search-count")).toContainText("显示 1 /");
  await expect(page.getByTestId("admin-employee-row")).toHaveCount(1);
  await expect(page.getByTestId("admin-employee-row")).toContainText("张小龙");
  await expect(page.getByTestId("admin-employee-row")).not.toContainText("张英俊");

  await page.getByTestId("admin-employee-search-input").fill("不存在的员工");
  await expect(page.getByTestId("admin-employee-search-empty")).toBeVisible();

  await page.getByTestId("admin-employee-search-clear").click();
  await expect(page.getByTestId("admin-employee-search-input")).toHaveValue("");
  await expect(page.getByTestId("admin-employee-row").filter({ hasText: "张小龙" })).toBeVisible();
  await expect(page.getByTestId("admin-employee-row").filter({ hasText: "张英俊" })).toBeVisible();
});

test("admin can add and disable an employee account", async ({ page, request }) => {
  test.skip(!adminPassword, "ADMIN_PASSWORD is required for employee management e2e coverage.");

  await login(page);
  await verifyEmployeeAdmin(page);

  const employeeName = `E2E员工${Date.now()}`;
  const employeeRow = () =>
    page.getByTestId("admin-employee-row").filter({ hasText: employeeName });

  try {
    await expect(page.getByTestId("admin-employee-panel")).toBeVisible();
    await page.getByTestId("admin-employee-name-input").fill(employeeName);
    await page.getByTestId("admin-employee-add").click();
    await expect(employeeRow()).toBeVisible();
    await expect(employeeRow()).toContainText("可登录");

    const loginResponse = await request.post("/api/auth/login", {
      headers: { "x-forwarded-for": `203.0.113.${Date.now() % 200}` },
      data: { name: employeeName, password: loginPassword },
    });
    expect(loginResponse.ok()).toBeTruthy();

    await employeeRow().getByTestId("admin-employee-toggle").click();
    await expect(employeeRow()).toContainText("已停用");

    const disabledLoginResponse = await request.post("/api/auth/login", {
      headers: { "x-forwarded-for": `203.0.113.${(Date.now() % 200) + 1}` },
      data: { name: employeeName, password: loginPassword },
    });
    expect(disabledLoginResponse.status()).toBe(400);
    await expect(disabledLoginResponse.json()).resolves.toMatchObject({
      error: "姓名或密码错误",
    });

    await employeeRow().getByTestId("admin-employee-toggle").click();
    await expect(employeeRow()).toContainText("可登录");
  } finally {
    const usersResponse = await page.request.get("/api/admin/users");
    if (usersResponse.ok()) {
      const data = await usersResponse.json();
      const employee = (data.users as Array<{ id: number; name: string }>).find(
        (item) => item.name === employeeName
      );
      if (employee) {
        await page.request.patch("/api/admin/users", {
          data: { id: employee.id, isActive: true },
        });
      }
    }
  }
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

    await ensureMealQuantity(firstPage, targetDate, "dinner", 0);
    await ensureMealQuantity(secondPage, targetDate, "dinner", 0);

    let firstMealCard = await openMealCard(firstPage, targetDate, "next", "dinner");
    const baselineTotal = await readMealTotalQuantity(firstMealCard);

    firstMealCard = await ensureMealQuantity(firstPage, targetDate, "dinner", 1);
    await expect(firstMealCard.locator('[data-testid$="-total-quantity"]')).toHaveText(
      String(baselineTotal + 1)
    );
    await expect(firstMealCard).toContainText(e2eUserName);

    let secondMealCard = await openMealCard(secondPage, targetDate, "next", "dinner");
    await secondPage.reload();
    secondMealCard = await openMealCard(secondPage, targetDate, "next", "dinner");
    await expect(secondMealCard.locator('[data-testid$="-total-quantity"]')).toHaveText(
      String(baselineTotal + 1)
    );
    await expect(secondMealCard).toContainText(e2eUserName);

    secondMealCard = await ensureMealQuantity(secondPage, targetDate, "dinner", 2);
    await expect(secondMealCard.locator('[data-testid$="-total-quantity"]')).toHaveText(
      String(baselineTotal + 3)
    );
    await expect(secondMealCard).toContainText(e2eUserName);
    await expect(secondMealCard).toContainText(`${e2eSecondUserName} × 2`);

    await firstPage.reload();
    firstMealCard = await openMealCard(firstPage, targetDate, "next", "dinner");
    await expect(firstMealCard.locator('[data-testid$="-total-quantity"]')).toHaveText(
      String(baselineTotal + 3)
    );
    await expect(firstMealCard).toContainText(e2eUserName);
    await expect(firstMealCard).toContainText(`${e2eSecondUserName} × 2`);
  } finally {
    await ensureMealQuantity(firstPage, targetDate, "dinner", 0).catch(() => {});
    await ensureMealQuantity(secondPage, targetDate, "dinner", 0).catch(() => {});
    await firstContext.close();
    await secondContext.close();
  }
});
