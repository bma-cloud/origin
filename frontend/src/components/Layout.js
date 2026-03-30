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
  Moon,
  Sun
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['direction', 'encadrant', 'user'] },
  { to: '/users', icon: Users, label: 'Utilisateurs', roles: ['direction', 'encadrant'] },
  { to: '/domaines', icon: Layers, label: 'Domaines', roles: ['direction', 'encadrant', 'user'] },
  { to: '/outils', icon: Wrench, label: 'Outils', roles: ['direction', 'encadrant', 'user'] },
  { to: '/audit-logs', icon: FileText, label: 'Audit Logs', roles: ['direction'] },
  { to: '/profile', icon: User, label: 'Mon Profil', roles: ['direction', 'encadrant', 'user'] }
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('light-mode');
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
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white/[0.02] border-r border-white/[0.08] 
          transform transition-transform duration-300 ease-out backdrop-blur-xl
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FF3B30] flex items-center justify-center">
                <span className="text-white font-bold text-sm">BTP</span>
              </div>
              <span className="font-semibold text-white tracking-tight">Manager</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-zinc-400 hover:text-white"
              data-testid="close-sidebar-btn"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
                <ChevronRight size={16} className="ml-auto opacity-0 group-hover:opacity-100" />
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-white/[0.08]">
            <div className="glass-card p-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {user?.prenom?.[0]}{user?.nom?.[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user?.prenom} {user?.nom}
                  </p>
                  <span className={`badge ${getRoleBadgeClass(user?.role_global)}`}>
                    {getRoleLabel(user?.role_global)}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors"
              data-testid="logout-btn"
            >
              <LogOut size={18} />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-white/[0.08] bg-[#0a0a0a]/80 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-zinc-400 hover:text-white"
            data-testid="open-sidebar-btn"
          >
            <Menu size={24} />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
              data-testid="dark-mode-toggle"
              title={darkMode ? 'Mode clair' : 'Mode sombre'}
            >
              {darkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-blue-400" />}
            </button>
            <div className="text-sm text-zinc-400">
              {new Date().toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
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
