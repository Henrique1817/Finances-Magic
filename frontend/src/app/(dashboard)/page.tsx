import { AiAccuracyRealtimeCard } from "@/components/dashboard/AiAccuracyRealtimeCard";
import { HomeOverviewPanel } from "@/components/dashboard/HomeOverviewPanel";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8 md:space-y-10">
      <HomeOverviewPanel />
      <AiAccuracyRealtimeCard />
    </div>
  );
}
