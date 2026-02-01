import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Loader2, DollarSign, Clock } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import toast from 'react-hot-toast';
import apiClient from '../../utils/api';

const ServicesManager = () => {
    const { t } = useTranslation();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        type: 'SESSION',
        defaultPrice: 0,
        defaultDuration: 60,
        isActive: true
    });

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/services');
            if (res.data.success) {
                setServices(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch services:', error);
            toast.error('Failed to load services');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingService) {
                await apiClient.put(`/services/${editingService.id}`, formData);
                toast.success('Service updated');
            } else {
                await apiClient.post('/services', formData);
                toast.success('Service created');
            }
            fetchServices();
            closeModal();
        } catch (error) {
            console.error(error);
            toast.error('Operation failed');
        }
    };

    // Soft delete / Deactivate
    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to deactivate this service?')) return;
        try {
            await apiClient.delete(`/services/${id}`);
            toast.success('Service deactivated');
            fetchServices();
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete service');
        }
    };

    const openModal = (service = null) => {
        if (service) {
            setEditingService(service);
            setFormData({
                name: service.name,
                type: service.type,
                defaultPrice: service.defaultPrice,
                defaultDuration: service.defaultDuration,
                isActive: service.isActive
            });
        } else {
            setEditingService(null);
            setFormData({
                name: '',
                type: 'SESSION', // Default
                defaultPrice: 0,
                defaultDuration: 60,
                isActive: true
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingService(null);
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Services & Session Types</h3>
                    <p className="text-sm text-slate-500">Manage appointment types, default prices, and durations.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
                >
                    <Plus size={18} />
                    Add Service
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map(service => (
                    <div key={service.id} className={`p-4 rounded-2xl border ${service.isActive ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 opacity-75'}`}>
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-lg">{service.name}</h4>
                                <span className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase ${service.type === 'SESSION' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {service.type}
                                </span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => openModal(service)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition">
                                    <Edit2 size={16} />
                                </button>
                                {service.isActive && (
                                    <button onClick={() => handleDelete(service.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-1">
                                <DollarSign size={14} className="text-emerald-500" />
                                <span className="font-bold">{service.defaultPrice}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock size={14} className="text-blue-500" />
                                <span>{service.defaultDuration} mins</span>
                            </div>
                        </div>

                        {!service.isActive && (
                            <div className="mt-2 text-xs font-bold text-rose-500 flex items-center gap-1">
                                <XCircle size={12} /> Inactive
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal */}
            <Dialog open={isModalOpen} onClose={closeModal} className="relative z-50">
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
                        <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                            {editingService ? 'Edit Service' : 'New Service'}
                        </Dialog.Title>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Service Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., PT Session, Massage"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Type</label>
                                <select
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="SESSION">Session (Appointment)</option>
                                    <option value="SUBSCRIPTION">Subscription Add-on</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Default Price</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none"
                                        value={formData.defaultPrice}
                                        onChange={e => setFormData({ ...formData, defaultPrice: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Duration (mins)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none"
                                        value={formData.defaultDuration}
                                        onChange={e => setFormData({ ...formData, defaultDuration: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    className="w-5 h-5 rounded text-blue-600"
                                    checked={formData.isActive}
                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                />
                                <label htmlFor="isActive" className="text-sm font-bold text-slate-700 dark:text-slate-300">Active</label>
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl transition">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">Save</button>
                            </div>
                        </form>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </div>
    );
};

export default ServicesManager;
