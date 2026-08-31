const Topbar = () => {
  return (
    <header className="flex h-14 items-center justify-end border-b border-gray-100 bg-white p-4 lg:px-6">
      <div className="flex items-center gap-3">
        <div className="hidden flex-col items-end md:flex">
          <span className="text-sm font-medium leading-tight">Priya Raman</span>
          <span className="text-xs leading-tight text-gray-500">HR Manager</span>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm font-medium text-violet-700">
          PR
        </span>
      </div>
    </header>
  );
};

export default Topbar;
