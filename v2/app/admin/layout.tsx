import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AdminPermissionGate from "./permission-gate";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "MASTER_ADMIN" && session.role !== "ORGANIZER") redirect("/");
  return <AdminPermissionGate>{children}</AdminPermissionGate>;
}