import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { uploadDir } from "@/lib/uploads";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const org = await db.organization.findUnique({ where: { id }, select: { logoUrl: true } });
  const file = org?.logoUrl;
  const ext = file?.split(".").pop() ?? "";
  if (!file || !TYPES[ext] || file !== path.basename(file)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(uploadDir(), file));
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": TYPES[ext],
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
