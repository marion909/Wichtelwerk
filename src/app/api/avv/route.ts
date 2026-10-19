import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { avvSections } from "@/lib/avv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function GET() {
  const avv = avvSections();
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595;
  const H = 842;
  const margin = 56;
  let page = pdf.addPage([W, H]);
  let y = H - margin;

  const ensure = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage([W, H]);
      y = H - margin;
    }
  };
  const write = (text: string, f: PDFFont, size: number, gap: number, color = rgb(0.1, 0.16, 0.14)) => {
    for (const line of wrap(text, f, size, W - 2 * margin)) {
      ensure(size + 4);
      page.drawText(line, { x: margin, y: y - size, size, font: f, color });
      y -= size + 4;
    }
    y -= gap;
  };

  write(avv.title, bold, 15, 10, rgb(0.09, 0.25, 0.21));
  write(avv.intro, font, 10, 12);
  for (const s of avv.sections) {
    ensure(40);
    write(s.title, bold, 11, 2);
    write(s.body, font, 10, 10);
  }
  write("Ort, Datum: ____________________      Unterschrift Auftraggeber: ____________________", font, 10, 20);
  write("Unterschrift Auftragnehmer: ____________________", font, 10, 0);

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="wichtelwerk-av-vertrag.pdf"',
    },
  });
}
