# Архітектура AdLab Simulator

Документ описує, як влаштовано код: шари, потоки даних, збереження стану й тести.
Формули симуляції — у [SIMULATION_MODEL.md](SIMULATION_MODEL.md).

## Принципи

1. **Бізнес-логіка не залежить від UI.** Усе в `src/domain`, `src/simulation`, `src/scoring` і `src/content` — чисті функції TypeScript без React. Їх тестують напряму у Vitest.
2. **Стан акаунта незмінний.** Кожна дія `(account) → account'` повертає новий об'єкт. Це спрощує undo-подібні сценарії, порівняння «до/після» і тести.
3. **Детермінованість.** Однаковий стан + однакова кількість днів = однаковий результат. Випадковість береться лише з seeded RNG (`src/simulation/rng.ts`).
4. **Звітні дані відокремлено від реальних.** Рушій зберігає «сирі» факти (реальні ліди, покупки, виручку, лаги конверсій). Те, що бачить користувач у кабінеті, рахується під час запиту з урахуванням трекінгу й атрибуції.
5. **Немає декоративних елементів.** Кожен перемикач і поле впливає на модель, на валідацію або на оцінювання. Якщо функція не моделюється, це сказано в UI або в реєстрі функцій.

## Структура `src/`

```
src/
├── app/                      Next.js App Router: лише маршрути й метадані
│   ├── layout.tsx            кореневий layout, inline-скрипт теми (без мерехтіння)
│   ├── page.tsx              redirect → /dashboard
│   └── (workspace)/          усі робочі розділи під спільним AppShell
├── domain/                   типи, довідники, конфігурація цілей, фабрики, CRUD-операції
├── simulation/               модель, рушій, звітність, валідація, перевірка оголошень, діагностика
├── scoring/                  перевірки стану акаунта, оцінка місій і Error Lab
├── content/                  сценарії, місії, кейси Error Lab, статті, реєстр функцій, шлях навчання
├── store/                    Zustand-стор (єдине джерело стану UI)
├── persistence/              відкладений localStorage, опційний Supabase
├── validation/               zod-схеми форм
├── features/                 UI-розділи (кожен — окрема тека)
├── components/
│   ├── ui/                   примітиви в стилі shadcn/ui на Radix
│   ├── common/               PageHeader, EmptyState, ConfirmDialog, InfoTip, Field…
│   └── layout/               AppShell, Topbar, Providers, навігація
└── lib/                      дати, форматування, ID, cn()
```

### Шари та залежності

```
app → features → store → domain / simulation / scoring / content
                 ↑
          components (ui, common, layout)
```

- `domain` нічого не імпортує з інших шарів, крім `lib`.
- `simulation` залежить від `domain`.
- `scoring` залежить від `simulation` і `domain`.
- `content` (сценарії, місії) використовує `domain/account-builder` і `simulation` для генерації історії, а `scoring/checks` — для рубрик.
- `features` — єдиний шар, що поєднує React і бізнес-логіку.

## Доменна модель (`src/domain`)

| Файл | Призначення |
|---|---|
| `types.ts` | Усі сутності: `AdAccount`, `Campaign`, `AdSet`, `Ad`, `Creative`, `Audience`, `DailyMetrics`, `LearningState`, `ChangeLogEntry`, `MissionAttempt`, `SkillAssessment`, `KnowledgeArticle`, `FeatureRegistryEntry`… |
| `catalog.ts` | Довідники: цілі, спецкатегорії, місця конверсії, цілі ефективності, стратегії ставок, події Pixel, плейсменти (з частками інвентарю, CPM/CTR/LPV/CVR-коефіцієнтами), країни, мови, інтереси, CTA, вертикалі, медіабібліотека |
| `objective-config.ts` | Залежності налаштувань від цілі: які місця конверсії, цілі ефективності, ставки, події доступні; чи потрібен Pixel/застосунок; доступність Advantage+ campaign setup; змінні A/B тесту; правила спецкатегорій; пояснення, чому опція недоступна |
| `factories.ts` | Створення чернеток із розумними значеннями за замовчуванням. Кожна сутність отримує `seq` з лічильника акаунта |
| `operations.ts` | Усі зміни стану: add / update / duplicate / delete / setStatus / publish / updateTracking / addAudience. Кожна операція пише запис у журнал змін і, де треба, скидає навчальну фазу |
| `account-builder.ts` | Побудова сценарних акаунтів для місій і Error Lab: `createAccount`, `buildCampaign`, `runHistory`, `sealScenario` |

### Ідентифікатори й детермінованість

