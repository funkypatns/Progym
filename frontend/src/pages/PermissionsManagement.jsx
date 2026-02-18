/**
 * ============================================
 * PERMISSIONS MANAGEMENT PAGE (ADMIN ONLY)
 * ============================================
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, User, Check, X, Save, Search, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { PERMISSIONS, PERMISSION_CATEGORIES } from '../utils/permissions';

const PermissionsManagement = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [selectedRole, setSelectedRole] = useState('staff');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const permissionLabelMap = {
        [PERMISSIONS.APPOINTMENTS_VIEW]: t('permissionsManagement.viewAppointments', 'View Appointments'),
        [PERMISSIONS.APPOINTMENTS_MANAGE]: t('permissionsManagement.manageAppointments', 'Manage Appointments'),
        [PERMISSIONS.COACHES_VIEW]: t('permissionsManagement.viewCoaches', 'View Coaches'),
        [PERMISSIONS.COACHES_MANAGE]: t('permissionsManagement.manageCoaches', 'Manage Coaches')
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);

            // DIAGNOSTIC: Log the request
            console.log('[PERMISSIONS] Fetching users from: GET /api/users/permissions/list');

            const response = await api.get('/users/permissions/list');

            // DIAGNOSTIC: Log success
            console.log('[PERMISSIONS] Success! Received users:', response.data);

            setUsers(response.data.data);
        } catch (error) {
            // DIAGNOSTIC: Log detailed error
            console.error('[PERMISSIONS] FAILED TO LOAD USERS ==================');
            console.error('[PERMISSIONS] Status:', error.response?.status);
            console.error('[PERMISSIONS] Status Text:', error.response?.statusText);
            console.error('[PERMISSIONS] Error Data:', error.response?.data);
            console.error('[PERMISSIONS] Error Message:', error.message);
            console.error('[PERMISSIONS] Full Error:', error);
            console.error('[PERMISSIONS] ==========================================');

            const serverMessage = error.response?.data?.message || error.message || 'Failed to load users';
            toast.error(`Error: ${serverMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setSelectedPermissions(user.permissionsArray || []);
        setSelectedRole(user.role);
    };

    const togglePermission = (permission) => {
        setSelectedPermissions(prev => {
            if (prev.includes(permission)) {
                return prev.filter(p => p !== permission);
            } else {
                return [...prev, permission];
            }
        });
    };

    const toggleCategory = (category) => {
        const categoryPerms = PERMISSION_CATEGORIES[category].permissions;
        const allSelected = categoryPerms.every(p => selectedPermissions.includes(p));

        if (allSelected) {
            // Deselect all in category
            setSelectedPermissions(prev => prev.filter(p => !categoryPerms.includes(p)));
        } else {
            // Select all in category
            setSelectedPermissions(prev => {
                const newPerms = [...prev];
                categoryPerms.forEach(p => {
                    if (!newPerms.includes(p)) {
                        newPerms.push(p);
                    }
                });
                return newPerms;
            });
        }
    };

    const handleSave = async () => {
        if (!selectedUser) return;

        try {
            setSaving(true);
            await api.put(`/users/${selectedUser.id}/permissions`, {
                permissions: selectedRole === 'admin' ? [] : selectedPermissions,
                role: selectedRole
            });

            toast.success('Permissions updated successfully. User must re-login to see changes.', {
                duration: 5000,
                icon: '⚠️'
            });
            fetchUsers(); // Refresh list
        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to update permissions';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
                    <p className="text-slate-300">Loading users...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-primary-400" />
                        Permissions Management
                    </h1>
                    <p className="text-slate-400 mt-1">Manage user roles and permissions</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Users List */}
                <div className="lg:col-span-1">
                    <div className="card p-4">
                        <div className="mb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    className="input pl-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {filteredUsers.map(user => (
                                <motion.div
                                    key={user.id}
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => handleSelectUser(user)}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedUser?.id === user.id
                                        ? 'bg-primary-500/20 border border-primary-500'
                                        : 'bg-dark-800 hover:bg-dark-700 border border-dark-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                                            <User className="w-5 h-5 text-primary-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-white truncate">
                                                {user.firstName} {user.lastName}
                                            </p>
                                            <p className="text-sm text-slate-400 truncate">@{user.username}</p>
                                        </div>
                                        <div>
                                            <span className={`px-2 py-1 text-xs rounded-full ${user.role === 'admin'
                                                ? 'bg-red-500/20 text-red-400'
                                                : 'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {filteredUsers.length === 0 && (
                                <div className="text-center py-8 text-slate-400">
                                    No users found
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Permissions Editor */}
                <div className="lg:col-span-2">
                    {selectedUser ? (
                        <div className="card p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">
                                        {selectedUser.firstName} {selectedUser.lastName}
                                    </h2>
                                    <p className="text-slate-400">@{selectedUser.username}</p>
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>

                            {/* Role Selector */}
                            <div className="mb-6 p-4 bg-dark-800 rounded-lg">
                                <label className="label mb-2">Role</label>
                                <select
                                    className="input"
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                >
                                    <option value="staff">Staff</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <p className="text-xs text-slate-400 mt-2">
                                    Admin role has all permissions automatically
                                </p>
                            </div>

                            {/* Permissions by Category */}
                            {selectedRole !== 'admin' && (
                                <div className="space-y-4">
                                    {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => {
                                        const categoryPerms = category.permissions;
                                        const selectedCount = categoryPerms.filter(p => selectedPermissions.includes(p)).length;
                                        const allSelected = categoryPerms.length === selectedCount;

                                        return (
                                            <div key={key} className="border border-dark-700 rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="font-semibold text-white">{category.label}</h3>
                                                    <button
                                                        onClick={() => toggleCategory(key)}
                                                        className="text-sm text-primary-400 hover:text-primary-300"
                                                    >
                                                        {allSelected ? 'Deselect All' : 'Select All'}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {categoryPerms.map(permission => {
                                                        const isSelected = selectedPermissions.includes(permission);
                                                        const label = permissionLabelMap[permission]
                                                            || permission.split('.').pop().replace('_', ' ');

                                                        return (
                                                            <label
                                                                key={permission}
                                                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isSelected
                                                                    ? 'bg-primary-500/10 border border-primary-500/30'
                                                                    : 'bg-dark-900/50 hover:bg-dark-800 border border-transparent'
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => togglePermission(permission)}
                                                                    className="w-4 h-4 text-primary-500 bg-dark-700 border-dark-600 rounded focus:ring-primary-500"
                                                                />
                                                                <span className="text-sm text-slate-300 capitalize flex-1">
                                                                    {label}
                                                                </span>
                                                                {isSelected && <Check className="w-4 h-4 text-primary-400" />}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {selectedRole === 'admin' && (
                                <div className="text-center py-12 bg-dark-800 rounded-lg">
                                    <AlertCircle className="w-12 h-12 text-primary-400 mx-auto mb-4" />
                                    <p className="text-slate-300">
                                        Admin users have all permissions by default.
                                    </p>
                                    <p className="text-sm text-slate-400 mt-2">
                                        No need to manually assign permissions.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card p-12 text-center">
                            <User className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-300 mb-2">
                                No User Selected
                            </h3>
                            <p className="text-slate-400">
                                Select a user from the list to manage their permissions
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PermissionsManagement;
