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
  CheckSquare,
  X,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Candidates', href: '/candidates', icon: Users },
  { name: 'Pipeline', href: '/pipeline', icon: Kanban },
  { name: 'Interviews', href: '/interviews', icon: Calendar },
  { name: 'Activities', href: '/activities', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

// CGP Personnel Logo Component
function CGPLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 40" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Angular Arrow Icon */}
      <g transform="translate(0, 3)">
        <polygon points="0,17 17,0 24,0 24,34 17,34 17,12 5,24" fill="#C41E3A"/>
        <polygon points="17,34 24,34 24,17 17,24" fill="#9A1830"/>
      </g>
      {/* CGP Text */}
      <text x="32" y="28" fontFamily="Inter, Arial, sans-serif" fontWeight="800" fontSize="22" fill="#1A1A1A">CGP</text>
      {/* Personnel Text */}
      <text x="82" y="28" fontFamily="Inter, Arial, sans-serif" fontWeight="800" fontSize="22" fill="#C41E3A">Personnel</text>
    </svg>
  );
}

// Compact logo for mobile
function CGPLogoCompact({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 40" className={className} xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(5, 3)">
        <polygon points="0,17 17,0 24,0 24,34 17,34 17,12 5,24" fill="#C41E3A"/>
        <polygon points="17,34 24,34 24,17 17,24" fill="#9A1830"/>
      </g>
    </svg>
  );
}

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
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 shadow-sm transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200">
          <CGPLogo className="h-8 w-auto" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                  active
                    ? 'bg-cgp-red text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-500'}`} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 bg-cgp-red rounded-full flex items-center justify-center shadow-sm">
              <span className="text-sm font-semibold text-white">S</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Shawn</p>
              <p className="text-xs text-slate-500">CGP Personnel</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200 flex items-center px-4 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:text-cgp-red hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <CGPLogoCompact className="h-8 w-auto" />
            <span className="font-bold text-lg">
              <span className="text-slate-800">CGP</span>
              <span className="text-cgp-red">Personnel</span>
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