ID сутностей випадкові (`lib/ids.ts`), але RNG симуляції їх **не** використовує. Seed складається з `account.seed`, `seq` сутності, номера дня й мітки (`"adset"`, `"ad"`). Тому дубльована кампанія або кампанія, створена в іншій сесії, отримує ті самі результати за ту саму послідовність дій.

### Статуси

- `draft` — чернетка, не доставляється, можна вільно редагувати.
- `in_review` — після публікації, перевірка відбувається на початку наступного симульованого дня.
- `active` / `paused` — користувач перемикає лише для опублікованих сутностей.
- `rejected` — оголошення не пройшло перевірку. Після редагування креативу воно знову йде на перевірку.

Ціль опублікованої кампанії змінити не можна (як і в рекламних кабінетах). Користувачеві пропонують дублювати кампанію.

## Потоки даних

### Редагування

```
Форма (react-hook-form + zod)
  → store.mutateAccount(id, acc => operations.updateAdSet(acc, …))
  → нова версія AdAccount у сторі
  → підписані компоненти перерендерюються
  → persist пише знімок у localStorage (з затримкою)
```

`mutateAccount` відмовляє для акаунтів з `readOnly: true` (завершені спроби місій).

### Публікація

```
publish-dialog → validateCampaignTree() → є блокувальні помилки? → показати список
                                        → ні → operations.publishCampaign() → статуси in_review
```

### Симуляція

```
simulation-bar → store.simulate(id, days)
  → simulateDays(account, days, now)        // engine.ts, чиста функція
      для кожного дня:
        1. перевірка оголошень in_review (review.ts)
        2. розподіл бюджетів між наборами
        3. buildAdSetModel → simulateAdSetDay → рядки DailyMetrics
        4. перший день доставки оголошень
        5. оновлення навчальної фази
        6. запис у журнал змін
  → store повертає підсумок (витрати, схвалені/відхилені, примітки) → toast
```

### Звітність

```
use-reports / analytics → rowsInRange(account, range) → aggregate(account, rows, { attribution })
```

`aggregate` рахує звітні конверсії з лагів і вікна атрибуції в момент запиту. Тому перемикання вікна атрибуції в Analytics не потребує повторної симуляції.

### Місії та Error Lab

```
startMission(id) → mission.buildAccount() (сценарій + історія) → новий AdAccount kind="mission"
… користувач працює в цьому акаунті, відповідає на питання, заповнює кейс …
submitMission → evaluateMission(mission, account, answers, caseStudy) → SkillAssessment
             → акаунт стає readOnly, знімок іде в Portfolio
```

Error Lab працює так само, але акаунт кейсу одразу доступний лише для читання.

## Стан і збереження

### Стор (`src/store/app-store.ts`)

Один Zustand-стор з `persist`:

- `accounts` — усі акаунти (пісочниця, спроби місій, кейси Error Lab);
- `activeAccountId`, `profile`, `prefs`;
- `learning` — прочитані статті, результати тестів, виконані практичні завдання, щоденні завдання;
- `missionAttempts`, `errorLabAttempts`.

Компоненти підписуються на мінімальні зрізи (`useAppStore(s => s.missionAttempts)`), а не на весь стан.

### Гідратація

- `skipHydration: true` — стор не читає localStorage під час серверного рендеру.
- `StoreHydrator` (`components/layout/providers.tsx`) викликає `persist.rehydrate()` на клієнті.
- `onRehydrateStorage` → `ensureInitialized()` (створює пісочницю, якщо її немає) → `setHydrated()`.
- Поки `hydrated === false`, `AppShell` показує скелетон замість вмісту. Так немає миготіння порожнього стану й розбіжностей SSR/CSR.

### localStorage (`src/persistence/storage.ts`)

- `debouncedLocalStorage` відкладає запис на ~400 мс і об'єднує серію змін (наприклад, симуляцію 7 днів).
- Помилки запису (переповнення квоти) передаються в `onStorageError` → toast з порадою експортувати прогрес.
- Відкладений запис скидається на `beforeunload`; `flushStorageNow()` викликається перед експортом у Settings.
- `storageUsageBytes()` показує обсяг у Settings.
- Схема має версію (`SCHEMA_VERSION`). Імпорт JSON робить лише мінімальну перевірку (наявність `accounts` і `learning`) перед заміною стану, тому імпортуйте лише файли, експортовані з AdLab.

### Supabase (опційно, `src/persistence/supabase.ts`)

