import { ChartPie, Users, type LucideProps } from "lucide-react";

export type Tab = "Dashboard" | "Employees";
export type Path = "/" | "/employees";

type NavItem = {
  name: Tab;
  icon: React.ComponentType<LucideProps>;
  path: Path;
};

const useLayout = () => {
  const navItems: NavItem[] = [
    { name: "Dashboard", icon: ChartPie, path: "/" },
    { name: "Employees", icon: Users, path: "/employees" },
  ];

  return { navItems };
};

export default useLayout;
