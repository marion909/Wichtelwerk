/**
 * Schaltet das Paket einer Firma manuell um (z. B. Enterprise nach Vertragsabschluss).
 *
 *   npm run org:plan -- <organisation-id|name> <free|team|business|enterprise>
 */
import { PrismaClient, type Plan } from "@prisma/client";

const db = new PrismaClient();
const PLANS: Plan[] = ["free", "team", "business", "enterprise"];

async function main() {
  const [ref, plan] = process.argv.slice(2);
  if (!ref || !PLANS.includes(plan as Plan)) {
    console.error("Aufruf: npm run org:plan -- <organisation-id|name> <free|team|business|enterprise>");
    process.exit(1);
  }
  const orgs = await db.organization.findMany({ where: { OR: [{ id: ref }, { name: { equals: ref, mode: "insensitive" } }] } });
  if (orgs.length !== 1) {
    console.error(orgs.length === 0 ? "Keine Firma gefunden." : "Mehrere Firmen gefunden – bitte die ID verwenden.");
    process.exit(1);
  }
  await db.organization.update({ where: { id: orgs[0].id }, data: { plan: plan as Plan } });
  console.log(`${orgs[0].name} (${orgs[0].id}) → ${plan}`);
}

main().finally(() => db.$disconnect());
