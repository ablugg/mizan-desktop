import { redirect } from "next/navigation";

export default function AdminLayout() {
  // Desktop: no admin panel.
  redirect("/chat/new");
}
