import { PgBoss } from "pg-boss";
import { runTick } from "./jobs";

const QUEUE = "tick";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL ist nicht gesetzt");

  const boss = new PgBoss({ connectionString, max: 3, schema: "pgboss" });
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();

  await boss.createQueue(QUEUE);
  // Jede Minute prüfen: Einladungen, Ziehung, Erinnerungen, Reveal, Löschfristen.
  await boss.schedule(QUEUE, "* * * * *");
  await boss.work(QUEUE, async () => {
    try {
      await runTick();
    } catch (err) {
      console.error("[tick]", err);
      throw err;
    }
  });
  console.log("[worker] gestartet");

  const stop = async () => {
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
