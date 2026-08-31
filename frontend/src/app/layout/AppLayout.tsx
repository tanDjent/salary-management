import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar/Sidebar";
import Topbar from "./Topbar/Topbar";
import { useSidebar } from "../../store/useSidebar";
import type { Tab } from "./hooks/useLayout";

const TITLE_BY_PATH: Record<string, Tab> = {
  "/": "Dashboard",
  "/employees": "Employees",
};

const AppLayout = () => {
  const { isOpen } = useSidebar();
  const location = useLocation();
  const title = TITLE_BY_PATH[location.pathname] ?? "Employees";

  return (
    <div className="flex h-dvh">
      <Sidebar />

      <div
        className={`flex min-w-0 flex-1 flex-col bg-white transition-all duration-300 ease-in-out ${
          isOpen ? "ml-20 lg:ml-64" : "ml-20"
        }`}
      >
        <Topbar />

        <main className="flex-1 overflow-auto bg-gray-50 p-4 lg:p-6">
          <h1 className="mb-4 text-3xl font-medium">{title}</h1>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
