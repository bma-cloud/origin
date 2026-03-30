import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { outilsApi, domainesApi, usersApi, formatApiError } from '../lib/api';
import { 
  Plus, Search, Edit2, Trash2, Users, Layers,
  AlertCircle, UserPlus, X, Settings, Play, Lock,
  ChevronDown, ChevronUp, UserCircle, Shield
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

// Predefined permissions that can be assigned to roles
const AVAILABLE_PERMISSIONS = [
  { id: 'read', label: 'Lecture', description: 'Consulter les données' },
  { id: 'write', label: 'Écriture', description: 'Créer et modifier des données' },
  { id: 'delete', label: 'Suppression', description: 'Supprimer des données' },
  { id: 'validate', label: 'Validation', description: 'Valider les documents' },
  { id: 'manage_team', label: 'Gestion équipe', description: 'Gérer les membres' },
  { id: 'export', label: 'Export', description: 'Exporter les données' },
  { id: 'admin', label: 'Administration', description: 'Accès complet' },
];

// Default role templates
const ROLE_TEMPLATES = {
  viewer: { permissions: ['read'], description: 'Consultation uniquement' },
  conduc: { permissions: ['read', 'write', 'validate'], description: 'Conducteur de travaux' },
  mag: { permissions: ['read', 'write', 'export'], description: 'Magasinier' },
  chef_de_file: { permissions: ['read', 'write', 'manage_team'], description: 'Chef de file' },
  responsable_securite: { permissions: ['read', 'write', 'validate'], description: 'Responsable sécurité' },
  validateur: { permissions: ['read', 'validate'], description: 'Validateur' },
  admin: { permissions: ['read', 'write', 'delete', 'validate', 'manage_team', 'export', 'admin'], description: 'Administrateur' },
};

export default function Outils() {
  const navigate = useNavigate();
  const { user, isDirection, isEncadrant } = useAuth();
  const canManage = isDirection || isEncadrant;
  
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
  const [outilUsers, setOutilUsers] = useState({});
  const [expandedOutil, setExpandedOutil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [viewingOutil, setViewingOutil] = useState(null);
  const [editingOutil, setEditingOutil] = useState(null);
  const [assigningOutil, setAssigningOutil] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  
  // Form data with roles
  const [formData, setFormData] = useState({
    nom: '',
    domaine_id: '',
  });
  const [roles, setRoles] = useState([
    { name: 'viewer', permissions: ['read'], description: 'Consultation uniquement' }
  ]);
  const [newRoleName, setNewRoleName] = useState('');
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
    });
    setRoles([
      { name: 'viewer', permissions: ['read'], description: 'Consultation uniquement' }
    ]);
    setNewRoleName('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (outil) => {
    setEditingOutil(outil);
    setFormData({
      nom: outil.nom,
      domaine_id: outil.domaine_id,
    });
    // Parse existing roles (supports both structured and legacy format)
    const existingRoles = (outil.roles_disponibles || []).map(role => {
      if (typeof role === 'object' && role.name) {
        return { name: role.name, permissions: role.permissions || ['read'], description: role.description || '' };
      }
      // Legacy: plain string
      const roleName = typeof role === 'string' ? role : String(role);
      return {
        name: roleName,
        permissions: ROLE_TEMPLATES[roleName]?.permissions || ['read'],
        description: ROLE_TEMPLATES[roleName]?.description || ''
      };
    });
    setRoles(existingRoles.length > 0 ? existingRoles : [{ name: 'viewer', permissions: ['read'], description: 'Consultation uniquement' }]);
    setNewRoleName('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openAssignModal = (outil) => {
    setAssigningOutil(outil);
    setSelectedUserId('');
    setSelectedRole(getRoleNames(outil.roles_disponibles)?.[0] || 'viewer');
    setFormError('');
    setIsAssignModalOpen(true);
  };

  const openRolesModal = (outil) => {
    setViewingOutil(outil);
    setIsRolesModalOpen(true);
  };

  const addRole = () => {
    if (!newRoleName.trim()) return;
    const roleName = newRoleName.toLowerCase().replace(/\s+/g, '_');
    if (roles.find(r => r.name === roleName)) {
      setFormError('Ce rôle existe déjà');
      return;
    }
    setRoles([...roles, { 
      name: roleName, 
      permissions: ['read'], 
      description: '' 
    }]);
    setNewRoleName('');
    setFormError('');
  };

  const removeRole = (roleName) => {
    if (roles.length <= 1) {
      setFormError('Au moins un rôle est requis');
      return;
    }
    setRoles(roles.filter(r => r.name !== roleName));
  };

  const togglePermission = (roleName, permissionId) => {
    setRoles(roles.map(role => {
      if (role.name === roleName) {
        const hasPermission = role.permissions.includes(permissionId);
        return {
          ...role,
          permissions: hasPermission 
            ? role.permissions.filter(p => p !== permissionId)
            : [...role.permissions, permissionId]
        };
      }
      return role;
    }));
  };

  const updateRoleDescription = (roleName, description) => {
    setRoles(roles.map(role => 
      role.name === roleName ? { ...role, description } : role
    ));
  };

  const applyTemplate = (roleName, templateName) => {
    const template = ROLE_TEMPLATES[templateName];
    if (!template) return;
    setRoles(roles.map(role =>
      role.name === roleName ? { ...role, permissions: [...template.permissions], description: template.description } : role
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    if (roles.length === 0) {
      setFormError('Au moins un rôle est requis');
      setFormLoading(false);
      return;
    }

    const rolesDisponibles = roles.map(r => ({
      name: r.name,
      permissions: r.permissions,
      description: r.description || ''
    }));

    try {
      if (editingOutil) {
        await outilsApi.update(editingOutil.id, { nom: formData.nom, roles_disponibles: rolesDisponibles });
      } else {
        await outilsApi.create({ ...formData, roles_disponibles: rolesDisponibles });
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

  // Helper to get role names from structured or legacy format
  const getRoleNames = (rolesDisponibles) => {
    return (rolesDisponibles || []).map(r => typeof r === 'object' ? r.name : r);
  };

  const getRoleColor = (role) => {
    if (role === 'direction' || role === 'admin') return 'text-[#FF3B30]';
    return 'text-zinc-300';
  };

  const getPermissionLabel = (permId) => {
    return AVAILABLE_PERMISSIONS.find(p => p.id === permId)?.label || permId;
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
          <p className="text-zinc-400 mt-1">Gérez les outils par pôle</p>
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
          <button onClick={() => setError('')} className="ml-auto"><X size={18} /></button>
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

      {/* Outils Grid - 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOutils.map((outil) => {
          const assignedUsers = outilUsers[outil.id] || [];
          const isExpanded = expandedOutil === outil.id;
          
          return (
            <div 
              key={outil.id} 
              className="glass-card overflow-hidden flex flex-col"
              data-testid={`outil-card-${outil.id}`}
            >
              {/* Main content */}
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-zinc-500/20 to-zinc-500/5 border border-zinc-500/10">
                    <Settings size={20} className="text-zinc-300" />
                  </div>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <button
                        onClick={() => openRolesModal(outil)}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-all"
                        title="Voir les rôles"
                      >
                        <Shield size={16} />
                      </button>
                    )}
                    {isDirection && (
                      <>
                        <button
                          onClick={() => openEditModal(outil)}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-all"
                          title="Modifier"
                          data-testid={`edit-outil-${outil.id}`}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(outil.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Supprimer"
                          data-testid={`delete-outil-${outil.id}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-lg mb-1">{outil.nom}</h3>
                <div className="flex items-center gap-2 text-sm text-zinc-400 mb-3">
                  <Layers size={14} />
                  <span>{outil.domaine_nom}</span>
                </div>

                {/* Roles */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {getRoleNames(outil.roles_disponibles).slice(0, 3).map((role) => (
                    <span 
                      key={role} 
                      className="px-2 py-0.5 text-xs rounded-md bg-white/[0.03] border border-white/[0.06]"
                    >
                      {role}
                    </span>
                  ))}
                  {getRoleNames(outil.roles_disponibles).length > 3 && (
                    <span className="px-2 py-0.5 text-xs rounded-md bg-white/[0.03] border border-white/[0.06] text-zinc-500">
                      +{getRoleNames(outil.roles_disponibles).length - 3}
                    </span>
                  )}
                </div>

                {/* Users count */}
                {canManage && (
                  <div className="flex items-center justify-between text-sm text-zinc-500 mb-3">
                    <button
                      onClick={() => toggleExpand(outil.id)}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                      data-testid={`toggle-users-${outil.id}`}
                    >
                      <UserCircle size={14} />
                      <span>{assignedUsers.length} utilisateur{assignedUsers.length > 1 ? 's' : ''}</span>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <button
                      onClick={() => openAssignModal(outil)}
                      className="p-1.5 text-zinc-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-lg transition-all"
                      title="Assigner"
                      data-testid={`assign-outil-${outil.id}`}
                    >
                      <UserPlus size={14} />
                    </button>
                  </div>
                )}

                {/* Expanded users */}
                {isExpanded && assignedUsers.length > 0 && (
                  <div className="space-y-2 mb-3 pt-3 border-t border-white/[0.06]">
                    {assignedUsers.map((u) => (
                      <div key={u.user_id} className="flex items-center justify-between text-sm group">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs">
                            {u.prenom?.[0]}{u.nom?.[0]}
                          </div>
                          <span className="truncate">{u.prenom} {u.nom}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-zinc-500">{u.outil_role}</span>
                          {canManage && (
                            <button
                              onClick={() => handleUnassignUser(outil.id, u.user_id)}
                              className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Use Button */}
              <div className="p-4 pt-0">
                {hasAccessToOutil(outil.id) ? (
                  <button
                    onClick={() => navigate(`/outils/${outil.id}`)}
                    className="w-full btn-primary py-2 flex items-center justify-center gap-2 rounded-xl text-sm"
                    data-testid={`use-outil-${outil.id}`}
                  >
                    <Play size={14} />
                    <span>Utiliser</span>
                    {getUserRoleForOutil(outil.id) && (
                      <span className="text-xs opacity-75">({getUserRoleForOutil(outil.id)})</span>
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-2 flex items-center justify-center gap-2 bg-zinc-800/50 text-zinc-500 rounded-xl cursor-not-allowed text-sm"
                    data-testid={`locked-outil-${outil.id}`}
                  >
                    <Lock size={14} />
                    <span>Accès refusé</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredOutils.length === 0 && (
          <div className="col-span-full glass-card text-center py-16">
            <Settings size={48} className="mx-auto mb-4 text-zinc-600" />
            <p className="text-zinc-400">
              {domaines.length === 0 ? 'Créez d\'abord un pôle' : 'Aucun outil trouvé'}
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/[0.08] max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Nom de l'outil</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                  className="w-full px-4 py-2.5 input-field rounded-xl"
                  placeholder="Ex: Checklist sécurité"
                  required
                  data-testid="outil-nom-input"
                />
              </div>
              {!editingOutil && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Pôle</label>
                  <select
                    value={formData.domaine_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, domaine_id: e.target.value }))}
                    className="w-full px-4 py-2.5 input-field rounded-xl"
                    required
                    data-testid="outil-domaine-select"
                  >
                    <option value="">Sélectionner</option>
                    {domaines.map((d) => (
                      <option key={d.id} value={d.id}>{d.nom}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Roles Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-zinc-300">Rôles et permissions</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Nouveau rôle..."
                    className="px-3 py-1.5 text-sm input-field rounded-lg w-40"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRole())}
                  />
                  <button
                    type="button"
                    onClick={addRole}
                    className="p-1.5 bg-[#FF3B30] text-white rounded-lg hover:bg-[#FF3B30]/80"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {roles.map((role) => (
                  <div key={role.name} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{role.name}</span>
                        <select
                          onChange={(e) => e.target.value && applyTemplate(role.name, e.target.value)}
                          className="text-xs px-2 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-zinc-400"
                          value=""
                        >
                          <option value="">Appliquer un modèle...</option>
                          {Object.entries(ROLE_TEMPLATES).map(([key, val]) => (
                            <option key={key} value={key}>{key} - {val.description}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRole(role.name)}
                        className="p-1 text-zinc-500 hover:text-red-400"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={role.description}
                      onChange={(e) => updateRoleDescription(role.name, e.target.value)}
                      placeholder="Description du rôle..."
                      className="w-full px-3 py-1.5 text-sm input-field rounded-lg mb-3"
                    />

                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_PERMISSIONS.map((perm) => (
                        <button
                          key={perm.id}
                          type="button"
                          onClick={() => togglePermission(role.name, perm.id)}
                          className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                            role.permissions.includes(perm.id)
                              ? 'bg-[#FF3B30]/20 border-[#FF3B30]/40 text-[#FF3B30]'
                              : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:border-white/[0.15]'
                          }`}
                          title={perm.description}
                        >
                          {perm.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
              Assigner à "{assigningOutil?.nom}"
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
              >
                <option value="">Sélectionner</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
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
              >
                {getRoleNames(assigningOutil?.roles_disponibles).map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setIsAssignModalOpen(false)} className="flex-1 px-4 py-2.5 btn-secondary rounded-xl">
                Annuler
              </button>
              <button type="submit" disabled={formLoading || !selectedUserId} className="flex-1 px-4 py-2.5 btn-primary rounded-xl disabled:opacity-50">
                {formLoading ? 'Assignation...' : 'Assigner'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Roles Modal */}
      <Dialog open={isRolesModalOpen} onOpenChange={setIsRolesModalOpen}>
        <DialogContent className="bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/[0.08] max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Rôles de "{viewingOutil?.nom}"
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {(viewingOutil?.roles_disponibles || []).map((role) => {
              const roleName = typeof role === 'object' ? role.name : role;
              const rolePerms = typeof role === 'object' ? (role.permissions || ['read']) : (ROLE_TEMPLATES[role]?.permissions || ['read']);
              const roleDesc = typeof role === 'object' ? (role.description || '') : (ROLE_TEMPLATES[role]?.description || '');
              return (
                <div key={roleName} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{roleName}</span>
                    {roleDesc && <span className="text-xs text-zinc-500">{roleDesc}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rolePerms.map((perm) => (
                      <span key={perm} className="px-2 py-0.5 text-xs rounded-md bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20">
                        {getPermissionLabel(perm)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setIsRolesModalOpen(false)}
            className="w-full mt-4 px-4 py-2.5 btn-secondary rounded-xl"
          >
            Fermer
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
