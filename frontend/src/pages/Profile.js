import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api, { formatApiError } from '../lib/api';
import { 
  User, Mail, Shield, Calendar, Layers, Wrench, 
  Settings, CheckCircle, Clock
} from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [fullUserData, setFullUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await api.get('/auth/me');
      setFullUserData(response.data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

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

  const getRoleColor = (role) => {
    const colors = {
      'direction': 'text-[#FF3B30]',
      'conduc': 'text-zinc-200',
      'viewer': 'text-zinc-400',
      'mag': 'text-zinc-300',
      'chef_de_file': 'text-zinc-200',
      'responsable_securite': 'text-zinc-300',
      'validateur': 'text-zinc-300'
    };
    return colors[role] || 'text-zinc-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#FF3B30]/30 border-t-[#FF3B30] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="profile-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mon Profil</h1>
        <p className="text-zinc-400 mt-1">Gérez vos informations et consultez vos accès</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Info Card */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-white/[0.08] flex items-center justify-center">
              <span className="text-2xl font-bold">
                {fullUserData?.prenom?.[0]}{fullUserData?.nom?.[0]}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {fullUserData?.prenom} {fullUserData?.nom}
              </h2>
              <span className={`badge ${getRoleBadgeClass(fullUserData?.role_global)}`}>
                {getRoleLabel(fullUserData?.role_global)}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Mail size={18} className="text-zinc-400" />
              <span>{fullUserData?.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield size={18} className="text-zinc-400" />
              <span>Rôle global: <span className="font-medium">{getRoleLabel(fullUserData?.role_global)}</span></span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar size={18} className="text-zinc-400" />
              <span>Membre depuis: {new Date(fullUserData?.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle size={18} className={fullUserData?.is_active ? 'text-emerald-400' : 'text-red-400'} />
              <span>Statut: {fullUserData?.is_active ? 'Actif' : 'Inactif'}</span>
            </div>
          </div>
        </div>

        {/* Pôles Assignés */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Layers size={20} className="text-zinc-400" />
            Mes Pôles
            <span className="text-sm text-zinc-500 font-normal">
              ({fullUserData?.domaines?.length || 0})
            </span>
          </h3>

          {fullUserData?.role_global === 'direction' ? (
            <div className="p-4 rounded-lg bg-[#FF3B30]/10 border border-[#FF3B30]/20">
              <p className="text-sm text-[#FF3B30]">
                En tant que Direction, vous avez accès à tous les pôles.
              </p>
            </div>
          ) : fullUserData?.domaines?.length > 0 ? (
            <div className="space-y-3">
              {fullUserData.domaines.map((domaine) => (
                <div 
                  key={domaine.domaine_id} 
                  className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/[0.04]">
                      <Layers size={16} className="text-zinc-400" />
                    </div>
                    <div>
                      <p className="font-medium">{domaine.domaine_nom}</p>
                      <p className="text-xs text-zinc-500">Pôle assigné</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              <Layers size={32} className="mx-auto mb-2 opacity-50" />
              <p>Aucun pôle assigné</p>
            </div>
          )}
        </div>

        {/* Outils Assignés */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wrench size={20} className="text-zinc-400" />
            Mes Outils
            <span className="text-sm text-zinc-500 font-normal">
              ({fullUserData?.outils?.length || 0})
            </span>
          </h3>

          {fullUserData?.role_global === 'direction' ? (
            <div className="p-4 rounded-lg bg-[#FF3B30]/10 border border-[#FF3B30]/20">
              <p className="text-sm text-[#FF3B30]">
                En tant que Direction, vous avez accès à tous les outils.
              </p>
            </div>
          ) : fullUserData?.outils?.length > 0 ? (
            <div className="space-y-3">
              {fullUserData.outils.map((outil) => (
                <div 
                  key={outil.outil_id} 
                  className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/[0.04]">
                        <Settings size={16} className="text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-medium">{outil.outil_nom}</p>
                        <p className="text-xs text-zinc-500">Outil assigné</p>
                      </div>
                    </div>
                    <span className={`badge ${getRoleColor(outil.role)}`}>
                      {outil.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              <Wrench size={32} className="mx-auto mb-2 opacity-50" />
              <p>Aucun outil assigné</p>
            </div>
          )}
        </div>
      </div>

      {/* Access Summary */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield size={20} className="text-[#FF3B30]" />
          Résumé de mes accès
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <p className="text-sm text-zinc-400 mb-1">Niveau d'accès</p>
            <p className="text-lg font-semibold">
              {fullUserData?.role_global === 'direction' ? 'ALL_ACCESS' :
               fullUserData?.role_global === 'encadrant' ? 'LIMITED_ACCESS' : 'TOOL_ACCESS'}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <p className="text-sm text-zinc-400 mb-1">Pôles accessibles</p>
            <p className="text-lg font-semibold">
              {fullUserData?.role_global === 'direction' ? 'Tous' : fullUserData?.domaines?.length || 0}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <p className="text-sm text-zinc-400 mb-1">Outils accessibles</p>
            <p className="text-lg font-semibold">
              {fullUserData?.role_global === 'direction' ? 'Tous' : fullUserData?.outils?.length || 0}
            </p>
          </div>
        </div>

        {/* Permissions based on role */}
        <div className="mt-6">
          <p className="text-sm text-zinc-400 mb-3">Ce que vous pouvez faire :</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {fullUserData?.role_global === 'direction' && (
              <>
                <PermissionItem text="Gérer tous les utilisateurs" allowed />
                <PermissionItem text="Créer et gérer les pôles" allowed />
                <PermissionItem text="Créer et gérer les outils" allowed />
                <PermissionItem text="Assigner les rôles" allowed />
                <PermissionItem text="Consulter les audit logs" allowed />
                <PermissionItem text="Accéder à tous les outils" allowed />
              </>
            )}
            {fullUserData?.role_global === 'encadrant' && (
              <>
                <PermissionItem text="Créer des utilisateurs (Users)" allowed />
                <PermissionItem text="Assigner des rôles outils" allowed />
                <PermissionItem text="Accéder aux outils de ses pôles" allowed />
                <PermissionItem text="Créer des pôles" allowed={false} />
                <PermissionItem text="Créer des Encadrants" allowed={false} />
                <PermissionItem text="Consulter les audit logs" allowed={false} />
              </>
            )}
            {fullUserData?.role_global === 'user' && (
              <>
                <PermissionItem text="Accéder aux outils assignés" allowed />
                <PermissionItem text="Consulter les pôles" allowed />
                <PermissionItem text="Gérer les utilisateurs" allowed={false} />
                <PermissionItem text="Créer des pôles/outils" allowed={false} />
                <PermissionItem text="Assigner des rôles" allowed={false} />
                <PermissionItem text="Consulter les audit logs" allowed={false} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionItem({ text, allowed }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${allowed ? 'text-white' : 'text-zinc-500'}`}>
      {allowed ? (
        <CheckCircle size={16} className="text-emerald-400" />
      ) : (
        <span className="w-4 h-4 rounded-full border border-zinc-600 flex items-center justify-center">
          <span className="text-xs">✕</span>
        </span>
      )}
      <span>{text}</span>
    </div>
  );
}
