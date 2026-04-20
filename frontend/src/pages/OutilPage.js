import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { outilsApi, formatApiError } from '../lib/api';
import { 
  ArrowLeft, Settings, Users, Shield, AlertCircle, 
  CheckCircle, Lock, FileText, Calendar, Clock, UserCircle
} from 'lucide-react';

export default function OutilPage() {
  const { outilId } = useParams();
  const navigate = useNavigate();
  const { user, isDirection, isEncadrant } = useAuth();
  const [outil, setOutil] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasAccess, setHasAccess] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [isUsing, setIsUsing] = useState(false);
  const canViewUsers = isDirection || isEncadrant;

  useEffect(() => {
    fetchOutil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outilId]);

  const fetchOutil = async () => {
    try {
      // Get outil details
      const outilRes = await api.get(`/outils`);
      const foundOutil = outilRes.data.find(o => o.id === outilId);
      
      if (!foundOutil) {
        setError('Outil non trouvé');
        setLoading(false);
        return;
      }
      
      setOutil(foundOutil);
      
      // Check access
      // Direction has access to all
      if (user?.role_global === 'direction') {
        setHasAccess(true);
        setUserRole('direction (accès total)');
      } else {
        // Check if user has this outil assigned
        const userOutil = user?.outils?.find(o => o.outil_id === outilId);
        if (userOutil) {
          setHasAccess(true);
          setUserRole(userOutil.role);
        } else {
          setHasAccess(false);
          setUserRole(null);
        }
      }

      // Fetch assigned users if user can view them
      if (canViewUsers) {
        try {
          const usersRes = await outilsApi.getUsers(outilId);
          setAssignedUsers(usersRes.data);
        } catch (err) {
          // Silently fail - user might not have access
          console.log('Could not fetch assigned users');
        }
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUseOutil = () => {
    if (!hasAccess) return;

    if (outil?.type === 'flowchantier') {
      window.open(`/outils/${outilId}/flowchantier`, '_blank');
      return;
    }

    setIsUsing(true);
  };

  const getRoleColor = (role) => {
    const colors = {
      'direction (accès total)': 'text-[#FF3B30]',
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

  const getRolePermissions = (role) => {
    const permissions = {
      'direction (accès total)': ['Lecture', 'Écriture', 'Modification', 'Suppression', 'Administration'],
      'conduc': ['Lecture', 'Écriture', 'Modification'],
      'viewer': ['Lecture seule'],
      'mag': ['Lecture', 'Écriture', 'Gestion stock'],
      'chef_de_file': ['Lecture', 'Écriture', 'Coordination équipe'],
      'responsable_securite': ['Lecture', 'Écriture', 'Validation sécurité'],
      'validateur': ['Lecture', 'Validation']
    };
    return permissions[role] || ['Lecture seule'];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#FF3B30]/30 border-t-[#FF3B30] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button
          onClick={() => navigate('/outils')}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Retour aux outils</span>
        </button>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="outil-page">
      {/* Back button */}
      <button
        onClick={() => navigate('/outils')}
        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        data-testid="back-to-outils"
      >
        <ArrowLeft size={20} />
        <span>Retour aux outils</span>
      </button>

      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-500/20 to-zinc-500/5 border border-zinc-500/10">
              <Settings size={32} className="text-zinc-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{outil?.nom}</h1>
              <p className="text-zinc-400">Domaine: {outil?.domaine_nom}</p>
            </div>
          </div>
          
          {/* Access Status */}
          <div className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
            hasAccess 
              ? 'bg-emerald-500/10 border border-emerald-500/20' 
              : 'bg-red-500/10 border border-red-500/20'
          }`}>
            {hasAccess ? (
              <>
                <CheckCircle size={20} className="text-emerald-400" />
                <div>
                  <p className="text-sm text-emerald-400 font-medium">Accès autorisé</p>
                  <p className={`text-xs ${getRoleColor(userRole)}`}>Rôle: {userRole}</p>
                </div>
              </>
            ) : (
              <>
                <Lock size={20} className="text-red-400" />
                <div>
                  <p className="text-sm text-red-400 font-medium">Accès refusé</p>
                  <p className="text-xs text-zinc-500">Vous n'êtes pas assigné à cet outil</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Tool Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Use Tool Section */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings size={20} className="text-[#FF3B30]" />
              Utiliser l'outil
            </h2>
            
            {hasAccess ? (
              <>
                {!isUsing ? (
                  <div className="text-center py-8">
                    <p className="text-zinc-400 mb-6">
                      Vous avez accès à cet outil avec le rôle <span className={`font-medium ${getRoleColor(userRole)}`}>{userRole}</span>
                    </p>
                    <button
                      onClick={handleUseOutil}
                      className="btn-primary px-8 py-3 text-lg font-medium animate-pulse-glow"
                      data-testid="use-outil-btn"
                    >
                      Utiliser cet outil
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400 mb-4">
                      <CheckCircle size={20} />
                      <span className="font-medium">Outil activé</span>
                    </div>
                    
                    {/* Simulated Tool Interface */}
                    <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.06]">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-3 bg-white/[0.02] rounded-lg">
                          <p className="text-xs text-zinc-500 mb-1">Dernière utilisation</p>
                          <p className="text-sm font-mono">{new Date().toLocaleString('fr-FR')}</p>
                        </div>
                        <div className="p-3 bg-white/[0.02] rounded-lg">
                          <p className="text-xs text-zinc-500 mb-1">Session active</p>
                          <p className="text-sm text-emerald-400">● En cours</p>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-[#0a0a0a] rounded-lg border border-white/[0.08]">
                        <p className="text-zinc-400 text-sm">
                          Interface de l'outil <strong>{outil?.nom}</strong> - 
                          Vous êtes connecté en tant que <span className={getRoleColor(userRole)}>{userRole}</span>
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {getRolePermissions(userRole).map((perm) => (
                            <span key={perm} className="badge text-xs">{perm}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setIsUsing(false)}
                      className="btn-secondary px-4 py-2"
                    >
                      Fermer l'outil
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Lock size={32} className="text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-red-400 mb-2">Accès non autorisé</h3>
                <p className="text-zinc-500 max-w-md mx-auto">
                  Vous n'avez pas accès à cet outil. Contactez votre Direction ou Encadrant 
                  pour demander l'assignation.
                </p>
                <button
                  disabled
                  className="mt-6 px-8 py-3 bg-zinc-800 text-zinc-500 rounded-lg cursor-not-allowed"
                  data-testid="use-outil-btn-disabled"
                >
                  Utiliser cet outil
                </button>
              </div>
            )}
          </div>

          {/* Available Roles */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users size={20} className="text-zinc-400" />
              Rôles disponibles pour cet outil
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {outil?.roles_disponibles?.map((role) => {
                // Handle both string and object role formats
                const roleName = typeof role === 'object' ? role.name : role;
                const roleDescription = typeof role === 'object' ? role.description : null;
                const rolePermissions = typeof role === 'object' && role.permissions 
                  ? role.permissions 
                  : getRolePermissions(roleName);
                
                return (
                  <div 
                    key={roleName} 
                    className={`p-3 rounded-lg border ${
                      userRole === roleName 
                        ? 'bg-[#FF3B30]/10 border-[#FF3B30]/30' 
                        : 'bg-white/[0.02] border-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{roleName}</span>
                      {userRole === roleName && (
                        <span className="text-xs text-[#FF3B30]">Votre rôle</span>
                      )}
                    </div>
                    {roleDescription && (
                      <p className="text-xs text-zinc-500 mt-1">{roleDescription}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(Array.isArray(rolePermissions) ? rolePermissions : []).map((perm) => (
                        <span key={perm} className="text-xs text-zinc-500">{perm}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assigned Users Section (for Direction/Encadrant) */}
          {canViewUsers && assignedUsers.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserCircle size={20} className="text-zinc-400" />
                Utilisateurs assignés
                <span className="text-sm text-zinc-500 font-normal">({assignedUsers.length})</span>
              </h2>
              <div className="space-y-3">
                {assignedUsers.map((assignedUser) => (
                  <div 
                    key={assignedUser.user_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {assignedUser.prenom?.[0]}{assignedUser.nom?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{assignedUser.prenom} {assignedUser.nom}</p>
                        <p className="text-xs text-zinc-500">{assignedUser.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`badge ${getRoleColor(assignedUser.outil_role)}`}>
                        {assignedUser.outil_role}
                      </span>
                      <p className="text-xs text-zinc-500 mt-1">
                        {assignedUser.role_global === 'encadrant' ? 'Encadrant' : 'User'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right - Info Panel */}
        <div className="space-y-6">
          {/* Your Access Info */}
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Shield size={18} className="text-[#FF3B30]" />
              Vos permissions
            </h3>
            {hasAccess ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Votre rôle</span>
                  <span className={`font-medium ${getRoleColor(userRole)}`}>{userRole}</span>
                </div>
                <div className="border-t border-white/[0.08] pt-3">
                  <p className="text-xs text-zinc-500 mb-2">Permissions actives:</p>
                  <div className="space-y-1">
                    {getRolePermissions(userRole).map((perm) => (
                      <div key={perm} className="flex items-center gap-2 text-sm">
                        <CheckCircle size={14} className="text-emerald-400" />
                        <span>{perm}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Lock size={24} className="mx-auto mb-2 text-zinc-600" />
                <p className="text-sm text-zinc-500">Aucune permission</p>
              </div>
            )}
          </div>

          {/* Tool Info */}
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText size={18} className="text-blue-400" />
              Informations
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">ID</span>
                <span className="font-mono text-xs">{outil?.id?.slice(0, 8)}...</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Domaine</span>
                <span>{outil?.domaine_nom}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Créé le</span>
                <span>{new Date(outil?.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Rôles</span>
                <span>{outil?.roles_disponibles?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
