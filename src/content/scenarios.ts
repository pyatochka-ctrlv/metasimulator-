import { buildCampaign, libMedia, runHistory } from "@/domain/account-builder";
import { RECOMMENDED_UTM } from "@/domain/factories";
import { updateAdSet } from "@/domain/operations";
import type { AdAccount, AudienceTargeting, CountryCode } from "@/domain/types";

/**
 * Сценарії з історичними даними. Кожна функція додає кампанії до акаунта
 * та прокручує симуляцію, щоб створити реалістичні «симптоми».
 */

export const UTM = RECOMMENDED_UTM;

export function broad(country: CountryCode = "UA", patch: Partial<AudienceTargeting> = {}): AudienceTargeting {
  return {
    locations: [{ country }],
    ageMin: 18,
    ageMax: 65,
    genders: "all",
    languages: [],
    detailedTargeting: [],
    includedAudienceIds: [],
    excludedAudienceIds: [],
    advantageAudience: true,
    minAgeControl: 18,
    ...patch,
  };
}

export function manual(patch: Partial<AudienceTargeting>): AudienceTargeting {
  return broad("UA", { advantageAudience: false, ...patch });
}

/** «Глина»: проспектинг на покупки (база для ретаргетингу, аудиту, звіту). */
export function glynaProspecting(acc: AdAccount, opts: { budget?: number; name?: string } = {}): AdAccount {
  return buildCampaign(acc, {
    objective: "sales",
    campaign: { name: opts.name ?? "Prospecting · Sales · Broad", budgetLevel: "campaign", budgetAmount: opts.budget ?? 60, bidStrategy: "highest_volume" },
    adSets: [
      {
        adSet: {
          name: "UA · Advantage+ audience",
          conversionLocation: "website",
          performanceGoal: "conversions",
          optimizationEvent: "Purchase",
          audience: broad("UA", { excludedAudienceIds: ["aud_gl_buyers"], ageMin: 25, ageMax: 55 }),
        },
        ads: [
          {
            name: "UGC · відгук після місяця",
            creative: {
              media: [libMedia("shop_ugc_916")],
              primaryText: "Чашки ручної роботи, які тримають тепло і настрій. Кераміка «Глина» — посуд, що робить ранок особливим. Доставка по Україні.",
              headline: "Кераміка ручної роботи",
              cta: "SHOP_NOW",
              urlParameters: UTM,
            },
          },
          {
            name: "Lifestyle · сніданок",
            creative: {
              media: [libMedia("shop_lifestyle_45")],
              primaryText: "Посуд ручної роботи для повільних сніданків. Кожна чашка — унікальна. Обирайте свій набір з доставкою.",
              headline: "Набори посуду",
              cta: "SHOP_NOW",
              urlParameters: UTM,
            },
          },
          {
            name: "Каталог · товар на білому",
            creative: {
              media: [libMedia("shop_product_square")],
              primaryText: "Нова колекція керамічних чашок і тарілок. Ручна робота, безпечна глазур, доставка.",
              headline: "Нова колекція",
              cta: "SHOP_NOW",
              urlParameters: UTM,
            },
          },
        ],
      },
    ],
  });
}

