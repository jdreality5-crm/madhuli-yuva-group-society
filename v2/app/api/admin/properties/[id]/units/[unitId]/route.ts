import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";

async function rpc<T>(name: string, body: Record<string, unknown>) {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) throw new Error("CONFIG");

  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof data?.code === "string" ? data.code : "";
    const message = typeof data?.message === "string" ? data.message : "";
    throw new Error(code || message || `RPC_${response.status}`);
  }

  return data as T;
}

const schema = z.object({
  residentType: z.enum(["OWNER", "TENANT"]).nullable(),
  name: z.string().trim().max(120).nullable(),
  mobile: z.string().trim().max(30).nullable().or(z.literal("")),
  email: z.string().trim().email().max(160).nullable().or(z.literal("")),
  signupEnabled: z.boolean(),
  residentUserId: z.string().trim().nullable().or(z.literal("")),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; unitId: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id, unitId } = await params;
    const payload = schema.parse(await req.json());

    const mobile = payload.mobile === "" ? null : payload.mobile?.trim() || null;
    const email = payload.email === "" ? null : payload.email?.toLowerCase() || null;
    const name = payload.name?.trim() || null;
    const residentUserId = payload.residentUserId === "" ? null : payload.residentUserId;

    if (payload.signupEnabled && !email && !mobile) {
      return NextResponse.json(
        { error: "Add a registered email or mobile before enabling resident signup." },
        { status: 400 },
      );
    }

    if (residentUserId && !payload.residentType) {
      return NextResponse.json(
        { error: "Resident type is required when linking a resident account." },
        { status: 400 },
      );
    }

    const unit = await rpc<any>("update_property_unit_atomic", {
      p_society_id: session.societyId,
      p_user_id: session.id,
      p_property_id: id,
      p_unit_id: unitId,
      p_resident_type: payload.residentType,
      p_name: name,
      p_mobile: mobile,
      p_email: email,
      p_signup_enabled: payload.signupEnabled,
      p_resident_user_id: residentUserId,
    });

    return NextResponse.json({ unit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid unit details." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "";
    const knownErrors: Record<string, [string, number]> = {
      UNIT_NOT_FOUND: ["Unit not found", 404],
      USER_NOT_ACTIVE: [
        "Resident account must be active, approved, and email-verified before linking",
        409,
      ],
      USER_ALREADY_LINKED: ["This resident is already linked to another unit", 409],
      RESIDENT_TYPE_REQUIRED: ["Resident type is required when linking a resident account", 400],
    };

    const mapped = Object.entries(knownErrors).find(([code]) => message.includes(code))?.[1];
    const [responseError, status] =
      mapped ??
      (message === "FORBIDDEN"
        ? ["Organizer access required.", 403]
        : message === "CONFIG"
          ? ["Server configuration error", 500]
          : ["Unable to update unit", 502]);

    return NextResponse.json({ error: responseError }, { status });
  }
}
