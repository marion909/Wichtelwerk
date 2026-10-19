import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// title, description, tags, min €, max €
const IDEAS: [string, string, string[], number, number][] = [
  ["Kaffeespezialität im Geschenkset", "Röstkaffee aus einer lokalen Rösterei, gern mit Tasse.", ["kaffee", "genuss", "kulinarik"], 8, 30],
  ["Tee-Sampler", "Auswahl hochwertiger Tees zum Entdecken.", ["tee", "genuss", "kulinarik"], 8, 25],
  ["Handgemachte Schokolade", "Kleine Manufaktur, Bean-to-Bar.", ["schokolade", "süßes", "genuss"], 6, 25],
  ["Gewürz- oder Chili-Set", "Für Hobbyköche mit Lust auf Neues.", ["kochen", "gewürze", "kulinarik"], 10, 30],
  ["Olivenöl & Balsamico", "Gutes Öl in der Geschenkbox.", ["kochen", "kulinarik", "genuss"], 12, 35],
  ["Craft-Bier-Auswahl", "Regionale Brauereien im Probierpaket.", ["bier", "genuss", "alkohol"], 12, 30],
  ["Wein aus der Region", "Eine gute Flasche vom Winzer nebenan.", ["wein", "genuss", "alkohol"], 12, 40],
  ["Gin- oder Likör-Miniaturen", "Zum Probieren und Mixen.", ["gin", "cocktails", "alkohol"], 15, 40],
  ["Alkoholfreier Aperitif", "Hochwertiger alkoholfreier Genuss.", ["genuss", "kulinarik"], 10, 30],
  ["Buch vom Lieblingsautor", "Ein Roman oder Sachbuch passend zu den Interessen.", ["bücher", "lesen"], 10, 30],
  ["Hörbuch-Gutschein", "Für Pendler und Läufer.", ["hörbuch", "lesen", "musik"], 10, 25],
  ["Notizbuch & Stift-Set", "Schönes Papier für Ideen und Listen.", ["büro", "schreiben", "kreativ"], 10, 35],
  ["Pflanze im Keramiktopf", "Pflegeleicht, für Schreibtisch oder Fensterbank.", ["pflanzen", "deko", "garten"], 10, 30],
  ["Kräuter-Anzuchtset", "Frische Kräuter für die Küche.", ["garten", "kochen", "pflanzen"], 8, 20],
  ["Kerze & Duftset", "Natürliche Düfte für gemütliche Abende.", ["kerzen", "deko", "wellness"], 8, 30],
  ["Wellness-Set mit Badekugeln", "Entspannung nach einem langen Tag.", ["wellness", "entspannung"], 10, 30],
  ["Handcreme & Lippenpflege", "Naturkosmetik-Set.", ["wellness", "pflege"], 8, 25],
  ["Kuschelsocken & Schal", "Warm durch den Winter.", ["mode", "winter", "gemütlich"], 10, 35],
  ["Thermobecher oder Trinkflasche", "Hält Getränke stundenlang warm oder kalt.", ["kaffee", "tee", "outdoor", "büro"], 12, 35],
  ["Wanderkarte oder Outdoor-Guide", "Für Touren in der Umgebung.", ["wandern", "outdoor", "reisen"], 10, 25],
  ["Mini-Taschenlampe oder Multitool", "Praktisch für unterwegs.", ["outdoor", "technik", "werkzeug"], 12, 40],
  ["Brettspiel für Zwei oder Gruppen", "Kompakt und schnell erklärt.", ["spiele", "brettspiele", "familie"], 12, 40],
  ["Puzzle (500–1000 Teile)", "Mit Motiv nach Wahl.", ["puzzle", "spiele", "entspannung"], 12, 30],
  ["Bastel- oder Malset", "Kreativ werden mit Aquarell oder Strickzeug.", ["kreativ", "basteln", "malen"], 10, 35],
  ["Kopfhörer-Ständer oder Kabelorganizer", "Ordnung am Arbeitsplatz.", ["technik", "büro"], 8, 25],
  ["Kabelloses Ladepad", "Praktisch für Handy und Kopfhörer.", ["technik", "gadgets"], 15, 40],
  ["Fahrrad-Licht-Set", "Sicher unterwegs.", ["rad", "sport", "sicherheit"], 10, 35],
  ["Yoga-Block & Band", "Für Dehnung und Entspannung.", ["yoga", "sport", "wellness"], 12, 30],
  ["Gutschein für Kino oder Theater", "Ein Abend zum Genießen.", ["kino", "kultur", "film"], 15, 50],
  ["Foto-Magnete oder kleiner Bilderrahmen", "Erinnerungen fürs Büro.", ["deko", "foto", "büro"], 6, 20],
  ["Vinyl oder Schallplatten-Gutschein", "Für Musikfans.", ["musik", "vinyl"], 15, 45],
  ["Tierfreund-Geschenk (Leckerli-Box)", "Für Hunde- und Katzenbesitzer.", ["haustiere", "hund", "katze"], 8, 25],
  ["Kinderbuch oder Spiel für die Familie", "Für Eltern und Kinder zum Teilen.", ["familie", "kinder", "spiele"], 8, 25],
  ["Adventskalender (Tee, Kaffee oder Schokolade)", "Passend zum Dezember.", ["weihnachten", "genuss", "süßes"], 10, 30],
];

async function main() {
  if ((await db.giftIdea.count()) > 0) {
    console.log("Geschenkideen sind bereits vorhanden – übersprungen.");
    return;
  }
  await db.giftIdea.createMany({
    data: IDEAS.map(([title, description, tags, min, max]) => ({
      title,
      description,
      tags,
      minCents: min * 100,
      maxCents: max * 100,
    })),
  });
  console.log(`${IDEAS.length} Geschenkideen angelegt.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