/** Місія 7: одна «вигоріла» кампанія з частими змінами бюджету. */
export function fatigueScenario(acc: AdAccount): AdAccount {
  let a = buildCampaign(acc, {
    objective: "leads",
    campaign: { name: "Ліди · Консультація UX/UI", budgetLevel: "ad_set", bidStrategy: "highest_volume" },
    adSets: [
      {
        adSet: {
          name: "Київ 15 км · 22–35 · Дизайн+Кар'єра",
          conversionLocation: "website",
          performanceGoal: "conversions",
          optimizationEvent: "Lead",
          budgetAmount: 35,
          audience: manual({ locations: [{ country: "UA", city: "Київ", radiusKm: 15 }], ageMin: 22, ageMax: 35, detailedTargeting: ["int_design", "int_career"] }),
          placements: { mode: "advantage", selected: [] },
        },
        ads: [
          {
            name: "Кейс студента · єдиний креатив",
            creative: {
              media: [libMedia("edu_results_45")],
              primaryText: "Як Олена змінила професію за 7 місяців: від адміністратора до UX/UI дизайнерки. Запишіться на безкоштовну консультацію і отримайте план навчання.",
              headline: "Безкоштовна консультація",
              cta: "SIGN_UP",
              urlParameters: UTM,
            },
          },
        ],
      },
    ],
  });
  a = runHistory(a, 14);
  const setId = a.adSets[0].id;
  a = updateAdSet(a, setId, { budgetAmount: 55 });
  a = runHistory(a, 2);
  a = updateAdSet(a, setId, { budgetAmount: 30 });
  a = runHistory(a, 2);
  a = updateAdSet(a, setId, { budgetAmount: 45 });
  a = runHistory(a, 1);
  a = updateAdSet(a, setId, { budgetAmount: 35 });
  return runHistory(a, 2);
}

/** Місія 8: дорогий лід — оптимізація на LPV, 5 дрібних наборів з перетином. */
export function expensiveLeadScenario(acc: AdAccount): AdAccount {
  const sets: { name: string; interests: string[]; ageMin: number; ageMax: number }[] = [
    { name: "Англійська + Подорожі · 41–60", interests: ["int_english", "int_travel"], ageMin: 41, ageMax: 60 },
    { name: "Англійська + Кар'єра · 30–50", interests: ["int_english", "int_career"], ageMin: 30, ageMax: 50 },
    { name: "Англійська + IT · 41–55", interests: ["int_english", "int_it"], ageMin: 41, ageMax: 55 },
    { name: "Англійська + Фітнес · 45–60", interests: ["int_english", "int_fitness"], ageMin: 45, ageMax: 60 },
    { name: "Англійська · 41–55", interests: ["int_english"], ageMin: 41, ageMax: 55 },
  ];
  const a = buildCampaign(acc, {
    objective: "leads",
    campaign: { name: "Ліди · Пробний урок (стара структура)", budgetLevel: "ad_set", bidStrategy: "highest_volume" },
    adSets: sets.map((s) => ({
      adSet: {
        name: s.name,
        conversionLocation: "website" as const,
        performanceGoal: "landing_page_views" as const,
        optimizationEvent: null,
        budgetAmount: 6,
        audience: manual({ ageMin: s.ageMin, ageMax: s.ageMax, detailedTargeting: s.interests }),
        placements: { mode: "manual" as const, selected: ["facebook_feed" as const, "instagram_feed" as const] },
      },
      ads: [
        {
          name: `Пробний урок · ${s.name.split(" ·")[0]}`,
          creative: {
            media: [libMedia("edu_mentor_square")],
            primaryText: "Заговоріть англійською без страху. Запишіться на безкоштовний пробний урок з викладачем — визначимо рівень і складемо план.",
            headline: "Пробний урок англійської",
            cta: "SIGN_UP" as const,
            urlParameters: UTM,
          },
        },
      ],
    })),
  });
  return runHistory(a, 14);
}

