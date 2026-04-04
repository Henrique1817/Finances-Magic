import { DashboardAuthShell } from "@/components/auth/DashboardAuthShell";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function DashboardRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DashboardAuthShell>
      <DashboardLayout>{children}</DashboardLayout>
    </DashboardAuthShell>
  );
}
