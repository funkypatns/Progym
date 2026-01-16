import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Search,
    Plus,
    Edit,
    Trash2,
    Loader2,
    User,
    Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const Employees = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'staff',
        email: ''
    });

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            // Check if /users endpoint exists (it should now)
            const response = await api.get('/users');
            if (response.data.success) {
                setUsers(response.data.data);
            }
        } catch (error) {
            toast.error('Failed to fetch employees');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await api.put(`/users/${editingUser.id}`, formData);
                toast.success('Employee updated');
            } else {
                await api.post('/users', formData);
                toast.success('Employee created');
            }
            setShowModal(false);
            setEditingUser(null);
            setFormData({ username: '', password: '', firstName: '', lastName: '', role: 'staff', email: '' });
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Operation failed');
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '', // Leave empty to not change
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            email: user.email || ''
        });
        setShowModal(true);
    };

    const handleToggleStatus = async (user) => {
        try {
            await api.put(`/users/${user.id}`, { isActive: !user.isActive });
            toast.success('Status updated');
            fetchUsers();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Employees</h1>
                    <p className="text-dark-400 mt-1">Manage system access and roles</p>
                </div>
                <button
                    onClick={() => {
                        setEditingUser(null);
                        setFormData({ username: '', password: '', firstName: '', lastName: '', role: 'staff', email: '' });
                        setShowModal(true);
                    }}
                    className="btn-primary"
                >
                    <Plus className="w-5 h-5" />
                    Add Employee
                </button>
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="table-container"
            >
                <table className="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Last Login</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="text-center py-10">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-dark-400" />
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-10 text-dark-400">No employees found</td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="avatar bg-dark-700 text-white">
                                                {user.firstName[0]}
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{user.firstName} {user.lastName}</p>
                                                <p className="text-xs text-dark-400">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="text-dark-300">{user.username}</td>
                                    <td>
                                        <span className={`badge ${user.role === 'admin' ? 'badge-primary' : 'badge-neutral'}`}>
                                            {user.role === 'admin' ? <Shield className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                                            {user.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => handleToggleStatus(user)}
                                            className={`badge cursor-pointer ${user.isActive ? 'badge-success' : 'badge-danger'}`}
                                        >
                                            {user.isActive ? 'Active' : 'Disabled'}
                                        </button>
                                    </td>
                                    <td className="text-dark-300">
                                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => handleEdit(user)}
                                            className="btn-icon hover:text-white"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </motion.div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="modal-content p-6 w-full max-w-md"
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingUser ? 'Edit Employee' : 'New Employee'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">First Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="input w-full"
                                        value={formData.firstName}
                                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Last Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="input w-full"
                                        value={formData.lastName}
                                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Username</label>
                                <input
                                    type="text"
                                    required
                                    className="input w-full"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label">Email (Optional)</label>
                                <input
                                    type="email"
                                    className="input w-full"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label">Role</label>
                                <select
                                    className="input w-full"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="staff">Staff</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">Password {editingUser && '(Leave blank to keep current)'}</label>
                                <input
                                    type="password"
                                    className="input w-full"
                                    minLength={6}
                                    required={!editingUser}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Save
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default Employees;
