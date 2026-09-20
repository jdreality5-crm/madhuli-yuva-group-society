import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";

async function rest<T>(table: string, q: Record<string, string>, init?: RequestInit) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw Error("CONFIG");
  const url = new URL(`${base}/rest/v1/${table}`);
  Object.entries(q).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json", Prefer: "return=representation" } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error("REST");
  return data as T;
}

const schema = z.object({
  label: z.string().trim().min(1).max(80),
  floorNumber: z.number().int().min(0),
  floorLabel: z.string().trim().min(1).max(40),
  residentType: z.enum(["OWNER", "TENANT"]).optional().nullable(),
  ownerName: z.string().trim().max(120).optional().nullable(),
  ownerMobile: z.string().trim().max(20).optional().nullable(),
  ownerEmail: z.string().trim().email().max(320).optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const property = (
      await rest<any[]>("Property", {
        select: "id",
        id: `eq.${id}`,
        societyId: `eq.${session.societyId}`,
        status: "eq.ACTIVE",
      })
    )[0];

    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    const body = schema.parse(await request.json());
    const label = body.label.trim();
    const duplicate = (
      await rest<any[]>("PropertyUnit", {
        select: "id",
        propertyId: `eq.${id}`,
        label: `ilike.${label}`,
        limit: "1",
      })
    )[0];
    if (duplicate) {
      return NextResponse.json({ error: "This unit/floor label already exists in this property." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const unit = (
      await rest<any[]>("PropertyUnit", { select: "*", id: "is.null" }, {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          propertyId: id,
          label,
          floorNumber: body.floorNumber,
          floorLabel: body.floorLabel.trim(),
          residentType: body.residentType || null,
          ownerName: body.ownerName?.trim() || null,
          ownerMobile: body.ownerMobile?.trim() || null,
          ownerEmail: body.ownerEmail?.trim().toLowerCase() || null,
          createdAt: now,
          updatedAt: now,
        }),
      })
    )[0];

    return NextResponse.json({ unit }, { status: 201 });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof Error && error.message === "FORBIDDEN" ? 403 : error instanceof Error && error.message === "CONFIG" ? 500 : 500;
    return NextResponse.json({ error: status === 400 ? "Invalid unit details." : status === 403 ? "Organizer access required." : "Unable to create unit" }, { status });
  }
}
