import CSPLogin from "../../app/provider/screens/CSPLogin";

/** Shared: auth entry. Role is determined by route/context; this is the CSP login gate. */
export function Auth() {
  return <CSPLogin />;
}
