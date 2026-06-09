import { Sidebar } from "@/components/sidebar/Sidebar";
import { WelcomeModal } from "@/components/ui/WelcomeModal";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] md:fixed md:inset-0 md:min-h-0">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {children}
      </div>
      <WelcomeModal />
    </div>
  );
}
