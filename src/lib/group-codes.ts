/**
 * Utilities for generating, embedding, and validating group join codes.
 */

export function generateGroupJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GRP-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function extractGroupJoinCode(description: string | null | undefined): string | null {
  if (!description) return null;
  const match = description.match(/\[join_code:([A-Z0-9-]+)\]/);
  return match ? match[1] : null;
}

export function cleanGroupDescription(description: string | null | undefined): string {
  if (!description) return "";
  return description.replace(/\[join_code:[A-Z0-9-]+\]/g, "").trim();
}

export function embedGroupJoinCode(description: string | null | undefined, code: string): string {
  const clean = cleanGroupDescription(description);
  return clean ? `${clean}\n\n[join_code:${code}]` : `[join_code:${code}]`;
}
