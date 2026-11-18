import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { AdminDashboardClient } from "@/components/AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <AdminDashboardClient
      userEmail={session.email}
      userName={session.name}
    />
  );
}
