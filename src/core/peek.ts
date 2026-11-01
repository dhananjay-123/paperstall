import LZString from "lz-string";
import { StallPayload } from "./stall";

/** Browser-safe, unverified decode for rendering only; checkout always re-verifies on the server. */
export function peekStall(signed: string): StallPayload | null {
  try {
    const data = signed.slice(0, signed.lastIndexOf("."));
    const r = StallPayload.safeParse(JSON.parse(LZString.decompressFromEncodedURIComponent(data) ?? ""));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
