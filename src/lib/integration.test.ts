/**
 * Integrationstest gegen eine echte Postgres-Datenbank (Migrationen müssen angewendet sein).
 *   TEST_DATABASE_URL=postgresql://… npm test
 * Ohne TEST_DATABASE_URL wird er übersprungen.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("Ablauf einer Wichtelaktion (DB)", () => {
  type Mods = {
    db: typeof import("./db").db;
    a: typeof import("./data/assignments");
    p: typeof import("./participation");
    jobs: typeof import("../worker/jobs");
  };
  let m: Mods;
  let orgId = "";
  let campaignId = "";
  const participants: { id: string; email: string; dept: string }[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    const [{ db }, a, p, jobs] = await Promise.all([import("./db"), import("./data/assignments"), import("./participation"), import("../worker/jobs")]);
    m = { db, a, p, jobs };

    const org = await db.organization.create({ data: { name: `Test ${Date.now()}`, plan: "team" } });
    orgId = org.id;
    const c = await db.campaign.create({
      data: {
        organizationId: orgId,
        title: "Testwichteln",
        budgetCents: 2000,
        mode: "shipping",
        tier: "team",
        status: "open",
        excludeSameDepartment: true,
        signupDeadline: new Date(Date.now() + 86_400_000),
        drawAt: new Date(Date.now() + 2 * 86_400_000),
        revealAt: new Date(Date.now() + 10 * 86_400_000),
      },
    });
    campaignId = c.id;
    for (let i = 0; i < 12; i++) {
      const email = `t${i}-${Date.now()}@test.at`;
      const dept = `d${i % 4}`;
      const user = await db.user.create({ data: { email, name: `Person ${i}`, department: dept, organizationId: orgId } });
      const part = await db.participant.create({ data: { campaignId, userId: user.id, status: "joined", joinedAt: new Date() } });
      participants.push({ id: part.id, email, dept });
    }
  });

  afterAll(async () => {
    if (orgId) await m.db.organization.delete({ where: { id: orgId } });
    await m.db.$disconnect();
  });

  it("zieht einen gültigen Zyklus ohne gleiche Abteilung", async () => {
    const res = await m.a.runDraw(campaignId);
    expect(res).toEqual({ ok: true, count: 12 });

    const dept = new Map(participants.map((p) => [p.id, p.dept]));
    const receivers = new Set<string>();
    for (const p of participants) {
      const mine = await m.a.getMyReceiver(p.id);
      expect(mine).not.toBeNull();
      const target = participants.find((x) => mine!.name === `Person ${participants.indexOf(x)}`)!;
      expect(dept.get(target.id)).not.toBe(p.dept);
      expect(target.id).not.toBe(p.id);
      receivers.add(target.id);
    }
    expect(receivers.size).toBe(12);
    expect((await m.db.campaign.findUniqueOrThrow({ where: { id: campaignId } })).status).toBe("drawn");
  });

  it("verrät dem Admin die Zuordnung nicht und blendet Adressen nur dem Wichtel ein", async () => {
    const a = participants[0];
    const mine = await m.a.getMyReceiver(a.id);
    expect(mine!.shippingAddress).toBeNull();
    const target = participants.find((x) => mine!.name === `Person ${participants.indexOf(x)}`)!;
    const { encrypt } = await import("./crypto");
    await m.db.participant.update({ where: { id: target.id }, data: { shippingAddressEnc: encrypt("Musterweg 1, 1010 Wien") } });
    expect((await m.a.getMyReceiver(a.id))!.shippingAddress).toBe("Musterweg 1, 1010 Wien");
    // Vor dem Reveal gibt es für niemanden aufgedeckte Paare.
    expect((await m.a.listRevealed(campaignId)).pairs).toHaveLength(0);
  });

  it("Chat ist anonym und nur zwischen den beiden Beteiligten", async () => {
    const giver = participants[0];
    const sent = await m.a.sendChatMessage(giver.id, "giver", "Hallo, Größe?");
    expect(sent?.notify).toBe(true);
    const mine = await m.a.getMyReceiver(giver.id);
    const receiver = participants.find((x) => mine!.name === `Person ${participants.indexOf(x)}`)!;
    const chat = await m.a.getChat(receiver.id, "receiver");
    expect(chat!.messages.map((x) => [x.mine, x.body])).toEqual([[false, "Hallo, Größe?"]]);
    // Zweite Nachricht ohne Lesen löst keine weitere Mail aus.
    expect((await m.a.sendChatMessage(giver.id, "giver", "Noch da?"))?.notify).toBe(false);
  });

  it("fügt Nachzügler regelkonform ein", async () => {
    const user = await m.db.user.create({ data: { email: `late-${Date.now()}@test.at`, name: "Nachzügler", department: "extra", organizationId: orgId } });
    const res = await m.p.confirmParticipation(user.id, campaignId);
    expect(res).toEqual({ ok: true, late: true });
    const part = await m.db.participant.findUniqueOrThrow({ where: { campaignId_userId: { campaignId, userId: user.id } } });
    expect(await m.a.getMyReceiver(part.id)).not.toBeNull();
    expect(await m.a.countAssignments(campaignId)).toBe(13);
  });

  it("Reveal deckt Paare schrittweise auf, Abschluss löscht personenbezogene Daten", async () => {
    await m.jobs.startReveal(campaignId, { all: false });
    expect((await m.a.listRevealed(campaignId)).pairs).toHaveLength(0);
    await m.a.revealNext(campaignId);
    const r = await m.a.listRevealed(campaignId);
    expect(r.pairs).toHaveLength(1);
    expect(r.total).toBe(13);

    await m.jobs.purgeCampaign(campaignId);
    expect(await m.db.participant.count({ where: { campaignId } })).toBe(0);
    expect(await m.a.countAssignments(campaignId)).toBe(0);
    expect(await m.db.message.count({ where: { assignment: { campaignId } } })).toBe(0);
    expect(await m.db.previousPair.count({ where: { organizationId: orgId } })).toBe(13);
    const pair = await m.db.previousPair.findFirstOrThrow({ where: { organizationId: orgId } });
    expect(pair.giverHash).toMatch(/^[0-9a-f]{64}$/);
    expect((await m.db.campaign.findUniqueOrThrow({ where: { id: campaignId } })).status).toBe("closed");
  });
});
