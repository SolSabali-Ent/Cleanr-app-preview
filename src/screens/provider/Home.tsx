import TodayScreen from "../../app/provider/screens/TodayScreen";
import { ProviderNetworkValueCard } from "../../app/provider/components/ProviderNetworkValueCard";
import { RelationshipMessagesHomeCard } from "../../components/relationships/RelationshipMessagesHomeCard";

export function Home() {
  return (
    <>
      <TodayScreen />
      <RelationshipMessagesHomeCard variant="csp" />
      <ProviderNetworkValueCard />
    </>
  );
}
