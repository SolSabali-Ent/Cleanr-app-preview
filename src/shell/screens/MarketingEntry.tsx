/**
 * @deprecated Use `Landing` for the public home page. Kept so any legacy imports render the new landing.
 */
import Landing from "./Landing";

export function MarketingEntry() {
  return <Landing />;
}

export default Landing;