/** Місія 9 / Error Lab: низький CTR через креатив і формати. */
export function lowCtrScenario(acc: AdAccount): AdAccount {
  const a = buildCampaign(acc, {
    objective: "traffic",
    campaign: { name: "Трафік · Курс Excel (Stories/Reels)", budgetLevel: "campaign", budgetAmount: 20 },
    adSets: [
      {
        adSet: {
          name: "UA · 22–45 · Stories & Reels",
          conversionLocation: "website",
          performanceGoal: "landing_page_views",
          audience: broad("UA", { ageMin: 22, ageMax: 45 }),
          placements: { mode: "manual", selected: ["facebook_stories", "instagram_stories", "facebook_reels", "instagram_reels"] },
        },
        ads: [
          {
            name: "Банер ЗНИЖКА",
            creative: {
              media: [libMedia("generic_text_square")],
              primaryText: "ЗНИЖКА!!! ТІЛЬКИ СЬОГОДНІ!!! КУПУЙ КУРС ЗАРАЗ!!!",
              headline: "",
              cta: "WATCH_MORE",
              urlParameters: UTM,
            },
          },
          {
            name: "Запис вебінару 16:9",
            creative: {
              media: [libMedia("edu_webinar_169")],
              primaryText:
                "Ми підготували для вас повний запис нашого вебінару, на якому протягом півтори години розбираємо всі можливості програми, починаючи з історії створення табличних процесорів, налаштувань інтерфейсу, гарячих клавіш, різних форматів даних, і закінчуючи окремими прикладами формул. Дивіться повністю, щоб нічого не пропустити, а наприкінці на вас чекає спеціальна пропозиція для учасників вебінару, яку ми розповімо лише тим, хто додивиться до кінця. Також у записі ви знайдете відповіді на запитання учасників та багато іншої корисної інформації про роботу з таблицями й звітами для щоденної роботи аналітика.",
              headline: "Вебінар про Excel повністю — 95 хвилин корисної інформації",
              cta: "WATCH_MORE",
              urlParameters: UTM,
            },
          },
        ],
      },
    ],
  });
  return runHistory(a, 7);
}

/** Місія 11: 4 кампанії з різною ефективністю, загальний бюджет $100. */
export function budgetScenario(acc: AdAccount): AdAccount {
  const ad = (name: string, key: string) => ({
    name,
    creative: {
      media: [libMedia(key)],
      primaryText: "Безкоштовний пробний урок англійської: визначимо рівень, складемо план, перша розмовна практика з викладачем.",
      headline: "Пробний урок англійської",
      cta: "SIGN_UP" as const,
      urlParameters: UTM,
    },
  });
  let a = buildCampaign(acc, {
    objective: "leads",
    campaign: { name: "A · Broad · Advantage+ audience", budgetLevel: "campaign", budgetAmount: 25 },
    adSets: [{ adSet: { name: "UA · Advantage+", conversionLocation: "website", performanceGoal: "conversions", optimizationEvent: "Lead", audience: broad("UA", { excludedAudienceIds: ["aud_sp_students"] }) }, ads: [ad("Відео · урок 30с", "edu_reel_916"), ad("Ментор", "edu_mentor_square")] }],
  });
  a = buildCampaign(a, {
    objective: "leads",
    campaign: { name: "B · Lookalike 1% студентів", budgetLevel: "campaign", budgetAmount: 25 },
    adSets: [
      {
        adSet: { name: "LAL 1% · UA", conversionLocation: "website", performanceGoal: "conversions", optimizationEvent: "Lead", audience: manual({ includedAudienceIds: ["aud_sp_lal"], excludedAudienceIds: ["aud_sp_students"] }) },
        ads: [ad("Кейс студента", "edu_results_45")],
      },
    ],
  });
  a = buildCampaign(a, {
    objective: "leads",
    campaign: { name: "C · Вузькі інтереси", budgetLevel: "campaign", budgetAmount: 25 },
    adSets: [
      {
        adSet: { name: "Англійська+IT · 25–34", conversionLocation: "website", performanceGoal: "conversions", optimizationEvent: "Lead", audience: manual({ ageMin: 25, ageMax: 34, detailedTargeting: ["int_english", "int_productivity"], locations: [{ country: "UA", city: "Київ", radiusKm: 20 }] }) },
        ads: [ad("Ментор · квадрат", "edu_mentor_square")],
      },
    ],
  });
  a = buildCampaign(a, {
    objective: "traffic",
    campaign: { name: "D · Кліки · Audience Network", budgetLevel: "campaign", budgetAmount: 25 },
    adSets: [
      {
        adSet: { name: "AN only · link clicks", conversionLocation: "website", performanceGoal: "link_clicks", audience: broad("UA"), placements: { mode: "manual", selected: ["audience_network"] } },
        ads: [ad("Банер", "generic_text_square")],
      },
    ],
  });
  return runHistory(a, 14);
}

