import "server-only";
import { createHash, randomInt } from "node:crypto";
import { join } from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { Profile, Project } from "@/lib/types";

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const WATERMARK_FONT_FILE = join(process.cwd(), "node_modules", "@expo-google-fonts", "noto-sans-sc", "400Regular", "NotoSansSC_400Regular.ttf");
const WATERMARK_FONT_FAMILY = "Noto Sans SC";

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

function formatDynamicDisplayCoordinates(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${lat.toFixed(6)}${randomInt(0, 10)}, ${lng.toFixed(6)}${randomInt(0, 10)}`;
}

function textOverlay({
  text,
  width,
  size,
  color,
  top,
  left,
  weight = 600,
  align = "left",
}: {
  text: string;
  width: number;
  size: number;
  color: string;
  top: number;
  left: number;
  weight?: number;
  align?: "left" | "centre" | "right";
}): OverlayOptions {
  return {
    input: {
      text: {
        text: `<span foreground="${color}" weight="${weight}">${escapeXml(text)}</span>`,
        font: `${WATERMARK_FONT_FAMILY} ${size}`,
        fontfile: WATERMARK_FONT_FILE,
        width,
        align,
        wrap: "none",
        rgba: true,
      },
    },
    top,
    left,
  };
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
  const displayCoordinates = formatDynamicDisplayCoordinates(project.latitude, project.longitude);
  const panelTop = photoHeight + padding;
  const lineGap = Math.max(9, Math.round(width * 0.007));
  let textTop = panelTop;

  const composite: OverlayOptions[] = [
    { input: selfie, top: 0, left: 0 },
    textOverlay({ text: profile.company || "ONSITE SUPPORT PORTAL", width: textWidth, size: smallSize, color: "#b7e4c7", weight: 700, top: textTop, left: padding }),
  ];
  textTop += smallSize + lineGap;
  composite.push(textOverlay({ text: eventType === "CHECK_IN" ? "CHECK IN" : "CHECK OUT", width: textWidth, size: titleSize, color: "#ffffff", weight: 800, top: textTop, left: padding }));
  textTop += titleSize + lineGap;
  composite.push(textOverlay({ text: profile.display_name, width: textWidth, size: bodySize, color: "#ffffff", top: textTop, left: padding }));
  textTop += bodySize + lineGap;
  composite.push(textOverlay({ text: `${project.project_name} · ${project.customer_name}`, width: textWidth, size: bodySize, color: "#ffffff", top: textTop, left: padding }));
  textTop += bodySize + lineGap;
  composite.push(textOverlay({ text: address, width: textWidth, size: smallSize, color: "#b7c8c2", weight: 400, top: textTop, left: padding }));
  textTop += smallSize + lineGap;
  composite.push(textOverlay({ text: time, width: textWidth, size: smallSize, color: "#b7c8c2", weight: 400, top: textTop, left: padding }));
  composite.push(textOverlay({ text: recordCode, width: textWidth, size: smallSize, color: "#d9f99d", weight: 700, top: photoHeight + panelHeight - padding - smallSize - 2, left: padding }));

  const mapLeft = width - mapWidth - padding;
  const mapTop = photoHeight + padding;
  if (map) {
    const mapImage = await sharp(map).rotate().resize({ width: mapWidth, height: mapHeight, fit: "cover" }).webp({ quality: 80 }).toBuffer();
    composite.push({ input: mapImage, top: mapTop, left: mapLeft });
  } else {
    composite.push({ input: { create: { width: mapWidth, height: mapHeight, channels: 4, background: "#173f34" } }, top: mapTop, left: mapLeft });
    composite.push(textOverlay({ text: "PROJECT MAP", width: mapWidth, size: smallSize, color: "#8eaaa1", weight: 700, top: mapTop + Math.round(mapHeight * 0.38), left: mapLeft }));
    composite.push(textOverlay({ text: "Not uploaded", width: mapWidth, size: Math.max(12, smallSize - 2), color: "#69857d", weight: 400, top: mapTop + Math.round(mapHeight * 0.54), left: mapLeft }));
  }

  if (displayCoordinates) {
    const badgeInset = Math.max(7, Math.round(width * 0.006));
    const badgeWidth = mapWidth - badgeInset * 2;
    const badgeHeight = Math.max(54, smallSize * 2 + 20);
    const badgeLeft = mapLeft + badgeInset;
    const badgeTop = mapTop + badgeInset;
    composite.push({ input: { create: { width: badgeWidth, height: badgeHeight, channels: 4, background: "#082b22e8" } }, top: badgeTop, left: badgeLeft });
    composite.push(textOverlay({ text: "DISPLAY COORDINATES / 显示动态坐标", width: badgeWidth - badgeInset * 2, size: Math.max(9, smallSize - 6), color: "#b7e4c7", weight: 700, top: badgeTop + 7, left: badgeLeft + badgeInset, align: "right" }));
    composite.push(textOverlay({ text: displayCoordinates, width: badgeWidth - badgeInset * 2, size: Math.max(11, smallSize - 3), color: "#ffffff", weight: 700, top: badgeTop + smallSize + 10, left: badgeLeft + badgeInset, align: "right" }));
  }

  return sharp({ create: { width, height: photoHeight + panelHeight, channels: 4, background: "#082b22" } })
    .composite(composite)
    .webp({ quality: 84 })
    .toBuffer();
}
