import { expect, test, type Page } from "@playwright/test";

async function closeSummary(page: Page) {
  await expect(page.getByRole("heading", { name: "Підсумок симуляції" })).toBeVisible();
  await page.getByRole("button", { name: "Зрозуміло" }).click();
}

test("create campaign → ad set → ad, publish, simulate and keep it after reload", async ({ page }) => {
  await page.goto("/campaign-builder");
  await page.getByLabel("Назва кампанії").fill("E2E · Traffic");
  await page.getByRole("radio", { name: /^Traffic/ }).click();
  await page.getByRole("button", { name: /Зберегти й далі/ }).click();

  await expect(page.getByLabel("Назва набору")).toBeVisible();
  await expect(page.getByText("Оцінка на день")).toBeVisible();
  await page.getByRole("button", { name: /Зберегти й далі/ }).click();

  await page.getByRole("button", { name: /Додати медіа/ }).click();
  await page.getByRole("button", { name: /урок за 30 секунд/ }).click();
  await page.getByLabel(/Основний текст/).fill("Безкоштовний урок з таргетованої реклами: практика і ментор.");
  await page.getByLabel(/Заголовок/).fill("Безкоштовний урок таргету");
  await page.getByRole("button", { name: "Шаблон" }).click();
  await expect(page.getByText("UTM OK")).toBeVisible();
  await page.getByRole("button", { name: /Зберегти й далі/ }).click();

  await expect(page.getByRole("heading", { name: "Перевірка налаштувань" })).toBeVisible();
  await page.getByRole("button", { name: /Опублікувати/ }).click();
  await expect(page).toHaveURL(/\/ads-manager/);
  const row = page.getByRole("button", { name: "E2E · Traffic", exact: true });
  await expect(row).toBeVisible();
  await expect(page.getByText("На перевірці").first()).toBeVisible();

  await page.getByTestId("simulate-1").click();
  await closeSummary(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "E2E · Traffic", exact: true })).toBeVisible();
  await expect(page.getByText(/день 9/)).toBeVisible();
});

test("form validation blocks an empty campaign name", async ({ page }) => {
  await page.goto("/campaign-builder");
  await page.getByLabel("Назва кампанії").fill("");
  await page.getByRole("button", { name: /Зберегти й далі/ }).click();
  await expect(page.getByText("Вкажіть назву кампанії")).toBeVisible();
});

test("edit an ad set from the side panel", async ({ page }) => {
  await page.goto("/ads-manager");
  await page.getByTestId("tab-ad_set").click();
  await page.getByRole("button", { name: "Редагувати" }).first().click();
  const name = page.getByLabel("Назва набору");
  await name.fill("UA · edited set");
  await page.getByRole("button", { name: "Зберегти", exact: true }).click();
  await expect(page.getByText("Набір оновлено")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "UA · edited set", exact: true })).toBeVisible();
});

test("pause and resume a campaign, simulate 7 days", async ({ page }) => {
  await page.goto("/ads-manager");
  const toggle = page.getByRole("switch", { name: /Увімкнути\/вимкнути Приклад/ });
  await toggle.click();
  await expect(page.getByText("Вимкнено").first()).toBeVisible();
  await toggle.click();
  await page.getByTestId("simulate-7").click();
  await closeSummary(page);
  await expect(page.getByText(/день 15/)).toBeVisible();
});

test("analytics shows charts, table view and diagnostics", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page.getByText("Витрати по днях")).toBeVisible();
  await page.getByRole("button", { name: "Показати таблицею" }).first().click();
  await expect(page.getByRole("columnheader", { name: "Дата" }).first()).toBeVisible();
  await page.getByRole("tab", { name: /Атрибуція/ }).click();
  await expect(page.getByText("7-day click + 1-day view").first()).toBeVisible();
});

test("mission: start, answer, submit and see the assessment", async ({ page }) => {
  await page.goto("/missions/m09");
  await page.getByTestId("start-mission").click();
  await expect(page.getByRole("heading", { name: "Хід місії" })).toBeVisible();
  await page.getByText("Текст капсом зі знаками оклику — сприймається як спам").click();
  await page.getByText("Горизонтальне 16:9 довге відео у вертикальних Stories/Reels").click();
  await page.getByLabel(/Поясніть зв'язок між форматом медіа/).fill(
    "У Stories і Reels потрібне вертикальне 9:16 медіа; горизонтальне відео з полями і текст капсом знижують CTR, а CTA Watch more не веде до переходу.",
  );
  await page.getByTestId("submit-mission").click();
  await page.getByRole("button", { name: "Здати", exact: true }).click();
  await expect(page.getByText("Skill Score / 100")).toBeVisible();
  await expect(page.getByRole("link", { name: /Кейс у портфоліо/ })).toBeVisible();
  await page.getByRole("link", { name: /Кейс у портфоліо/ }).click();
  await expect(page).toHaveURL(/\/portfolio\/case\/?\?id=/);
  await expect(page.getByText(/результати отримано в симуляторі/i).first()).toBeVisible();
});

test("error lab: submit a diagnosis and get feedback", async ({ page }) => {
  await page.goto("/error-lab/e03");
  await page.getByText("Подія Lead не спрацьовує на сторінці подяки після оновлення сайту").click();
  await page.getByText("У Events Manager немає події Lead").click();
  await page.getByLabel(/Пояснення/).fill("Після оновлення сайту подія Lead не надходить у датасет, тому кабінет показує нуль, а CRM фіксує заявки.");
  await page.getByTestId("submit-diagnosis").click();
  await expect(page.getByText(/Результат: \d+\/100/)).toBeVisible();
  await expect(page.getByText("Список перевірок")).toBeVisible();
});

test("knowledge base: search, open an article and pass the quiz", async ({ page }) => {
  await page.goto("/knowledge");
  await page.getByLabel("Пошук по базі знань").fill("дедуплікація");
  await page.getByRole("link", { name: /Pixel \+ Conversions API/ }).click();
  await expect(page.getByRole("heading", { name: "Визначення" })).toBeVisible();
  await page.getByRole("radio", { name: "Однакові event_id та event_name" }).click();
  await page.getByRole("radio", { name: /Обидві будуть враховані/ }).click();
  await page.getByRole("button", { name: "Перевірити" }).click();
  await expect(page.getByText(/Правильно:/)).toBeVisible();
});
