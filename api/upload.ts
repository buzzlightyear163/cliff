import { randomUUID } from "crypto";
import { HttpError, SITE_URL, body, handle } from "./_lib/solana";
import { putFile } from "./_lib/store";

const TYPES: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

function cleanUrl(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (!/^https:\/\/[^\s]{3,200}$/.test(s)) throw new HttpError(400, "Links have to start with https://");
  return s;
}

// Stores the coin image and its token metadata. Returns the metadata URI the launch points at.
export default handle(async (req) => {
  const b = body(req);
  const name = String(b.name ?? "").trim().slice(0, 32);
  const symbol = String(b.symbol ?? "").trim().replace(/^\$/, "").toUpperCase().slice(0, 10);
  const description = String(b.description ?? "").trim().slice(0, 600);
  if (!name || !symbol) throw new HttpError(400, "Add a name and a ticker first.");
  const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image ?? ""));
  if (!m) throw new HttpError(400, "Add an image (PNG, JPG, WEBP or GIF).");
  const img = Buffer.from(m[2], "base64");
  if (img.length > 1_500_000) throw new HttpError(400, "Image has to be under 1.5 MB.");
  const website = cleanUrl(b.website);
  const twitter = cleanUrl(b.twitter);
  const telegram = cleanUrl(b.telegram);

  const id = randomUUID();
  const ext = m[1] === "jpg" ? "jpeg" : m[1];
  const image = await putFile(`img/${id}.${ext}`, img, TYPES[ext]);
  const meta = {
    name,
    symbol,
    description,
    image,
    showName: true,
    createdOn: SITE_URL,
    ...(website ? { website } : {}),
    ...(twitter ? { twitter } : {}),
    ...(telegram ? { telegram } : {}),
  };
  const uri = await putFile(`meta/${id}.json`, JSON.stringify(meta), "application/json");
  return { uri, image };
});
