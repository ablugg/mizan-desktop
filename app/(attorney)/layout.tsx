import { AttorneySidebar } from "@/components/attorney/AttorneySidebar";
import { AttorneyClientLayout } from "@/components/attorney/AttorneyClientLayout";
import { PageTransitionWrapper } from "@/components/attorney/PageTransitionWrapper";

export default function AttorneyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AttorneyClientLayout>
      <div className="flex min-h-[100dvh] md:fixed md:inset-0 md:min-h-0" style={{ background: "#060d1a" }}>
        <AttorneySidebar />
        <PageTransitionWrapper>
          {children}
        </PageTransitionWrapper>
      </div>
    </AttorneyClientLayout>
  );
}
