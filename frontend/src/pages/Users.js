import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersApi, formatApiError } from '../lib/api';
import { 
  Plus, Search, Edit2, Trash2, UserCheck, UserX, 
  AlertCircle, X, Eye, EyeOff 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

export default function Users() {
  const { user: currentUser, isDirection } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    nom: '',
    prenom: '',
    password: '',
    role_global: 'user'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await usersApi.getAll();
      setUsers(response.data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      nom: '',
      prenom: '',
      password: '',
      role_global: 'user'
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      password: '',
      role_global: user.role_global
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (editingUser) {
        const updateData = { ...formData };
        delete updateData.password; // Don't update password on edit
        await usersApi.update(editingUser.id, updateData);
      } else {
        if (!formData.password || formData.password.length < 6) {
          setFormError('Le mot de passe doit contenir au moins 6 caractères');
          setFormLoading(false);
          return;
        }
        await usersApi.create(formData);
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }
    try {
      await usersApi.delete(userId);
      fetchUsers();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await usersApi.update(user.id, { is_active: !user.is_active });
      fetchUsers();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.prenom.toLowerCase().includes(searchTerm.toLowerCase())
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#FF3B30]/30 border-t-[#FF3B30] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="users-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-zinc-400 mt-1">Gérez les utilisateurs de la plateforme</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary px-4 py-2 flex items-center gap-2"
          data-testid="create-user-btn"
        >
          <Plus size={20} />
          <span>Nouvel utilisateur</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher un utilisateur..."
          className="w-full pl-10 pr-4 py-3 input-field"
          data-testid="user-search-input"
        />
      </div>

      {/* Users Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Utilisateur</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Email</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Rôle</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Statut</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="table-row" data-testid={`user-row-${user.id}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {user.prenom?.[0]}{user.nom?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.prenom} {user.nom}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${getRoleBadgeClass(user.role_global)}`}>
                      {getRoleLabel(user.role_global)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${user.is_active ? 'badge-user' : 'badge-direction'}`}>
                      {user.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleActive(user)}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors"
                        title={user.is_active ? 'Désactiver' : 'Activer'}
                        data-testid={`toggle-user-${user.id}`}
                        disabled={user.id === currentUser?.id}
                      >
                        {user.is_active ? <UserX size={18} /> : <UserCheck size={18} />}
                      </button>
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors"
                        title="Modifier"
                        data-testid={`edit-user-${user.id}`}
                      >
                        <Edit2 size={18} />
                      </button>
                      {isDirection && user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Supprimer"
                          data-testid={`delete-user-${user.id}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            Aucun utilisateur trouvé
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#0a0a0a] border border-white/[0.08] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Prénom</label>
                <input
                  type="text"
                  value={formData.prenom}
                  onChange={(e) => setFormData(prev => ({ ...prev, prenom: e.target.value }))}
                  className="w-full px-3 py-2 input-field"
                  required
                  data-testid="user-prenom-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Nom</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                  className="w-full px-3 py-2 input-field"
                  required
                  data-testid="user-nom-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 input-field"
                required
                data-testid="user-email-input"
              />
            </div>

            {!editingUser && (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 input-field"
                    required
                    minLength={6}
                    data-testid="user-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Rôle</label>
              <select
                value={formData.role_global}
                onChange={(e) => setFormData(prev => ({ ...prev, role_global: e.target.value }))}
                className="w-full px-3 py-2 input-field"
                data-testid="user-role-select"
                disabled={!isDirection}
              >
                <option value="user">Utilisateur</option>
                {isDirection && (
                  <>
                    <option value="encadrant">Encadrant</option>
                    <option value="direction">Direction</option>
                  </>
                )}
              </select>
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
                data-testid="user-submit-btn"
              >
                {formLoading ? 'Enregistrement...' : (editingUser ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
