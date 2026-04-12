import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  FileBox,
  Users as UsersIcon,
  ShieldCheck,
  ClipboardList,
  FileSignature,
  FilePlus,
  Scale,
  X,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { usePermission } from '../../hooks/usePermission';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  labelKey: string;
  permission?: string;
}

export default function Sidebar() {
  const { t } = useTranslation();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { can } = usePermission();

  const navItems: NavItem[] = [
    { to: '/', icon: <LayoutDashboard size={20} />, labelKey: 'nav.dashboard' },
    { to: '/projects', icon: <FolderKanban size={20} />, labelKey: 'nav.projects', permission: 'project:read' },
    { to: '/dtao', icon: <FileText size={20} />, labelKey: 'nav.dtao', permission: 'dtao:create' },
    { to: '/bids', icon: <FileBox size={20} />, labelKey: 'nav.bids', permission: 'bid:register' },
    { to: '/ccc', icon: <Scale size={20} />, labelKey: 'nav.ccc', permission: 'ccc:read' },
    { to: '/contracts', icon: <FileSignature size={20} />, labelKey: 'nav.contracts', permission: 'contract:read' },
    { to: '/avenants', icon: <FilePlus size={20} />, labelKey: 'nav.avenants', permission: 'avenant:read' },
    { to: '/users', icon: <UsersIcon size={20} />, labelKey: 'nav.users', permission: 'user:read' },
    { to: '/roles', icon: <ShieldCheck size={20} />, labelKey: 'nav.roles', permission: 'role:read' },
    { to: '/audit', icon: <ClipboardList size={20} />, labelKey: 'nav.audit', permission: 'audit:read' },
  ];

  const visibleItems = navItems.filter(
    (item) => !item.permission || can(item.permission)
  );

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-sonatrach-navy text-white transform transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } rtl:left-auto rtl:right-0 rtl:translate-x-full rtl:lg:translate-x-0 ${
          sidebarOpen ? 'rtl:translate-x-0' : ''
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sonatrach-orange rounded-lg flex items-center justify-center font-bold text-lg">
              S
            </div>
            <div>
              <h1 className="text-base font-bold">SonaERP</h1>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">v5.0</p>
            </div>
          </div>
          <button
            className="lg:hidden p-1 rounded hover:bg-white/10"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-3 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sonatrach-orange text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.icon}
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-4 left-0 right-0 px-5">
          <div className="text-[10px] text-white/30 text-center">
            Sonatrach &copy; {new Date().getFullYear()}
          </div>
        </div>
      </aside>
    </>
  );
}
