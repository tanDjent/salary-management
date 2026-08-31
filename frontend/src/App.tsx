import { Route, Routes } from "react-router-dom";

import AppLayout from "./app/layout/AppLayout";
import Dashboard from "./app/pages/Dashboard/Dashboard";
import Employees from "./app/pages/Employees/Employees";

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
      </Route>
    </Routes>
  );
}

export default App;
