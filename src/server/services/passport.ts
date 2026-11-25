import QRCode from "qrcode";
import { withPublic } from "../db";

export function passportUrl(token: string) {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/p/${token}`;
}

export function qrSvg(token: string) {
  return QRCode.toString(passportUrl(token), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#16191d", light: "#ffffff" } });
}

export async function publicUnitCard(token: string) {
  return withPublic((tx) =>
    tx.maybeOne<{ org_id: string; listing_title: string; provider_name: string; provider_phone: string | null; listing_slug: string; provider_slug: string; is_published: boolean }>(
      "select * from public_unit_card($1)", [token]),
  );
}