/** Місія 12: акаунт з багатьма проблемами для аудиту. */
export function auditScenario(acc: AdAccount): AdAccount {
  const cr = (name: string, key: string, utm = "") => ({
    name,
    creative: {
      media: [libMedia(key)],
      primaryText: "Кераміка ручної роботи для дому та подарунків. Доставка по Україні та Польщі.",
      headline: "Кераміка «Глина»",
      cta: "SHOP_NOW" as const,
      urlParameters: utm,
    },
  });
  let a = buildCampaign(acc, {
    objective: "traffic",
    campaign: { name: "Sales via Traffic · кліки", budgetLevel: "campaign", budgetAmount: 20 },
    adSets: [
      {
        adSet: { name: "PL+UA · кліки · AN+Feed", conversionLocation: "website", performanceGoal: "link_clicks", audience: broad("UA", { locations: [{ country: "UA" }, { country: "PL" }] }), placements: { mode: "manual", selected: ["audience_network", "facebook_feed"] } },
        ads: [cr("Банер знижки", "generic_text_square"), cr("Товар", "shop_product_square")],
      },
    ],
  });
  const interestSets = [
    ["Декор", ["int_home_decor"]],
    ["Кава", ["int_coffee"]],
    ["Шопінг", ["int_online_shopping"]],
    ["Мода", ["int_fashion"]],
  ] as const;
  a = buildCampaign(a, {
    objective: "sales",
    campaign: { name: "Conversions · ViewContent · 4 інтереси", budgetLevel: "ad_set" },
    adSets: interestSets.map(([n, ints]) => ({
      adSet: {
        name: `Інтерес: ${n}`,
        conversionLocation: "website" as const,
        performanceGoal: "conversions" as const,
        optimizationEvent: "ViewContent" as const,
        budgetAmount: 8,
        audience: manual({ ageMin: 25, ageMax: 45, detailedTargeting: [...ints], locations: [{ country: "UA" }, { country: "PL" }] }),
      },
      ads: [cr(`Lifestyle · ${n}`, "shop_lifestyle_45")],
    })),
  });
  a = buildCampaign(a, {
    objective: "sales",
    campaign: { name: "Retargeting (Advantage+ audience)", budgetLevel: "campaign", budgetAmount: 15 },
    adSets: [
      {
        adSet: { name: "Відвідувачі 30д · A+ audience увімкнено", conversionLocation: "website", performanceGoal: "conversions", optimizationEvent: "Purchase", audience: broad("UA", { includedAudienceIds: ["aud_gl_site"] }) },
        ads: [cr("Нагадування", "shop_ugc_916")],
      },
    ],
  });
  return runHistory(a, 14);
}

/** Звичайна кампанія лідів на сайт без UTM (для розбіжностей Meta vs CRM). */
export function leadsNoUtmScenario(acc: AdAccount, days = 14): AdAccount {
  const a = buildCampaign(acc, {
    objective: "leads",
    campaign: { name: "Ліди · Консультація (сайт)", budgetLevel: "campaign", budgetAmount: 40 },
    adSets: [
      {
        adSet: { name: "UA · Advantage+ audience", conversionLocation: "website", performanceGoal: "conversions", optimizationEvent: "Lead", audience: broad("UA") },
        ads: [
          {
            name: "Відео · кар'єра в дизайні",
            creative: {
              media: [libMedia("edu_reel_916")],
              primaryText: "Безкоштовна консультація: розкажемо, як увійти в UX/UI дизайн і зібрати портфоліо за 6 місяців.",
              headline: "Консультація з кар'єри в UX/UI",
              cta: "SIGN_UP",
              urlParameters: "",
            },
          },
          {
            name: "Кейс студентки",
            creative: {
              media: [libMedia("edu_results_45")],
              primaryText: "Портфоліо, ментор і підтримка до працевлаштування. Запишіться на консультацію з кар'єрним консультантом.",
              headline: "Безкоштовна консультація",
              cta: "SIGN_UP",
              urlParameters: "",
            },
          },
        ],
      },
    ],
  });
  return runHistory(a, days);
}
