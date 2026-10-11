# META ADS 2026 CHANGELOG

Журнал змін рекламних інструментів Meta, які враховано в AdLab Simulator.
Машиночитаний реєстр (з полями `feature_name`, `supported_objectives`, `availability_status`, `region`, `verified_at`, `source_url`, `version_notes`) — у `src/content/feature-registry.ts`; він також показується в UI (Knowledge Base → «Реєстр функцій 2026», Settings).

## Метод перевірки

- Дата перевірки: **2026-10-11**.
- Пріоритет джерел: Meta Business Help Center → Meta for Business → Meta Blueprint → Meta for Developers (Pixel, Conversions API) → Google Analytics Help (GA4/UTM) → інші джерела лише як доповнення.
- Перевірка виконувалась пошуком по офіційних доменах (`facebook.com/business`, `developers.facebook.com`, `about.fb.com`, `transparency.meta.com`, `support.google.com`) і звіркою ключових тверджень з текстом офіційних сторінок у результатах пошуку. Повні сторінки Help Center у браузері не відкривались.
- Статуси:
  - **Verified** — ключове твердження підтверджене офіційною сторінкою Meta/Google;
  - **Partially Verified** — офіційне джерело є, але деталі (дати, пороги, вигляд інтерфейсу, доступність у конкретному акаунті) підтверджені частково;
  - **Needs Review** — офіційного підтвердження не знайдено; у симуляторі позначено як таке, що потребує перевірки;
  - **Deprecated** — функцію прибрано.
- Нічого не додано як «оновлення 2026» без джерела. Інтерфейс реальних акаунтів відрізняється між країнами, типами кампаній і хвилями розгортання — звіряйтесь зі своїм кабінетом.

## Зміни, враховані в симуляторі

### 2026

| Дата / період | Зміна | Статус | Джерело | Як відображено в симуляторі |
|---|---|---|---|---|
| березень 2026 (поетапно) | Click-through атрибуція рахує лише кліки за посиланням; інші взаємодії й перегляд відео ≥ 5 с — engage-through (раніше engaged-view, поріг був 10 с) | Partially Verified | [Simplifying Ad Measurement for a Social-First World](https://www.facebook.com/business/news/click-attribution); [About attribution models and settings](https://www.facebook.com/business/help/460276478298895) | Налаштування атрибуції набору: click 1/7 днів + 1-day engage-through + 1-day view; порівняння вікон в Analytics |
| 12.01.2026 | Вікна 7-day view та 28-day view прибрано з Ads Insights API | Deprecated | Сторонні джерела; офіційна сторінка атрибуції вже не містить цих вікон | Не пропонуються як налаштування |

### 2025

| Дата / період | Зміна | Статус | Джерело | Як відображено |
|---|---|---|---|---|
| 2025 | Спрощене налаштування Advantage+ для Sales, App і Leads; Advantage+ Shopping → Advantage+ sales; для Leads «Advantage+ on» за замовчуванням, звуження → «Advantage+ off» | Partially Verified | [Advantage+ sales campaigns](https://www.facebook.com/business/ads/meta-advantage-plus/sales-campaigns), [Advantage+ leads campaigns](https://www.facebook.com/business/ads/meta-advantage-plus/leads) | Тип налаштування кампанії «Advantage+ campaign setup» для Sales/Leads/App; вимкнення Advantage+ audience/placements переводить кампанію на ручне налаштування |
| 31.03.2025 | Виключення detailed targeting прибрано з наявних кампаній (з нових — з 2024) | Deprecated | Кілька незалежних джерел ([приклад](https://www.jonloomer.com/qvt/detailed-targeting-exclusions/)) | Виключати можна лише custom-аудиторії |
| 2025 | Ad set budget sharing — передача до 20% бюджету між наборами | Partially Verified | Сторонні джерела з цитатою інтерфейсу | Перемикач у кампанії з бюджетом на рівні наборів |
| 02.09.2025 | Проактивні обмеження custom conversions / аудиторій, що натякають на стан здоров'я чи фінанси | Partially Verified | [Conversion Tracking — Meta for Developers](https://developers.facebook.com/docs/meta-pixel/implementation/conversion-tracking) | Прапорець «чутлива аудиторія», чутливі інтереси → попередження/помилки валідації |
| 07.2025, оновлено 06.10.2025 | Meta припинила рекламу про соціальні питання, вибори й політику в ЄС (TTPA) | Verified | [Meta Newsroom](https://about.fb.com/news/2025/07/ending-political-electoral-and-social-issue-advertising-in-the-eu/) | Перевірка оголошень відхиляє SIEP-рекламу з таргетингом на ЄС |
| з 2024–2025 | Категорію Credit замінено на Financial products and services | Verified | [How to choose a Special Ad Category](https://www.facebook.com/business/help/298000447747885) | Спецкатегорії: Financial products and services, Employment, Housing, SIEP |

### Стабільні механіки, підтверджені на дату перевірки

| Механіка | Статус | Джерело |
|---|---|---|
| Шість цілей кампаній (ODAX) | Verified | [Ad objectives](https://www.facebook.com/business/ads/ad-objectives) |
| Advantage+ audience: suggestions vs audience controls | Verified | [About Advantage+ audience](https://www.facebook.com/business/help/273363992030035) |
| Advantage+ placements | Verified | [Advantage+ placements](https://www.facebook.com/business/ads/meta-advantage-plus/placements) |
| Навчальна фаза ≈ 50 подій за 7 днів; Learning limited; суттєві редагування | Verified (поріг бюджету 20% у симуляторі — припущення) | [About the learning phase](https://www.facebook.com/business/help/112167992830700), [Learning limited](https://www.facebook.com/business/help/269269737396981), [Last significant edit](https://www.facebook.com/business/help/942374239243867) |
| Дедуплікація Pixel + CAPI: event_id + event_name, 48 год, не діє всередині одного джерела | Verified | [Meta for Developers](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events) |
| A/B тести й Experiments | Verified | [About A/B testing](https://www.facebook.com/business/help/1738164643098669) |
| Opportunity score (не гарантує результату) | Verified (у симуляторі не відтворюється) | [About Opportunity Score](https://www.facebook.com/business/help/804913634782260) |
| UTM для GA4: хоча б один параметр, (not set) для відсутніх, чутливість до регістру | Verified | [GA4 URL builders](https://support.google.com/analytics/answer/10917952) |
| Incremental attribution / incremental results (оцінкова метрика) | Partially Verified | [About Incremental Attribution](https://www.facebook.com/business/help/2366718460372682) |

### Потребує перевірки (Needs Review)

| Функція | Чому | Як позначено |
|---|---|---|
| Плейсмент Threads | Офіційного підтвердження доступності для навчального ринку не знайдено | Бейдж «Needs Review» у ручних плейсментах |
| Ліміт 8 пріоритетних подій AEM на домен | Довідка без дати; є неофіційні повідомлення про зміни 2025 р. | Не моделюється як обмеження; згадано в статті Events Manager |
| Синтаксис динамічних URL-параметрів (`{{campaign.name}}` тощо) | Офіційну сторінку не знайдено | Шаблон UTM подано як приклад із приміткою |

## Як оновлювати

1. Перевірити функцію в офіційному джерелі (порядок пріоритету вище).
2. Оновити запис у `src/content/feature-registry.ts` (`availability_status`, `verified_at`, `source_url`, `version_notes`).
3. Оновити пов'язані статті (`lastReviewed`, `sources`, `status`) у `src/content/knowledge/*`.
4. Якщо змінюється поведінка — оновити модель (`src/simulation/*`) і тести.
5. Додати рядок у цей файл.
