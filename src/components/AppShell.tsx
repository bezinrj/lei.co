import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";

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
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
