/** Sends a meal photo to the server-side /api/scan-meal function, which calls Google Gemini
 *  vision and returns nutrition estimates as strict JSON. The Gemini API key never reaches the
 *  browser — it lives only in the server environment (see api/scan-meal.ts). */

import { supabase } from "@/lib/supabaseClient";

export interface MealScanResult {
  meal_name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

const MAX_IMAGE_EDGE = 1280; // px — plenty for food recognition, keeps uploads ~200-400 KB

/** Reads an image file, downscales it so the longest edge is at most MAX_IMAGE_EDGE, and
 *  re-encodes it as JPEG. Phone photos are often 4-12 MB, which exceeds the 4.5 MB request-body
 *  limit of the serverless function; downscaling also makes the scan noticeably faster. */
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't read that image file.");
  });
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1] ?? "", mimeType: "image/jpeg" };
}

export async function scanMealImage(base64: string, mimeType: string): Promise<MealScanResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again to use AI meal scanning.");

  const response = await fetch("/api/scan-meal", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ base64, mimeType }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `Meal scan failed (${response.status}).`);
  }
  return body as MealScanResult;
}
