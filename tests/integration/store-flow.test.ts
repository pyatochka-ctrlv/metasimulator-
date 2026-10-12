import { libMedia } from "@/domain/account-builder";
import { makeAd, makeAdSet, makeCampaign, RECOMMENDED_UTM } from "@/domain/factories";
import { addAd, addAdSet, addCampaign, publishCampaign } from "@/domain/operations";
import { SANDBOX_ACCOUNT_ID } from "@/content/sandbox";
import { debouncedLocalStorage, flushStorageNow } from "@/persistence/storage";
import { STORAGE_KEY, useAppStore } from "@/store/app-store";

describe("store: end-to-end learning flow", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetAll();
  });

  it("initializes the sandbox with an example campaign and history", () => {
    const s = useAppStore.getState();
    const sandbox = s.accounts[SANDBOX_ACCOUNT_ID];
    expect(sandbox).toBeDefined();
    expect(sandbox.campaigns.length).toBe(1);
    expect(sandbox.simDay).toBe(7);
    expect(s.activeAccountId).toBe(SANDBOX_ACCOUNT_ID);
  });

  it("creates, publishes and simulates a campaign in the sandbox", () => {
    const { mutateAccount, simulate } = useAppStore.getState();
    mutateAccount(SANDBOX_ACCOUNT_ID, (acc) => {
      const [c, a1] = makeCampaign(acc, "leads", { name: "Flow test", budgetAmount: 20 });
      let a = addCampaign(a1, c);
      const [s, a2] = makeAdSet(a, c, { name: "Set", conversionLocation: "website", performanceGoal: "conversions", optimizationEvent: "Lead" });
      a = addAdSet(a2, s);
      const [ad, a3] = makeAd(a, s, {
        name: "Ad",
        creative: { ...a.ads[0].creative, media: [libMedia("edu_reel_916")], urlParameters: RECOMMENDED_UTM, destinationUrl: a.landingPage.url },
      });
      a = addAd(a3, ad);
      return publishCampaign(a, c.id).account;
    });
    const res = simulate(SANDBOX_ACCOUNT_ID, 7);
    expect(res).not.toBeNull();
    expect(res!.reviewed.approved).toBe(1);
    const sandbox = useAppStore.getState().accounts[SANDBOX_ACCOUNT_ID];
    const flow = sandbox.campaigns.find((c) => c.name === "Flow test")!;
    expect(sandbox.metrics.some((m) => m.campaignId === flow.id && m.spend > 0)).toBe(true);
  });

  it("persists progress to localStorage and restores it after reload", async () => {
    useAppStore.getState().setProfile({ displayName: "Олена" });
    useAppStore.getState().markArticleRead("attribution");
    useAppStore.getState().simulate(SANDBOX_ACCOUNT_ID, 1);
    flushStorageNow();
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.profile.displayName).toBe("Олена");
    // Імітуємо перезавантаження: стан у пам'яті втрачено, у сховищі лишився збережений знімок.
    useAppStore.setState({ profile: { ...useAppStore.getState().profile, displayName: "—" }, learning: { ...useAppStore.getState().learning, readArticles: [] } });
    debouncedLocalStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, raw!);
    await useAppStore.persist.rehydrate();
    const s = useAppStore.getState();
    expect(s.profile.displayName).toBe("Олена");
    expect(s.learning.readArticles).toContain("attribution");
    expect(s.accounts[SANDBOX_ACCOUNT_ID].simDay).toBe(8);
  });

  it("runs a mission attempt end-to-end and allows a retry with a new account", () => {
    const st = useAppStore.getState();
    const attemptId = st.startMission("m09");
    const attempt = useAppStore.getState().missionAttempts[attemptId];
    expect(useAppStore.getState().activeAccountId).toBe(attempt.accountId);
    const acc = useAppStore.getState().accounts[attempt.accountId];
    expect(acc.simDay).toBe(7);
    expect(acc.seededSeq).toBeGreaterThan(0);
    useAppStore.getState().simulate(attempt.accountId, 5);
    const submitted = useAppStore.getState().submitMission(attemptId, [{ questionId: "q1", selected: ["a", "b", "c"], confidence: 2 }], {
      strategy: "Нові креативи 9:16",
      hypotheses: "",
      testing: "",
      analysis: "CTR",
      nextSteps: "",
      conclusions: "",
    });
    expect(submitted?.status).toBe("submitted");
    expect(submitted?.assessment?.total).toBeGreaterThanOrEqual(0);
    expect(submitted?.snapshot?.campaigns.length).toBeGreaterThan(0);
    expect(useAppStore.getState().accounts[attempt.accountId].readOnly).toBe(true);
    // Read-only акаунт не змінюється симуляцією
    expect(useAppStore.getState().simulate(attempt.accountId, 1)).toBeNull();
    const retry = useAppStore.getState().startMission("m09");
    expect(retry).not.toBe(attemptId);
    expect(useAppStore.getState().missionAttempts[retry].accountId).not.toBe(attempt.accountId);
  });

  it("opens an error lab case as a read-only account", () => {
    const id = useAppStore.getState().openErrorLabCase("e03");
    const acc = useAppStore.getState().accounts[id];
    expect(acc.readOnly).toBe(true);
    expect(acc.kind).toBe("error_lab");
    const att = useAppStore.getState().submitErrorLab({ caseId: "e03", accountId: id, selectedCauses: ["lead_missing"], checkedEvidence: ["events", "crm"], confidence: 3, explanation: "Подія Lead не спрацьовує після оновлення сайту" });
    expect(att!.score).toBeGreaterThan(60);
  });
});
