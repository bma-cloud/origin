import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Layers,
  Wrench,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',    roles: ['direction', 'encadrant', 'user'] },
  { to: '/users',      icon: Users,           label: 'Utilisateurs', roles: ['direction', 'encadrant'] },
  { to: '/domaines',   icon: Layers,          label: 'Pôles',        roles: ['direction', 'encadrant', 'user'] },
  { to: '/outils',     icon: Wrench,          label: 'Outils',       roles: ['direction', 'encadrant', 'user'] },
  { to: '/audit-logs', icon: FileText,        label: 'Audit Logs',   roles: ['direction'] },
  { to: '/profile',    icon: User,            label: 'Mon Profil',   roles: ['direction', 'encadrant', 'user'] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter(item =>
    item.roles.includes(user?.role_global)
  );

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'direction': return 'badge-direction';
      case 'encadrant': return 'badge-encadrant';
      default: return 'badge-user';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'direction': return 'Direction';
      case 'encadrant': return 'Encadrant';
      default: return 'Utilisateur';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f4f5]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#e4e4e7]
          transform transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-5 border-b border-[#e4e4e7]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#D32F2F] flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-xs tracking-tight">ITS</span>
              </div>
              <div>
                <span className="font-bold text-[#09090b] text-sm tracking-tight">Origin</span>
                <span className="block text-[10px] text-[#71717a] leading-none">BTP Manager</span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-[#71717a] hover:text-[#09090b] rounded-md hover:bg-[#f4f4f5]"
              data-testid="close-sidebar-btn"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `sidebar-link group ${isActive ? 'active' : ''}`
                }
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon size={17} />
                <span>{item.label}</span>
                <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          <div className="p-3 border-t border-[#e4e4e7]">
            <div className="flex items-center gap-3 px-2 py-2.5 mb-1 rounded-lg bg-[#f4f4f5]">
              <div className="w-8 h-8 rounded-full bg-[#D32F2F]/10 border border-[#D32F2F]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[#D32F2F]">
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#09090b] truncate">
                  {user?.prenom} {user?.nom}
                </p>
                <span className={`badge ${getRoleBadgeClass(user?.role_global)}`}>
                  {getRoleLabel(user?.role_global)}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-[#71717a] hover:text-[#D32F2F] hover:bg-[#D32F2F]/05 rounded-lg transition-colors"
              data-testid="logout-btn"
            >
              <LogOut size={16} />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-[#e4e4e7] bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-[#71717a] hover:text-[#09090b] rounded-md hover:bg-[#f4f4f5]"
            data-testid="open-sidebar-btn"
          >
            <Menu size={20} />
          </button>
          <div className="hidden lg:block" />
          <div className="text-sm text-[#71717a]">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
