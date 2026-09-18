import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrganizer } from "@/lib/auth";

const schema = z.object({
  residentType: z.enum(["OWNER", "TENANT"]).nullable(),
  name: z.string().trim().max(120).nullable(),
  mobile: z.string().trim().max(30).nullable().or(z.literal("")),
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
  const mobile = data.mobile === "" ? null : data.mobile?.trim() || null;
  const email = data.email === "" ? null : data.email?.toLowerCase() || null;
  const name = data.name?.trim() || null;
  const residentUserId = data.residentUserId === "" ? null : data.residentUserId;
  if (data.signupEnabled && !email && !mobile) return NextResponse.json({ error: "Add a registered email or mobile before enabling resident signup." }, { status: 400 });
  if (residentUserId && !data.residentType) return NextResponse.json({ error: "Resident type is required when linking a resident account." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const unit = await tx.propertyUnit.findFirst({ where: { id: unitId, propertyId: id, property: { societyId: session.societyId } } });
      if (!unit) throw new Error("UNIT_NOT_FOUND");
      if (residentUserId) {
        const user = await tx.user.findFirst({ where: { id: residentUserId, societyId: session.societyId }, select: { id:true,role:true,status:true,approvalStatus:true,emailVerified:true } });
        if (!user) throw new Error("USER_NOT_FOUND");
        if (user.role !== "OWNER") throw new Error("ONLY_RESIDENT_USER");
        if (user.status !== "ACTIVE" || user.approvalStatus !== "APPROVED" || !user.emailVerified) throw new Error("USER_NOT_ACTIVE");
        const occupied = await tx.propertyUnit.findFirst({ where: { residentUserId, id: { not: unitId } } });
        if (occupied) throw new Error("USER_ALREADY_LINKED");
      }
      const previousUserId = unit.residentUserId;
      const updated = await tx.propertyUnit.update({ where: { id: unitId }, data: { residentType: residentUserId ? data.residentType : null, ownerName: residentUserId ? name : null, ownerMobile: residentUserId ? mobile : null, ownerEmail: residentUserId ? email : null, signupEnabled: data.signupEnabled, residentUserId: residentUserId || null } });
      if (previousUserId && previousUserId !== residentUserId) await tx.user.updateMany({ where: { id: previousUserId, societyId: session.societyId, unitId }, data: { unitId: null, residentType: null } });
      if (residentUserId) await tx.user.update({ where: { id: residentUserId }, data: { unitId, residentType: data.residentType } });
      await tx.auditLog.create({ data: { userId: session.id, action: "UPDATE", module: "PROPERTY_UNIT", recordId: unitId, details: JSON.stringify({ propertyId: id, residentType: data.residentType, residentUserId: residentUserId || null, signupEnabled: data.signupEnabled }) } });
      return updated;
    });
    return NextResponse.json({ unit: result });
  } catch (e: any) {
    const map: Record<string, [string, number]> = { UNIT_NOT_FOUND:["Unit not found",404], USER_NOT_FOUND:["Resident user not found",404], ONLY_RESIDENT_USER:["Only resident accounts can be linked to a property unit",400], USER_NOT_ACTIVE:["Resident account must be active, approved, and email-verified before linking",409], USER_ALREADY_LINKED:["This resident is already linked to another unit",409] };
    const [error,status]=map[e?.message]||["Unable to update unit",500];
    return NextResponse.json({error},{status});
  }
}
