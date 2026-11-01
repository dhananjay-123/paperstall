// Generates a Postman v2.1 collection from the OpenAPI spec. Run: pnpm postman
// Import postman/paperstall.postman_collection.json into Postman and publish it.
import { mkdirSync, writeFileSync } from "node:fs";
import { openApiSpec } from "../src/core/openapi";

type Schema = { type?: string; properties?: Record<string, Schema>; items?: Schema; enum?: unknown[]; anyOf?: Schema[]; required?: string[] };

// A small example body from a JSON schema, so requests are ready to edit.
function example(s: Schema | undefined, depth = 0): unknown {
  if (!s || depth > 4) return null;
  if (s.enum) return s.enum[0];
  if (s.anyOf) return example(s.anyOf[0], depth + 1);
  switch (s.type) {
    case "object":
      return Object.fromEntries(Object.entries(s.properties ?? {}).filter(([k]) => s.required?.includes(k)).map(([k, v]) => [k, example(v, depth + 1)]));
    case "array":
      return [example(s.items, depth + 1)];
    case "string":
      return "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}

const spec = openApiSpec("{{baseUrl}}");
const items = Object.entries(spec.paths as Record<string, Record<string, { summary: string; description?: string; tags: string[]; requestBody?: { content: { "application/json": { schema: Schema } } } }>>).flatMap(
  ([path, methods]) =>
    Object.entries(methods).map(([method, op]) => ({
      name: op.summary,
      request: {
        method: method.toUpperCase(),
        header: [{ key: "Content-Type", value: "application/json" }],
        url: { raw: `{{baseUrl}}${path}`, host: ["{{baseUrl}}"], path: path.split("/").filter(Boolean) },
        description: op.description ?? op.summary,
        ...(op.requestBody ? { body: { mode: "raw", raw: JSON.stringify(example(op.requestBody.content["application/json"].schema), null, 2), options: { raw: { language: "json" } } } } : {}),
      },
    })),
);

const collection = {
  info: { name: "Paperstall API (sandbox)", description: spec.info.description, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  variable: [{ key: "baseUrl", value: "http://localhost:3000" }],
  item: items,
};

mkdirSync("postman", { recursive: true });
writeFileSync("postman/paperstall.postman_collection.json", JSON.stringify(collection, null, 2) + "\n");
console.log(`Wrote ${items.length} requests to postman/paperstall.postman_collection.json`);
