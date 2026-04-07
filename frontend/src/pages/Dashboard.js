import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi, formatApiError } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Building2, Users, Wrench, Layers,
  CheckCircle2, Clock, AlertCircle, Activity,
  TrendingUp, HardHat
} from 'lucide-react';

const ACTION_LABELS = {
  login: 'Connexion',
  register: 'Inscription',
  create_user: 'Création utilisateur',
  update_user: 'Modification utilisateur',
  delete_user: 'Suppression utilisateur',
  create_domaine: 'Création pôle',
  update_domaine: 'Modification pôle',
  delete_domaine: 'Suppression pôle',
  create_outil: 'Création outil',
  update_outil: 'Modification outil',
  delete_outil: 'Suppression outil',
  assign_user_domaine: 'Assignation pôle',
  unassign_user_domaine: 'Retrait pôle',
  assign_user_outil: 'Assignation outil',
  update_user_outil_role: 'Modification rôle',
  unassign_user_outil: 'Retrait outil',
};

function formatTs(ts) {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    dashboardApi.getStats()
      .then(r => setStats(r.data))
      .catch(e => setError(formatApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#D32F2F]/20 border-t-[#D32F2F] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#09090b]">
          Bonjour, {user?.prenom} !
        </h1>
        <p className="text-[#71717a] text-sm mt-0.5">
          Vue d'ensemble de la production ITS
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* KPI row — chantiers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Building2}
          label="Chantiers actifs"
          value={stats?.total_chantiers ?? 0}
          accent
        />
        <KpiCard
          icon={AlertCircle}
          label="Sans Chef de File"
          value={stats?.chantiers_sans_cf ?? 0}
          warning={stats?.chantiers_sans_cf > 0}
        />
        <KpiCard
          icon={Clock}
          label="Étapes en cours"
          value={stats?.etapes_en_cours ?? 0}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Étapes terminées"
          value={stats?.etapes_terminees ?? 0}
          success
        />
      </div>

      {/* Secondary row — organization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity feed */}
        <Card className="lg:col-span-2 border-[#e4e4e7]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[#D32F2F]" />
              <CardTitle className="text-base text-[#09090b]">Activité récente</CardTitle>
            </div>
            <CardDescription>Dernières actions sur la plateforme</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {stats?.recent_activity?.length > 0 ? (
              <div className="divide-y divide-[#f4f4f5]">
                {stats.recent_activity.map(log => (
                  <div key={log.id} className="flex items-center gap-3 px-6 py-3 hover:bg-[#fafafa] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-[#f4f4f5] flex items-center justify-center flex-shrink-0">
                      <Activity size={14} className="text-[#71717a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#09090b] truncate">
                        {ACTION_LABELS[log.action] || log.action}
                      </p>
                      <p className="text-xs text-[#71717a]">par {log.user_nom}</p>
                    </div>
                    <span className="text-xs text-[#a1a1aa] mono flex-shrink-0">{formatTs(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-[#71717a]">
                Aucune activité récente
              </div>
            )}
          </CardContent>
        </Card>

        {/* Org stats */}
        <Card className="border-[#e4e4e7]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-[#D32F2F]" />
              <CardTitle className="text-base text-[#09090b]">Organisation</CardTitle>
            </div>
            <CardDescription>Structure ITS Origin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: Users,    label: 'Utilisateurs', value: stats?.total_users    ?? 0 },
              { icon: Layers,   label: 'Pôles',        value: stats?.total_domaines ?? 0 },
              { icon: Wrench,   label: 'Outils',       value: stats?.total_outils   ?? 0 },
              { icon: HardHat,  label: 'Chantiers',    value: stats?.total_chantiers ?? 0 },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-[#f4f4f5] last:border-0">
                <div className="flex items-center gap-2 text-sm text-[#71717a]">
                  <Icon size={15} className="text-[#a1a1aa]" />
                  {label}
                </div>
                <span className="font-semibold text-sm text-[#09090b]">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* User quick info */}
      {user?.role_global === 'user' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-[#e4e4e7]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-[#09090b]">Mes Pôles</CardTitle>
            </CardHeader>
            <CardContent>
              {user?.domaines?.length > 0 ? (
                <ul className="space-y-2">
                  {user.domaines.map(d => (
                    <li key={d.domaine_id} className="flex items-center gap-2 text-sm text-[#374151]">
                      <Layers size={14} className="text-[#71717a]" />
                      {d.domaine_nom}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#71717a]">Aucun pôle assigné</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-[#e4e4e7]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-[#09090b]">Mes Outils</CardTitle>
            </CardHeader>
            <CardContent>
              {user?.outils?.length > 0 ? (
                <ul className="space-y-2">
                  {user.outils.map(o => (
                    <li key={o.outil_id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-[#374151]">
                        <Wrench size={14} className="text-[#71717a]" />
                        {o.outil_nom}
                      </span>
                      <Badge variant="outline" className="text-[10px] text-[#71717a] border-[#e4e4e7]">
                        {o.role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#71717a]">Aucun outil assigné</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent, warning, success }) {
  const iconBg  = accent  ? 'bg-[#D32F2F]/08 text-[#D32F2F]'
                : warning ? 'bg-amber-50 text-amber-600'
                : success ? 'bg-emerald-50 text-emerald-600'
                :           'bg-[#f4f4f5] text-[#71717a]';
  const valColor = accent  ? 'text-[#D32F2F]'
                 : warning && value > 0 ? 'text-amber-600'
                 : success ? 'text-emerald-600'
                 :           'text-[#09090b]';

  return (
    <Card className="border-[#e4e4e7]" data-testid={`stat-${label.toLowerCase()}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[#71717a] font-medium mb-1">{label}</p>
            <p className={`text-3xl font-bold ${valColor}`}>{value}</p>
          </div>
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
