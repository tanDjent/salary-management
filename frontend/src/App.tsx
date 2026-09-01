import { Route, Routes } from "react-router-dom";

import AppLayout from "./app/layout/AppLayout";
import Dashboard from "./app/pages/Dashboard/Dashboard";
import Employees from "./app/pages/Employees/Employees";
import NotFound from "./app/pages/NotFound/NotFound";

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        {/* Vercel rewrites every unknown path to index.html so deep links work,
            which means an address like /employeez reaches the router rather
            than the host. Without this it would render an empty layout. */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