- Вмикається лише за наявності `NEXT_PUBLIC_SUPABASE_URL` і `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Вхід через magic link, ручна синхронізація: «Зберегти в хмару» (upsert одного JSON-знімка) і «Завантажити з хмари».
- Таблиця `app_snapshots` з RLS (`auth.uid() = user_id`) — `supabase/migrations/0001_app_snapshots.sql`.
- Автоматичної двосторонньої синхронізації немає: localStorage лишається основним сховищем.

## UI

### Маршрути

| Шлях | Розділ |
|---|---|
| `/dashboard` | Огляд, щоденні завдання, рекомендації |
| `/ads-manager` | Таблиці кампаній / наборів / оголошень, редагування, журнал змін, симуляція |
| `/campaign-builder` | Майстер створення (`?campaign=<id>` — продовжити чернетку) |
| `/events-manager` | Pixel, CAPI, згода, CRM |
| `/analytics` | Звіти, графіки, діагностика |
| `/missions`, `/missions/[missionId]` | Mission Center, бриф і проходження |
| `/error-lab`, `/error-lab/[caseId]` | Кейси для діагностики |
| `/knowledge`, `/knowledge/[slug]` | База знань, реєстр функцій |
| `/learning` | Шлях навчання за рівнями |
| `/portfolio`, `/portfolio/[attemptId]` | Кейси, друк / PDF, Markdown, JSON |
| `/settings` | Профіль, тема, акаунти, експорт / імпорт, Supabase |

Статичні маршрути з параметрами (`missions/[missionId]`, `knowledge/[slug]`, `error-lab/[caseId]`) генеруються через `generateStaticParams`.

### Компоненти

- `components/ui` — примітиви на Radix (Dialog, Sheet, Select, Tabs, Tooltip…), стилізовані токенами Tailwind (`hsl(var(--…))`). Світла й темна теми задаються CSS-змінними в `app/globals.css`.
- `components/common` — спільні патерни: заголовок сторінки, порожній стан, підтвердження, підказка до метрики, плитка показника, позначка «навчальні дані».
- `features/*` — розділи. Великі розділи розбито на під-компоненти (наприклад, `campaign-builder/forms/*`, `ads-manager/edit-sheet.tsx`).

### Доступність

- Усі інтерактивні елементи доступні з клавіатури (Radix + нативні кнопки). Видимий фокус-рінг.
- Гарячі клавіші: `Alt+цифра` — перехід до розділу (номер видно в підказці меню), `Shift+?` — довідка.
- Таблиці мають `<th scope="col">`. Кожен графік має перемикач на табличне подання й легенду при ≥ 2 серіях.
- Статуси передаються текстом і кольором, а не лише кольором.
- Друк: окремі print-стилі для звітів Portfolio.

## Тести

| Рівень | Де | Що перевіряє |
|---|---|---|
| Unit | `tests/unit/*.test.ts` | Формули метрик і ділення на нуль, RNG, рушій (детермінованість, бюджети, ставки, навчальна фаза, атрибуція, трекінг, вигорання), операції CRUD і журнал змін, валідація, оцінювання (обмеження балів, вгадування), регресія сценаріїв кожної місії та кейсу Error Lab |
| Інтеграційні | `tests/integration/store-flow.test.ts` | Повний сценарій через стор: створення → публікація → симуляція → місія → збереження й відновлення з localStorage |
| E2E | `tests/e2e/*.spec.ts` (Playwright) | Desktop: builder → publish → simulate → reload, валідація, редагування, пауза, Analytics, місія, Error Lab, тест у статті. Mobile (Pixel 7): відсутність горизонтального скролу на 5 ключових сторінках, мобільне меню |

Команди — у [README](../README.md#перевірки).

## Як додати…

**Нову місію.** Створіть `MissionDefinition` у `src/content/missions/*-missions.ts`: бриф, `buildAccount`, рубрику з `scoring/checks`, питання, ключові слова кейсу, експертне пояснення. Додайте її в `MISSIONS` (`missions/index.ts`). Регресійний тест у `tests/unit/scenarios.test.ts` автоматично перевірить, що сценарій будується й дає очікувані симптоми. Додайте туди перевірку симптому місії.

**Нову статтю.** Додайте об'єкт `KnowledgeArticle` у відповідний `src/content/knowledge/articles-*.ts` з `sources`, `lastReviewed`, `status`, мінітестом і посиланнями на місії.

**Нову функцію рекламного кабінету.** Спершу перевірте офіційне джерело й додайте запис у `feature-registry.ts`. Потім додайте поле в `types.ts`, значення за замовчуванням у `factories.ts`, вплив у `simulation/model.ts` або `engine.ts`, правило в `validation.ts`, UI у формі, тест. Опишіть зміну в `META_ADS_2026_CHANGELOG.md`.
