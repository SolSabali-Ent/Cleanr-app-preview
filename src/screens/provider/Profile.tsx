import { useLocation, useNavigate } from "react-router-dom";
import ProfileScreen from "../../app/provider/screens/ProfileScreen";
import { cspRouteForContext } from "../../lib/contextualRoutes";

export function Profile() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <>
      <div className="px-4 pt-4" style={{ backgroundColor: "#0B1220" }}>
        <button
          type="button"
          onClick={() => navigate(cspRouteForContext(pathname, "/csp/dashboard/existing-clients"))}
          className="w-full rounded-2xl border px-4 py-3 text-left"
          style={{ backgroundColor: "rgba(141,204,100,.08)", borderColor: "rgba(141,204,100,.22)", color: "#F8FAFC" }}
        >
          <p className="text-sm font-semibold">Bring an existing client</p>
          <p className="mt-1 text-xs leading-5" style={{ color: "#98A2B3" }}>
            Preserve a client relationship you already had before Cleanr and invite that household into the Founding Circle.
          </p>
        </button>
      </div>
      <ProfileScreen />
    </>
  );
}
