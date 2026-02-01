import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, Edit, Loader2, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import CommissionSettingsModal from './Coaches/CommissionSettingsModal';

const Trainers = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTrainer, setEditingTrainer] = useState(null);
    const [showCommissionModal, setShowCommissionModal] = useState(false);
    const [commissionTrainer, setCommissionTrainer] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        commissionPercent: '',
        active: true
    });

    const fetchTrainers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/staff-trainers');
            if (res.data.success) {
                const items = Array.isArray(res.data.data) ? res.data.data : [];
                const unique = new Map(items.map(item => [item.id, item]));
                setTrainers(Array.from(unique.values()));
            }
        } catch (error) {
            toast.error('Failed to load trainers');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrainers();
    }, [fetchTrainers]);

    useEffect(() => {
        if (loading || trainers.length === 0) return;
        const params = new URLSearchParams(location.search);
        const openTrainer = params.get('openTrainer');
        const mode = params.get('mode');
        if (!openTrainer) return;
        const trainerId = Number(openTrainer);
        if (Number.isNaN(trainerId)) return;
        const target = trainers.find(t => t.id === trainerId);
        if (!target) return;
        setEditingTrainer(target);
        setFormData({
            name: target.name,
            phone: target.phone || '',
            commissionPercent: target.commissionPercent?.toString() || '',
            active: target.active
        });
        setShowModal(true);
        if (mode === 'earnings') {
            // No earnings UI in this modal; open edit modal as fallback.
        }
        navigate(location.pathname, { replace: true });
    }, [loading, trainers, location.search, location.pathname, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name.trim(),
                phone: formData.phone || undefined,
                commissionPercent: formData.commissionPercent ? parseFloat(formData.commissionPercent) : undefined,
                active: formData.active
            };

            if (editingTrainer) {
                await api.put(`/staff-trainers/${editingTrainer.id}`, payload);
                toast.success('Trainer updated');
            } else {
                const res = await api.post('/staff-trainers', payload);
                toast.success('Trainer added');
                if (res.data?.success && res.data?.data) {
                    setCommissionTrainer(res.data.data);
                    setShowCommissionModal(true);
                }
            }

            setShowModal(false);
            setEditingTrainer(null);
            setFormData({ name: '', phone: '', commissionPercent: '', active: true });
            fetchTrainers();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Operation failed');
        }
    };

    const handleEdit = (trainer) => {
        setEditingTrainer(trainer);
        setFormData({
            name: trainer.name,
            phone: trainer.phone || '',
            commissionPercent: trainer.commissionPercent?.toString() || '',
            active: trainer.active
        });
        setShowModal(true);
    };

    const handleToggle = async (trainer) => {
        try {
            await api.patch(`/staff-trainers/${trainer.id}/toggle`);
            toast.success('Status updated');
            fetchTrainers();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('trainers.title', 'Trainers List')}</h1>
                    <p className="text-dark-400 mt-1">{t('trainers.subtitle', 'Manage trainer profiles')}</p>
                </div>
                <button
                    onClick={() => {
                        setEditingTrainer(null);
                        setFormData({ name: '', phone: '', commissionPercent: '', active: true });
                        setShowModal(true);
                    }}
                    className="btn-primary"
                >
                    <Plus className="w-5 h-5" />
                    {t('trainers.add', 'Add Trainer')}
                </button>
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Commission %</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="text-center py-10">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-dark-400" />
                                </td>
                            </tr>
                        ) : trainers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-10 text-dark-400">No trainers found</td>
                            </tr>
                        ) : (
                            trainers.map(trainer => (
                                <tr key={trainer.id}>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="avatar bg-dark-700 text-white">{trainer.name[0]}</div>
                                            <div>
                                                <p className="font-medium text-white">{trainer.name}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="text-dark-300">{trainer.phone || '—'}</td>
                                    <td className="text-dark-300">{trainer.commissionPercent ?? '—'}</td>
                                    <td>
                                        <button
                                            className={`badge cursor-pointer ${trainer.active ? 'badge-success' : 'badge-danger'}`}
                                            onClick={() => handleToggle(trainer)}
                                        >
                                            {trainer.active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleEdit(trainer)} className="btn-icon hover:text-white">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleToggle(trainer)} className="btn-icon hover:text-blue-400">
                                                <Power className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </motion.div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="modal-content p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingTrainer ? 'Edit Trainer' : 'New Trainer'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">Name</label>
                                <input type="text" required className="input w-full" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Phone</label>
                                <input type="text" className="input w-full" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Commission %</label>
                                <input type="number" min="0" max="100" className="input w-full" value={formData.commissionPercent} onChange={e => setFormData({ ...formData, commissionPercent: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={formData.active} id="trainer-active" onChange={e => setFormData({ ...formData, active: e.target.checked })} />
                                <label htmlFor="trainer-active" className="text-sm text-slate-400">Active</label>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Save</button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {showCommissionModal && commissionTrainer && (
                <CommissionSettingsModal
                    open={showCommissionModal}
                    onClose={() => setShowCommissionModal(false)}
                    coach={commissionTrainer}
                    onSaved={() => fetchTrainers()}
                />
            )}
        </div>
    );
};

export default Trainers;
