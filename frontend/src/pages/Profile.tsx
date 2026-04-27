import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../utils/api';
import { User, Mail, Crown, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const Profile = () => {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
  });

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      await authApi.updateProfile(formData);
      await refreshUser();
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès' });
      setIsEditing(false);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Mon profil</h1>
        <p className="text-muted-foreground mt-1">
          Gérez vos informations personnelles
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center ${
          message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 mr-2" />
          ) : (
            <AlertCircle className="h-5 w-5 mr-2" />
          )}
          {message.text}
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        {/* Profile Header */}
        <div className="p-6 border-b bg-muted/50">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-2xl font-bold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {user?.firstName} {user?.lastName}
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{user?.email}</span>
              </div>
              {user?.isPremium && (
                <div className="flex items-center space-x-1 mt-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600">Premium</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Prénom</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  disabled={!isEditing}
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-muted"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Nom</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={!isEditing}
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-muted"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="email"
                value={user?.email}
                disabled
                className="w-full pl-10 pr-4 py-3 border rounded-lg bg-muted"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              L'email ne peut pas être modifié
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      firstName: user?.firstName || '',
                      lastName: user?.lastName || '',
                    });
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-accent"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Enregistrer</span>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Modifier le profil
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="mt-8 bg-card border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Informations du compte</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Type de compte</span>
            <span className="font-medium">
              {user?.isPremium ? (
                <span className="flex items-center text-amber-600">
                  <Crown className="h-4 w-4 mr-1" />
                  Premium
                </span>
              ) : (
                'Gratuit'
              )}
            </span>
          </div>
          {!user?.isPremium && (
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Crédits restants</span>
              <span className="font-medium">{user?.creditsRemaining}/5</span>
            </div>
          )}
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-foreground">Membre depuis</span>
            <span className="font-medium">
              {user && new Date().toLocaleDateString('fr-FR')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
