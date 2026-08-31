import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { ArrowLeftFromLine, ArrowRightFromLine, Wallet } from "lucide-react";

import useLayout from "../hooks/useLayout";
import { useSidebar } from "../../../store/useSidebar";

const MOBILE_QUERY = "(max-width: 1023px)";

const Sidebar = () => {
  const { navItems } = useLayout();
  const { isOpen, toggle, close, open } = useSidebar();
  const SideBarIcon = isOpen ? ArrowLeftFromLine : ArrowRightFromLine;

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);

    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) close();
      else open();
    };

    if (mediaQuery.matches) close();
    else open();

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [close, open]);

  const closeOnSmallScreen = () => {
    if (window.matchMedia(MOBILE_QUERY).matches) close();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={(event) => {
            toggle();
            event.stopPropagation();
          }}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 h-full w-64 transform border-r border-gray-100 bg-white transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-44"
        }`}
      >
        <div
          className={`flex items-center pt-2 lg:px-6 ${
            isOpen ? "justify-between px-4" : "justify-end px-2"
          }`}
        >
          <div
            className={`flex w-fit items-center ${isOpen ? "" : "cursor-pointer"}`}
            onClick={() => {
              if (!isOpen) toggle();
            }}
          >
            <span className="m-3 flex size-8 items-center justify-center rounded-lg bg-violet-600">
              <Wallet className="size-5 text-white" />
            </span>
            {isOpen && <span className="text-lg font-semibold">PayView</span>}
          </div>
          {isOpen && (
            <SideBarIcon
              className="size-5 cursor-pointer lg:hidden"
              onClick={toggle}
            />
          )}
        </div>

        <nav
          className={`flex flex-col p-4 lg:p-6 space-y-2 ${!isOpen && "items-end"}`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                title={item.name}
                end={item.path === "/"}
                onClick={closeOnSmallScreen}
                className={({ isActive }) =>
                  `flex cursor-pointer items-center rounded-lg px-3 py-2 hover:bg-gray-100 ${
                    isActive ? "bg-gray-100" : ""
                  }`
                }
              >
                <Icon className="size-5" />
                {isOpen && <span className="ml-3 font-medium">{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
