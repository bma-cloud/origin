import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { outilsApi, domainesApi, usersApi, formatApiError } from '../lib/api';
import { 
  Plus, Search, Edit2, Trash2, Users, Layers,
  AlertCircle, UserPlus, X, Settings, Play, Lock
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
  const [users, setUsers] = useState([]);
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
      setUsers(usersRes.data);
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

  const handleDelete = async (outilId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet outil ?')) return;
    
    try {
      await outilsApi.delete(outilId);
      fetchData();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const filteredOutils = outils.filter(o =>
    o.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.domaine_nom?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher un outil..."
          className="w-full pl-10 pr-4 py-3 input-field"
          data-testid="outil-search-input"
        />
      </div>

      {/* Outils Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOutils.map((outil) => (
          <div key={outil.id} className="glass-card p-5 transition-all duration-300 hover:scale-[1.01]" data-testid={`outil-card-${outil.id}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <Settings size={24} className="text-emerald-400" />
              </div>
              <div className="flex items-center gap-1">
                {canManage && (
                  <button
                    onClick={() => openAssignModal(outil)}
                    className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
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
                      className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors"
                      title="Modifier"
                      data-testid={`edit-outil-${outil.id}`}
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(outil.id)}
                      className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Supprimer"
                      data-testid={`delete-outil-${outil.id}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <h3 className="font-semibold text-lg mb-1">{outil.nom}</h3>
            <div className="flex items-center gap-2 text-sm text-zinc-400 mb-4">
              <Layers size={14} />
              <span>{outil.domaine_nom}</span>
            </div>

            <div className="border-t border-white/[0.08] pt-4">
              <p className="text-xs text-zinc-500 mb-2">Rôles disponibles</p>
              <div className="flex flex-wrap gap-1">
                {outil.roles_disponibles?.map((role) => (
                  <span key={role} className="badge text-xs">{role}</span>
                ))}
              </div>
            </div>

            {/* Use Button */}
            <div className="border-t border-white/[0.08] pt-4 mt-4">
              {hasAccessToOutil(outil.id) ? (
                <button
                  onClick={() => navigate(`/outils/${outil.id}`)}
                  className="w-full btn-primary py-2 flex items-center justify-center gap-2"
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
                  className="w-full py-2 flex items-center justify-center gap-2 bg-zinc-800 text-zinc-500 rounded-lg cursor-not-allowed"
                  data-testid={`locked-outil-${outil.id}`}
                >
                  <Lock size={16} />
                  <span>Accès refusé</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredOutils.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-500">
            {domaines.length === 0 
              ? 'Créez d\'abord un domaine pour ajouter des outils'
              : 'Aucun outil trouvé'}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#0a0a0a] border border-white/[0.08] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editingOutil ? 'Modifier l\'outil' : 'Nouvel outil'}
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
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
                className="w-full px-3 py-2 input-field"
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
                  className="w-full px-3 py-2 input-field"
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
                className="w-full px-3 py-2 input-field"
                placeholder="conduc, viewer, chef_de_file"
                data-testid="outil-roles-input"
              />
              <p className="text-xs text-zinc-500 mt-1">Ex: conduc, mag, chef_de_file, viewer</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2 btn-secondary"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="flex-1 px-4 py-2 btn-primary disabled:opacity-50"
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
        <DialogContent className="bg-[#0a0a0a] border border-white/[0.08] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Assigner un utilisateur à "{assigningOutil?.nom}"
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
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
                className="w-full px-3 py-2 input-field"
                required
                data-testid="assign-outil-user-select"
              >
                <option value="">Sélectionner un utilisateur</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.prenom} {user.nom} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Rôle</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 input-field"
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
                className="flex-1 px-4 py-2 btn-secondary"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={formLoading || !selectedUserId}
                className="flex-1 px-4 py-2 btn-primary disabled:opacity-50"
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
