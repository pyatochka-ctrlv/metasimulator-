import { countryByCode, interestById } from "@/domain/catalog";
import type { AdAccount, Ad, AdSet, Campaign } from "@/domain/types";

/**
 * Симуляція перевірки оголошення (ad review) за навчальними правилами,
 * натхненними Advertising Standards. Це спрощена модель: реальна перевірка Meta
 * комбінує автоматичні та ручні механізми й може відрізнятися.
 */

export interface ReviewFinding {
  code: string;
  severity: "reject" | "limit" | "info";
  message: string;
  articleSlug: string;
}

/** Межі слова для кирилиці: \b і \w у JS працюють лише з ASCII, тому використовуємо Unicode-класи. */
const L = "\\p{L}";
const word = (body: string) => new RegExp(`(?<![${L}])(?:${body})`, "iu");

const RULES: { code: string; test: RegExp; message: string; articleSlug: string }[] = [
  {
    code: "unrealistic_claims",
    test: word(`гарант[${L}]*\\s+(?:дохід|доход|заробіт|результат|працевлаштуван|прибут|роботу)|100\\s?%\\s*(?:результат|гарант)|(?:заробиш|заробляй|заробіть)\\s+\\$?\\d+`),
    message: "Нереалістичні або оманливі обіцянки результату (дохід, гарантоване працевлаштування).",
    articleSlug: "advertising-standards",
  },
  {
    code: "personal_attributes",
    test: word(`(?:ти|ви)\\s+(?:страждаєш|страждаєте|маєш борги|маєте борги|маєш зайву|маєте зайву|самотн[${L}]*|в депресії)|ваша\\s+(?:вага|депресія|хвороба)`),
    message: "Звернення до персональних атрибутів (здоров'я, фінансовий стан, вага тощо) у формі «Ви …».",
    articleSlug: "advertising-standards",
  },
  {
    code: "before_after",
    test: word(`до\\s*(?:і|та)\\s*після[\\s\\S]*(?:схуд|кг)|мінус\\s*\\d+\\s*кг`),
    message: "Порівняння «до/після» або обіцянки щодо схуднення — обмежена категорія.",
    articleSlug: "advertising-standards",
  },
];

const SPECIAL_HINTS: { category: Campaign["specialAdCategories"][number]; test: RegExp }[] = [
  { category: "financial_products_services", test: word(`кредит|позик|розстрочк|кредитн[${L}]* карт|страхуванн|інвестиційн[${L}]* рахун`) },
  { category: "employment", test: word(`ваканс|шукаємо співробітник|робота для|зарплата від`) },
  { category: "housing", test: word(`оренд[${L}]* квартир|продаж квартир|іпотек|новобудов`) },
];

export function reviewAd(ad: Ad, adSet: AdSet, campaign: Campaign, account: AdAccount): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const c = ad.creative;
  const text = `${c.primaryText}\n${c.headline}\n${c.description}`;

  for (const r of RULES) {
    if (r.test.test(text)) findings.push({ code: r.code, severity: "reject", message: r.message, articleSlug: r.articleSlug });
  }

  for (const h of SPECIAL_HINTS) {
    if (h.test.test(text) && !campaign.specialAdCategories.includes(h.category)) {
      findings.push({
        code: "special_category_missing",
        severity: "reject",
        message: `Схоже, оголошення належить до спеціальної категорії (${h.category}), але її не оголошено на рівні кампанії.`,
        articleSlug: "special-ad-categories",
      });
      break;
    }
  }

  if (campaign.specialAdCategories.includes("social_issues_elections_politics")) {
    const euTargets = adSet.audience.locations.filter((l) => countryByCode(l.country)?.eu);
    if (euTargets.length) {
      findings.push({
        code: "siep_eu",
        severity: "reject",
        message: "Оголошення про соціальні питання, вибори чи політику не показуються в ЄС (рішення Meta з жовтня 2025).",
        articleSlug: "special-ad-categories",
      });
    } else {
      findings.push({
        code: "siep_authorization",
        severity: "reject",
        message: "Для реклами про соціальні питання/вибори/політику потрібна авторизація рекламодавця та дисклеймер. У навчальному акаунті авторизації немає.",
        articleSlug: "special-ad-categories",
      });
    }
  }

  // Посадкова сторінка
  const url = c.destinationUrl.trim();
  const needsUrl = adSet.conversionLocation === "website" || adSet.conversionLocation === "website_and_app" || adSet.conversionLocation === "website_and_instant_forms";
  if (needsUrl) {
    let host = "";
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
    if (!host) {
      findings.push({ code: "invalid_url", severity: "reject", message: "Некоректний URL посадкової сторінки.", articleSlug: "utm-ga4" });
    } else if (host !== account.landingPage.domain.replace(/^www\./, "")) {
      findings.push({
        code: "non_functional_landing",
        severity: "reject",
        message: `Посадкова сторінка ${host} недоступна (у симуляторі існує лише ${account.landingPage.domain}). Non-functional landing page.`,
        articleSlug: "diagnostics-playbook",
      });
    }
  }

  if (adSet.conversionLocation === "instant_forms" || adSet.conversionLocation === "website_and_instant_forms") {
    if (!c.instantForm || !c.instantForm.privacyPolicyUrl.trim()) {
      findings.push({ code: "lead_form_privacy", severity: "reject", message: "Миттєва форма без посилання на політику конфіденційності.", articleSlug: "lead-generation" });
    }
  }

  const sensitive = adSet.audience.detailedTargeting.map(interestById).filter((i) => i?.sensitive);
  if (sensitive.length) {
    findings.push({
      code: "sensitive_targeting",
      severity: "limit",
      message: "Набір використовує чутливий інтерес. Такі параметри можуть бути недоступні або обмежувати доставку.",
      articleSlug: "advertising-standards",
    });
  }

  if (/!!!|[A-ZА-ЯІЇЄҐ]{12,}/u.test(text)) {
    findings.push({ code: "low_quality_text", severity: "info", message: "Надмірні великі літери чи знаки оклику знижують якість оголошення.", articleSlug: "creative-strategy" });
  }

  return findings;
}

export function reviewOutcome(findings: ReviewFinding[]): "approved" | "rejected" {
  return findings.some((f) => f.severity === "reject") ? "rejected" : "approved";
}
