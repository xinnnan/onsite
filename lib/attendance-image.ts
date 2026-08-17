import "server-only";
import { createHash } from "node:crypto";
import sharp, { type OverlayOptions } from "sharp";
import type { Profile, Project } from "@/lib/types";

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function normalizeSelfie(file: File) {
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) throw new Error("UNSUPPORTED_PHOTO_TYPE");
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) throw new Error("PHOTO_SIZE_INVALID");
  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    output = await sharp(input)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error("INVALID_PHOTO");
  }
  return { buffer: output, hash: createHash("sha256").update(output).digest("hex") };
}

function escapeXml(value: string | null | undefined) {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatProjectAddress(project: Project) {
  const line2 = [project.city, project.state, project.postal_code].filter(Boolean).join(" ");
  return [project.address_line_1, project.address_line_2, line2].filter(Boolean).join(", ");
}

function formatTimestamp(timestamp: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
    }).format(timestamp);
  } catch {
    return timestamp.toISOString();
  }
}

export async function createWatermarkedPhoto({
  selfie,
  map,
  eventType,
  profile,
  project,
  timestamp,
  recordCode,
}: {
  selfie: Buffer;
  map?: Buffer | null;
  eventType: "CHECK_IN" | "CHECK_OUT";
  profile: Profile;
  project: Project;
  timestamp: Date;
  recordCode: string;
}) {
  const normalized = await sharp(selfie).metadata();
  const width = normalized.width || 1280;
  const photoHeight = normalized.height || 960;
  const panelHeight = Math.max(280, Math.round(width * 0.22));
  const padding = Math.max(34, Math.round(width * 0.03));
  const mapWidth = Math.round(width * 0.27);
  const mapHeight = panelHeight - padding * 2;
  const textWidth = width - mapWidth - padding * 3;
  const titleSize = Math.max(30, Math.round(width * 0.027));
  const bodySize = Math.max(18, Math.round(width * 0.015));
  const smallSize = Math.max(15, Math.round(width * 0.012));
  const address = formatProjectAddress(project);
  const time = formatTimestamp(timestamp, project.timezone);

  const svg = Buffer.from(`
    <svg width="${textWidth}" height="${panelHeight - padding * 2}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .brand { fill:#b7e4c7; font-family:Arial,sans-serif; font-size:${smallSize}px; font-weight:700; letter-spacing:3px; }
        .title { fill:#ffffff; font-family:Arial,sans-serif; font-size:${titleSize}px; font-weight:800; }
        .body { fill:#ffffff; font-family:Arial,sans-serif; font-size:${bodySize}px; font-weight:600; }
        .muted { fill:#b7c8c2; font-family:Arial,sans-serif; font-size:${smallSize}px; }
        .code { fill:#d9f99d; font-family:monospace; font-size:${smallSize}px; font-weight:700; }
      </style>
      <text x="0" y="${smallSize + 2}" class="brand">DROPLETAI SERVICES</text>
      <text x="0" y="${smallSize + titleSize + 17}" class="title">${escapeXml(eventType === "CHECK_IN" ? "CHECK IN" : "CHECK OUT")}</text>
      <text x="0" y="${smallSize + titleSize + bodySize + 47}" class="body">${escapeXml(profile.display_name)}</text>
      <text x="0" y="${smallSize + titleSize + bodySize * 2 + 72}" class="body">${escapeXml(project.project_name)} · ${escapeXml(project.customer_name)}</text>
      <text x="0" y="${smallSize + titleSize + bodySize * 3 + 96}" class="muted">${escapeXml(address)}</text>
      <text x="0" y="${smallSize + titleSize + bodySize * 4 + 120}" class="muted">${escapeXml(time)}</text>
      <text x="0" y="${panelHeight - padding * 2 - 3}" class="code">${escapeXml(recordCode)}</text>
    </svg>
  `);

  const composite: OverlayOptions[] = [
    { input: selfie, top: 0, left: 0 },
    { input: svg, top: photoHeight + padding, left: padding },
  ];

  if (map) {
    const mapImage = await sharp(map).rotate().resize({ width: mapWidth, height: mapHeight, fit: "cover" }).webp({ quality: 80 }).toBuffer();
    composite.push({ input: mapImage, top: photoHeight + padding, left: width - mapWidth - padding });
  } else {
    const placeholder = Buffer.from(`<svg width="${mapWidth}" height="${mapHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="14" fill="#173f34"/><text x="50%" y="48%" text-anchor="middle" fill="#8eaaa1" font-family="Arial" font-size="${smallSize}">PROJECT MAP</text><text x="50%" y="60%" text-anchor="middle" fill="#69857d" font-family="Arial" font-size="${Math.max(12, smallSize - 2)}">Not uploaded</text></svg>`);
    composite.push({ input: placeholder, top: photoHeight + padding, left: width - mapWidth - padding });
  }

  return sharp({ create: { width, height: photoHeight + panelHeight, channels: 4, background: "#082b22" } })
    .composite(composite)
    .webp({ quality: 84 })
    .toBuffer();
}
