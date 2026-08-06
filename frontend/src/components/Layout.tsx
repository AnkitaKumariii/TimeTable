import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen, CalendarDays, ChevronLeft, ChevronRight,
  Clock, GraduationCap, LogOut, Settings, Users,
} from 'lucide-react';

export function Layout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  function logout() {
    localStorage.removeItem('nitatime_token');
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`flex-shrink-0 flex flex-col border-r border-slate-200 bg-white
                   transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}
        style={{ position: 'sticky', top: 0, height: '100vh' }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-4 py-4 border-b border-slate-200
                        ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center flex-shrink-0">
            <CalendarDays size={15} className="text-brand-600" />
          </div>
          {!collapsed && (
            <span className="font-bold text-slate-900 text-sm tracking-tight">NitaTime</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <NavLink to="/timetable" className={({ isActive }) =>
            `nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
          }>
            <CalendarDays size={16} />
            {!collapsed && 'Timetable'}
          </NavLink>

          {/* Settings group */}
          {!collapsed && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 pt-4 pb-1">
              Settings
            </p>
          )}
          {collapsed && <div className="border-t border-slate-200 my-2" />}

          <NavLink to="/settings/batches" className={({ isActive }) =>
            `nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
          }>
            <GraduationCap size={16} />
            {!collapsed && 'Batches'}
          </NavLink>
          <NavLink to="/settings/subjects" className={({ isActive }) =>
            `nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
          }>
            <BookOpen size={16} />
            {!collapsed && 'Subjects'}
          </NavLink>
          <NavLink to="/settings/faculty" className={({ isActive }) =>
            `nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
          }>
            <Users size={16} />
            {!collapsed && 'Faculty'}
          </NavLink>
          <NavLink to="/settings/time-slots" className={({ isActive }) =>
            `nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
          }>
            <Clock size={16} />
            {!collapsed && 'Time Slots'}
          </NavLink>
          <NavLink to="/settings/days" className={({ isActive }) =>
            `nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
          }>
            <Settings size={16} />
            {!collapsed && 'Active Days'}
          </NavLink>
        </nav>

        {/* Footer */}
        <div className={`p-2 border-t border-slate-200 flex flex-col gap-1`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`nav-link justify-${collapsed ? 'center' : 'start'}`}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && 'Collapse'}
          </button>
          <button
            onClick={logout}
            className={`nav-link text-red-600 hover:text-red-700 hover:bg-red-50
                       ${collapsed ? 'justify-center px-2' : ''}`}
          >
            <LogOut size={16} />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
