// Lists the Gemini models this key can use and times one vision+JSON call and one
// function-calling call per candidate. Run: pnpm probe:gemini [model ...]
import { GoogleGenAI, Type } from "@google/genai";
import { deflateSync } from "node:zlib";

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("GEMINI_API_KEY is not set (put it in .env.local).");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: key });

// A tiny generated PNG (a dark bar on white) so the probe needs no image file.
function png(width: number, height: number): string {
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3, 255);
    row[0] = 0;
    if (y > height * 0.4 && y < height * 0.6) for (let x = width * 0.2; x < width * 0.8; x++) row.fill(20, 1 + Math.floor(x) * 3, 4 + Math.floor(x) * 3);
    rows.push(row);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

async function main() {
  const names: string[] = [];
  const pager = await ai.models.list();
  for await (const m of pager) {
    if (m.name && m.supportedActions?.includes("generateContent")) names.push(m.name.replace(/^models\//, ""));
  }
  console.log(`Models with generateContent (${names.length}):\n  ${names.join("\n  ")}\n`);

  const requested = process.argv.slice(2);
  const candidates = requested.length ? requested : names.filter((n) => /gemini-(\d|flash|pro)/.test(n) && !/(tts|image|embedding|live|audio|native)/.test(n)).slice(0, 8);
  const image = png(64, 48);

  for (const model of candidates) {
    const row: string[] = [model.padEnd(36)];
    try {
      const t = Date.now();
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/png", data: image } }, { text: "Detect the dark bar. Return its box as [ymin,xmin,ymax,xmax] 0-1000." }] }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: { type: "object", properties: { box: { type: "array", items: { type: "number" } } }, required: ["box"] },
        },
      });
      row.push(`vision+json ${Date.now() - t}ms ${(r.text ?? "").replace(/\s+/g, "").slice(0, 40)}`);
    } catch (e) {
      row.push(`vision+json FAIL ${(e as Error).message.slice(0, 60)}`);
    }
    try {
      const t = Date.now();
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: "What were sales today? Use the tool." }] }],
        config: {
          tools: [{ functionDeclarations: [{ name: "sales_summary", description: "Sales summary", parameters: { type: Type.OBJECT, properties: { period: { type: Type.STRING } }, required: ["period"] } }] }],
        },
      });
      row.push(`tools ${Date.now() - t}ms ${r.functionCalls?.[0]?.name ?? "no call"}`);
    } catch (e) {
      row.push(`tools FAIL ${(e as Error).message.slice(0, 60)}`);
    }
    console.log(row.join(" | "));
  }
  console.log("\nPick GEMINI_MODEL (vision + JSON + boxes + tools) and GEMINI_FAST_MODEL (chat) and set them in .env.local.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
