import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi, formatApiError } from '../lib/api';
import { Users, Layers, Wrench, FileText, Activity, Clock } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardApi.getStats();
      setStats(response.data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionLabel = (action) => {
    const labels = {
      login: 'Connexion',
      register: 'Inscription',
      create_user: 'Création utilisateur',
      update_user: 'Modification utilisateur',
      delete_user: 'Suppression utilisateur',
      create_domaine: 'Création domaine',
      update_domaine: 'Modification domaine',
      delete_domaine: 'Suppression domaine',
      create_outil: 'Création outil',
      update_outil: 'Modification outil',
      delete_outil: 'Suppression outil',
      assign_user_domaine: 'Assignation domaine',
      unassign_user_domaine: 'Retrait domaine',
      assign_user_outil: 'Assignation outil',
      update_user_outil_role: 'Modification rôle',
      unassign_user_outil: 'Retrait outil'
    };
    return labels[action] || action;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#FF3B30]/30 border-t-[#FF3B30] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bienvenue, {user?.prenom} !
        </h1>
        <p className="text-zinc-400 mt-1">
          Voici un aperçu de votre espace de travail
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Utilisateurs"
          value={stats?.total_users || 0}
          accent={true}
        />
        <StatCard
          icon={Layers}
          label="Domaines"
          value={stats?.total_domaines || 0}
        />
        <StatCard
          icon={Wrench}
          label="Outils"
          value={stats?.total_outils || 0}
        />
        <StatCard
          icon={FileText}
          label="Documents"
          value={stats?.total_documents || 0}
        />
      </div>

      {/* Recent Activity */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-[#FF3B30]/10">
            <Activity size={20} className="text-[#FF3B30]" />
          </div>
          <h2 className="text-lg font-semibold">Activité récente</h2>
        </div>

        {stats?.recent_activity?.length > 0 ? (
          <div className="space-y-3">
            {stats.recent_activity.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="p-2 rounded-lg bg-white/[0.04]">
                  <Clock size={16} className="text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {getActionLabel(log.action)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    par {log.user_nom || 'Système'}
                  </p>
                </div>
                <span className="text-xs text-zinc-500 mono">
                  {formatTimestamp(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-center py-8">
            Aucune activité récente
          </p>
        )}
      </div>

      {/* Quick Info for User */}
      {user?.role_global === 'user' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4">Mes Domaines</h3>
            {user?.domaines?.length > 0 ? (
              <ul className="space-y-2">
                {user.domaines.map((d) => (
                  <li key={d.domaine_id} className="flex items-center gap-2 text-sm">
                    <Layers size={16} className="text-zinc-400" />
                    {d.domaine_nom}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500 text-sm">Aucun domaine assigné</p>
            )}
          </div>
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4">Mes Outils</h3>
            {user?.outils?.length > 0 ? (
              <ul className="space-y-2">
                {user.outils.map((o) => (
                  <li key={o.outil_id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Wrench size={16} className="text-zinc-400" />
                      {o.outil_nom}
                    </span>
                    <span className="badge">{o.role}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500 text-sm">Aucun outil assigné</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="glass-card p-5 transition-all duration-300 hover:scale-[1.02]" data-testid={`stat-${label.toLowerCase()}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-400 text-sm">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div 
          className={`p-3 rounded-xl ${accent ? 'bg-[#FF3B30]/10' : 'bg-white/[0.04]'}`}
        >
          <Icon size={24} className={accent ? 'text-[#FF3B30]' : 'text-zinc-400'} />
        </div>
      </div>
    </div>
  );
}
