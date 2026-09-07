import { CustomerHome } from "../../shell/screens/CustomerHome";
import { RelationshipMessagesHomeCard } from "../../components/relationships/RelationshipMessagesHomeCard";

export function Home() {
  return (
    <>
      <CustomerHome />
      <RelationshipMessagesHomeCard variant="customer" />
    </>
  );
}
