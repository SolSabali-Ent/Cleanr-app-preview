import TodayScreen from "../../app/provider/screens/TodayScreen";
import { ProviderNetworkValueCard } from "../../app/provider/components/ProviderNetworkValueCard";

export function Home() {
  return (
    <>
      <TodayScreen />
      <ProviderNetworkValueCard />
    </>
  );
}
