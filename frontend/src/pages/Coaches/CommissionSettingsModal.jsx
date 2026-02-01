import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Percent, DollarSign, Save, Activity } from 'lucide-react';
import apiClient from '../../utils/api';
import toast from 'react-hot-toast';

const CommissionSettingsModal = ({ open, onClose, coach, onSaved }) => {
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState('percentage'); // percentage | fixed
    const [value, setValue] = useState('');
    const [internalSessionValue, setInternalSessionValue] = useState('');

    useEffect(() => {
        if (open && coach?.id) {
            fetchSettings();
        }
    }, [open, coach]);

    const fetchSettings = async () => {
        if (!coach?.id) {
            return;
        }
        setLoading(true);
        try {
            const res = await apiClient.get(`/staff-trainers/${coach.id}/commission`);
            if (res.data.success) {
                const settings = res.data.data || {};
                const derivedType = settings.type || (coach?.commissionPercent !== null ? 'percentage' : 'percentage');
                const derivedValue = settings.value ?? coach?.commissionPercent ?? '';
                setType(derivedType);
                setValue(derivedValue?.toString() || '');
                setInternalSessionValue(settings.internalSessionValue || '');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await apiClient.post(`/staff-trainers/${coach.id}/commission`, {
                type,
                value: parseFloat(value),
                internalSessionValue: parseFloat(internalSessionValue) || 0
            });
            toast.success('Commission settings saved');
            if (onSaved && res?.data?.success) {
                onSaved(res.data.data);
            }
            onClose();
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-xl transition-all">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <Dialog.Title as="h3" className="text-xl font-black text-white uppercase tracking-tight">
                                        Commission Rules
                                    </Dialog.Title>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                                        For {coach?.name || `${coach?.firstName || ''} ${coach?.lastName || ''}`.trim()}
                                    </p>
                                </div>
                                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Type Selection */}
                                <div className="grid grid-cols-2 gap-3 p-1 bg-slate-800 rounded-xl">
                                    <button
                                        onClick={() => setType('percentage')}
                                        className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${type === 'percentage' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        <Percent size={16} /> Percentage
                                    </button>
                                    <button
                                        onClick={() => setType('fixed')}
                                        className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${type === 'fixed' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        <DollarSign size={16} /> Fixed Amount
                                    </button>
                                </div>

                                {/* Value Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">
                                        {type === 'percentage' ? 'Commission Percentage (%)' : 'Fixed Amount per Session'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={value}
                                            onChange={e => setValue(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-4 text-2xl font-bold text-white focus:outline-none focus:border-blue-500 text-center"
                                        />
                                    </div>
                                </div>

                                {/* Internal Session Value (Only for Percentage) */}
                                {type === 'percentage' && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">
                                                Internal Session Value (Base)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={internalSessionValue}
                                                    onChange={e => setInternalSessionValue(e.target.value)}
                                                    placeholder="e.g. 100"
                                                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-lg font-bold text-blue-400 focus:outline-none focus:border-blue-500 text-center"
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-500 text-center">
                                                Commission is calculated from the session price, not from membership.
                                            </p>
                                        </div>

                                        {/* Live Calculation Preview */}
                                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-2">
                                            <label className="text-xs font-bold text-blue-400 uppercase flex items-center justify-center gap-2">
                                                <Activity size={14} /> Calculated Commission
                                            </label>
                                            <div className="text-2xl font-black text-white text-center">
                                                {((parseFloat(value) || 0) * (parseFloat(internalSessionValue) || 0) / 100).toFixed(2)}
                                            </div>
                                            <p className="text-[10px] text-blue-300/70 text-center">
                                                This is an automatic calculation to help you verify the commission value.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleSave}
                                    disabled={loading || !value}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : (
                                        <>
                                            <Save size={20} /> Save Configuration
                                        </>
                                    )}
                                </button>
                            </div>
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default CommissionSettingsModal;
