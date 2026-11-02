import { describe, expect, it } from "vitest";
import { extractBase64Png } from "./ops";

// A 1x1 PNG, the shape PayPal's generate-qr-code returns inside a multipart body.
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("extractBase64Png", () => {
  it("skips the text/plain part header that runs into the base64", () => {
    const body = [
      "--NjgxNDk0ZGEtY2YzMi00ZjY2",
      "Content-Disposition: form-data; name=\"image\"",
      "Content-Type: text/plain",
      "",
      PNG.repeat(3),
      "--NjgxNDk0ZGEtY2YzMi00ZjY2--",
      "",
    ].join("\r\n");
    const out = extractBase64Png(body);
    expect(out.startsWith("iVBORw0KGgo")).toBe(true);
    expect(out).toBe(PNG.repeat(3));
  });

  it("joins line-wrapped base64", () => {
    const wrapped = PNG.repeat(3).match(/.{1,76}/g)!.join("\r\n");
    expect(extractBase64Png(`Content-Type: text/plain\r\n\r\n${wrapped}\r\n--b--`)).toBe(PNG.repeat(3));
  });

  it("throws when there is no PNG", () => {
    expect(() => extractBase64Png("Content-Type: text/plain\r\n\r\nnope")).toThrow();
  });
});
