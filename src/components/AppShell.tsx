import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { BottomTabBar } from "./BottomTabBar";
import { InstallBanner } from "./InstallBanner";

type AppShellProps = {
  title: string;
  children: React.ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  return (
    <div className="min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="md:pl-[220px] flex flex-col min-h-screen">
        <Topbar title={title} />
        <main
          className="flex-1 px-4 md:px-8 py-6"
          style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}
        >
          {children}
        </main>
      </div>
      <BottomTabBar />
      <InstallBanner />
    </div>
  );
}
