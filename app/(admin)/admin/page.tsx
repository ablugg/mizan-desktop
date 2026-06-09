import { db } from "@/lib/db";
import AdminPanel from "./AdminPanel";

export default async function AdminPage() {
  const [totalSessions, totalEnclaveCount] = await Promise.all([
    db.attorneySession.count(),
    db.attorneyToolUsage.count(),
  ]);

  return (
    <AdminPanel
      applications={[]}
      totalEnclaveCount={totalEnclaveCount}
      totalSessions={totalSessions}
    />
  );
}
