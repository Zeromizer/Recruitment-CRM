import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Kanban,
  Calendar,
  Activity,
  Settings,
  Menu,
  Briefcase,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Candidates', href: '/candidates', icon: Users },
  { name: 'Pipeline', href: '/pipeline', icon: Kanban },
  { name: 'Interviews', href: '/interviews', icon: Calendar },
  { name: 'Activities', href: '/activities', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-navy-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-navy-900 border-r border-navy-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-navy-800">
          <div className="w-8 h-8 bg-coral-500 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-xl text-white">Recruiter CRM</span>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active
                    ? 'bg-coral-500/10 text-coral-400'
                    : 'text-navy-300 hover:bg-navy-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-coral-400' : ''}`} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-navy-800">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 bg-navy-700 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">S</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Shawn</p>
              <p className="text-xs text-navy-400">Cornerstone GP</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 h-16 bg-navy-900/95 backdrop-blur border-b border-navy-800 flex items-center px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-navy-300 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 ml-4">
            <div className="w-8 h-8 bg-coral-500 rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-lg text-white">Recruiter CRM</span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
