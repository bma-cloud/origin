import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { outilsApi, domainesApi, usersApi, formatApiError } from '../lib/api';
import { 
  Plus, Search, Edit2, Trash2, Users, Layers,
  AlertCircle, UserPlus, X, Settings, Play, Lock,
  ChevronDown, ChevronUp, UserCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

export default function Outils() {
  const navigate = useNavigate();
  const { user, isDirection, isEncadrant } = useAuth();
  const canManage = isDirection || isEncadrant;
  
  // Check if user has access to a specific outil
  const hasAccessToOutil = (outilId) => {
    if (isDirection) return true;
    return user?.outils?.some(o => o.outil_id === outilId);
  };
  
  const getUserRoleForOutil = (outilId) => {
    if (isDirection) return 'direction';
    const userOutil = user?.outils?.find(o => o.outil_id === outilId);
    return userOutil?.role || null;
  };
  
  const [outils, setOutils] = useState([]);
  const [domaines, setDomaines] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [outilUsers, setOutilUsers] = useState({}); // Store users per outil
  const [expandedOutil, setExpandedOutil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingOutil, setEditingOutil] = useState(null);
  const [assigningOutil, setAssigningOutil] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  
  const [formData, setFormData] = useState({
    nom: '',
    domaine_id: '',
    roles_disponibles: ['viewer']
  });
  const [rolesInput, setRolesInput] = useState('viewer');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [outilsRes, domainesRes, usersRes] = await Promise.all([
        outilsApi.getAll(),
        domainesApi.getAll(),
        usersApi.getAll().catch(() => ({ data: [] }))
      ]);
      setOutils(outilsRes.data);
      setDomaines(domainesRes.data);
      setAllUsers(usersRes.data);
      
      // Fetch users for each outil if user can manage
      if (canManage) {
        const usersMap = {};
        for (const outil of outilsRes.data) {
          try {
            const res = await outilsApi.getUsers(outil.id);
            usersMap[outil.id] = res.data;
          } catch {
            usersMap[outil.id] = [];
          }
        }
        setOutilUsers(usersMap);
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingOutil(null);
    setFormData({
      nom: '',
      domaine_id: domaines[0]?.id || '',
      roles_disponibles: ['viewer']
    });
    setRolesInput('viewer');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (outil) => {
    setEditingOutil(outil);
    setFormData({
      nom: outil.nom,
      domaine_id: outil.domaine_id,
      roles_disponibles: outil.roles_disponibles || ['viewer']
    });
    setRolesInput((outil.roles_disponibles || ['viewer']).join(', '));
    setFormError('');
    setIsModalOpen(true);
  };

  const openAssignModal = (outil) => {
    setAssigningOutil(outil);
    setSelectedUserId('');
    setSelectedRole(outil.roles_disponibles?.[0] || 'viewer');
    setFormError('');
    setIsAssignModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const roles = rolesInput.split(',').map(r => r.trim()).filter(r => r);
    if (roles.length === 0) {
      setFormError('Au moins un rôle est requis');
      setFormLoading(false);
      return;
    }

    const submitData = { ...formData, roles_disponibles: roles };

    try {
      if (editingOutil) {
        await outilsApi.update(editingOutil.id, { nom: submitData.nom, roles_disponibles: roles });
      } else {
        await outilsApi.create(submitData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleAssignUser = async (e) => {
    e.preventDefault();
    if (!selectedUserId || !selectedRole) return;
    
    setFormError('');
    setFormLoading(true);

    try {
      await outilsApi.assignUser(assigningOutil.id, selectedUserId, selectedRole);
      setIsAssignModalOpen(false);
      fetchData();
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleUnassignUser = async (outilId, userId) => {
    if (!window.confirm('Retirer cet utilisateur de l\'outil ?')) return;
    try {
      await outilsApi.unassignUser(outilId, userId);
      fetchData();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleDelete = async (outilId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet outil ?')) return;
    
    try {
      await outilsApi.delete(outilId);
      fetchData();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const toggleExpand = (outilId) => {
    setExpandedOutil(expandedOutil === outilId ? null : outilId);
  };

  const filteredOutils = outils.filter(o =>
    o.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.domaine_nom?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleColor = (role) => {
    const colors = {
      'direction': 'text-[#FF3B30]',
      'conduc': 'text-blue-400',
      'viewer': 'text-zinc-400',
      'mag': 'text-emerald-400',
      'chef_de_file': 'text-amber-400',
      'responsable_securite': 'text-purple-400',
      'validateur': 'text-cyan-400'
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
    <div className="space-y-6 animate-fade-in" data-testid="outils-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Outils</h1>
          <p className="text-zinc-400 mt-1">Gérez les outils par domaine</p>
        </div>
        {isDirection && (
          <button
            onClick={openCreateModal}
            className="btn-primary px-4 py-2 flex items-center gap-2"
            data-testid="create-outil-btn"
            disabled={domaines.length === 0}
          >
            <Plus size={20} />
            <span>Nouvel outil</span>
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 backdrop-blur-sm">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher un outil..."
          className="w-full pl-12 pr-4 py-3.5 input-field rounded-xl"
          data-testid="outil-search-input"
        />
      </div>

      {/* Outils List */}
      <div className="space-y-4">
        {filteredOutils.map((outil) => {
          const assignedUsers = outilUsers[outil.id] || [];
          const isExpanded = expandedOutil === outil.id;
          
          return (
            <div 
              key={outil.id} 
              className="glass-card overflow-hidden"
              data-testid={`outil-card-${outil.id}`}
            >
              {/* Main content */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/10">
                      <Settings size={24} className="text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{outil.nom}</h3>
                      <div className="flex items-center gap-2 text-sm text-zinc-400 mt-1">
                        <Layers size={14} />
                        <span>{outil.domaine_nom}</span>
                      </div>
                      {/* Roles */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {outil.roles_disponibles?.map((role) => (
                          <span 
                            key={role} 
                            className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {canManage && assignedUsers.length > 0 && (
                      <button
                        onClick={() => toggleExpand(outil.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-all"
                        data-testid={`toggle-users-${outil.id}`}
                      >
                        <UserCircle size={16} />
                        <span>{assignedUsers.length}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={() => openAssignModal(outil)}
                        className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                        title="Assigner utilisateur"
                        data-testid={`assign-outil-${outil.id}`}
                      >
                        <UserPlus size={18} />
                      </button>
                    )}
                    {isDirection && (
                      <>
                        <button
                          onClick={() => openEditModal(outil)}
                          className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-all"
                          title="Modifier"
                          data-testid={`edit-outil-${outil.id}`}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(outil.id)}
                          className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Supprimer"
                          data-testid={`delete-outil-${outil.id}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Use Button */}
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  {hasAccessToOutil(outil.id) ? (
                    <button
                      onClick={() => navigate(`/outils/${outil.id}`)}
                      className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 rounded-xl"
                      data-testid={`use-outil-${outil.id}`}
                    >
                      <Play size={16} />
                      <span>Utiliser</span>
                      {getUserRoleForOutil(outil.id) && (
                        <span className="text-xs opacity-75">({getUserRoleForOutil(outil.id)})</span>
                      )}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2.5 flex items-center justify-center gap-2 bg-zinc-800/50 text-zinc-500 rounded-xl cursor-not-allowed backdrop-blur-sm"
                      data-testid={`locked-outil-${outil.id}`}
                    >
                      <Lock size={16} />
                      <span>Accès refusé</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded users section */}
              {isExpanded && assignedUsers.length > 0 && (
                <div className="border-t border-white/[0.06] bg-white/[0.01] p-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <Users size={16} />
                    Utilisateurs assignés ({assignedUsers.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {assignedUsers.map((assignedUser) => (
                      <div 
                        key={assignedUser.user_id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm group hover:bg-white/[0.04] transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-xs font-medium border border-white/[0.06]">
                            {assignedUser.prenom?.[0]}{assignedUser.nom?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{assignedUser.prenom} {assignedUser.nom}</p>
                            <p className="text-xs text-zinc-500 truncate">{assignedUser.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${getRoleColor(assignedUser.outil_role)}`}>
                            {assignedUser.outil_role}
                          </span>
                          {canManage && (
                            <button
                              onClick={() => handleUnassignUser(outil.id, assignedUser.user_id)}
                              className="p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                              title="Retirer"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No users assigned indicator */}
              {canManage && assignedUsers.length === 0 && (
                <div className="border-t border-white/[0.06] bg-white/[0.01] px-4 py-3">
                  <p className="text-xs text-zinc-500 flex items-center gap-2">
                    <UserCircle size={14} />
                    Aucun utilisateur assigné
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {filteredOutils.length === 0 && (
          <div className="glass-card text-center py-16">
            <Settings size={48} className="mx-auto mb-4 text-zinc-600" />
            <p className="text-zinc-400">
              {domaines.length === 0 
                ? 'Créez d\'abord un domaine pour ajouter des outils'
                : 'Aucun outil trouvé'}
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/[0.08] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editingOutil ? 'Modifier l\'outil' : 'Nouvel outil'}
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Nom</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                className="w-full px-4 py-2.5 input-field rounded-xl"
                required
                data-testid="outil-nom-input"
              />
            </div>

            {!editingOutil && (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Domaine</label>
                <select
                  value={formData.domaine_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, domaine_id: e.target.value }))}
                  className="w-full px-4 py-2.5 input-field rounded-xl"
                  required
                  data-testid="outil-domaine-select"
                >
                  <option value="">Sélectionner un domaine</option>
                  {domaines.map((d) => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Rôles disponibles (séparés par des virgules)
              </label>
              <input
                type="text"
                value={rolesInput}
                onChange={(e) => setRolesInput(e.target.value)}
                className="w-full px-4 py-2.5 input-field rounded-xl"
                placeholder="conduc, viewer, chef_de_file"
                data-testid="outil-roles-input"
              />
              <p className="text-xs text-zinc-500 mt-1.5">Ex: conduc, mag, chef_de_file, viewer</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 btn-secondary rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="flex-1 px-4 py-2.5 btn-primary rounded-xl disabled:opacity-50"
                data-testid="outil-submit-btn"
              >
                {formLoading ? 'Enregistrement...' : (editingOutil ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign User Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/[0.08] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Assigner un utilisateur à "{assigningOutil?.nom}"
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleAssignUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Utilisateur</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-2.5 input-field rounded-xl"
                required
                data-testid="assign-outil-user-select"
              >
                <option value="">Sélectionner un utilisateur</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.prenom} {u.nom} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Rôle</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-4 py-2.5 input-field rounded-xl"
                required
                data-testid="assign-outil-role-select"
              >
                {assigningOutil?.roles_disponibles?.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="flex-1 px-4 py-2.5 btn-secondary rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={formLoading || !selectedUserId}
                className="flex-1 px-4 py-2.5 btn-primary rounded-xl disabled:opacity-50"
                data-testid="assign-outil-submit-btn"
              >
                {formLoading ? 'Assignation...' : 'Assigner'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
