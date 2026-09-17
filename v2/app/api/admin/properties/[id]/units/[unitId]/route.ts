import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrganizer } from "@/lib/auth";

const schema = z.object({
  residentType: z.enum(["OWNER", "TENANT"]).nullable(),
  name: z.string().trim().max(120).nullable(),
  mobile: z.string().trim().min(1, "Mobile number is required").max(30),
  email: z.string().trim().email().max(160).nullable().or(z.literal("")),
  signupEnabled: z.boolean(),
  residentUserId: z.string().trim().nullable().or(z.literal("")),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; unitId: string }> }) {
  const session = await requireOrganizer();
  const { id, unitId } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  const data = parsed.data;
  const mobile = data.mobile.trim();
  const email = data.email === "" ? null : data.email?.toLowerCase() || null;
  const name = data.name?.trim() || null;
  const residentUserId = data.residentUserId === "" ? null : data.residentUserId;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const unit = await tx.propertyUnit.findFirst({ where: { id: unitId, propertyId: id, property: { societyId: session.societyId } } });
      if (!unit) throw new Error("UNIT_NOT_FOUND");
      if (residentUserId) {
        const user = await tx.user.findFirst({ where: { id: residentUserId, societyId: session.societyId } });
        if (!user) throw new Error("USER_NOT_FOUND");
        if (user.role !== "OWNER") throw new Error("ONLY_RESIDENT_USER");
        const occupied = await tx.propertyUnit.findFirst({ where: { residentUserId, id: { not: unitId } } });
        if (occupied) throw new Error("USER_ALREADY_LINKED");
      }
      const previousUserId = unit.residentUserId;
      const updated = await tx.propertyUnit.update({ where: { id: unitId }, data: { residentType: data.residentType, ownerName: name, ownerMobile: mobile, ownerEmail: email, signupEnabled: data.signupEnabled, residentUserId: residentUserId || null } });
      if (previousUserId && previousUserId !== residentUserId) await tx.user.updateMany({ where: { id: previousUserId, societyId: session.societyId, unitId }, data: { unitId: null, residentType: null } });
      if (residentUserId) await tx.user.update({ where: { id: residentUserId }, data: { unitId, residentType: data.residentType } });
      await tx.auditLog.create({ data: { societyId: session.societyId, actorUserId: session.id, action: "UPDATE", module: "PROPERTY_UNIT", recordId: unitId, details: JSON.stringify({ propertyId: id, residentType: data.residentType, residentUserId: residentUserId || null, signupEnabled: data.signupEnabled }) } });
      return updated;
    });
    return NextResponse.json({ unit: result });
  } catch (e: any) {
    const map: Record<string, [string, number]> = { UNIT_NOT_FOUND: ["Unit not found", 404], USER_NOT_FOUND: ["Resident user not found", 404], ONLY_RESIDENT_USER: ["Only resident accounts can be linked to a property unit", 400], USER_ALREADY_LINKED: ["This resident is already linked to another unit", 409] };
    const [error, status] = map[e?.message] || ["Unable to update unit", 500];
    return NextResponse.json({ error }, { status });
  }
}
