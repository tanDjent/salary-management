import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar/Sidebar";
import Topbar from "./Topbar/Topbar";
import { useSidebar } from "../../store/useSidebar";

const AppLayout = () => {
  const { isOpen } = useSidebar();

  return (
    <div className="flex h-dvh">
      <Sidebar />

      <div
        className={`flex min-w-0 flex-1 flex-col bg-white transition-all duration-300 ease-in-out ${
          isOpen ? "ml-20 lg:ml-64" : "ml-20"
        }`}
      >
        <Topbar />

        {/* Pages render their own PageHeader, so the title row can carry that
            page's primary action. */}
        <main className="flex-1 overflow-auto bg-gray-50 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
