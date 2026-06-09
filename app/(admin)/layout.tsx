import { redirect } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.MIZAN_ADMIN !== "true") {
    redirect("/chat/new");
  }
  return <>{children}</>;
}
