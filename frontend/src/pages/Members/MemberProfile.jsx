/**
 * ============================================
 * MEMBER PROFILE PAGE
 * ============================================
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import QRCode from 'react-qr-code';
import {
    ArrowLeft,
    Edit,
    Phone,
    Mail,
    MapPin,
    Calendar,
    CreditCard,
    Clock,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Loader2,
    RotateCcw,
    PauseCircle,
    PlayCircle,
    Banknote
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { WhatsAppButtonWithTemplates } from '../../components/WhatsAppButton';

const MemberProfile = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();

    const [member, setMember] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchMember();
    }, [id]);

    const fetchMember = async () => {
        try {
            const response = await api.get(`/members/${id}`);
            setMember(response.data.data);
        } catch (error) {
            toast.error('Failed to load member');
            navigate('/members');
        } finally {
            setIsLoading(false);
        }
    };

    // -- Handlers --

    const handlePauseToggle = async (sub) => {
        // Simple prompt for now, or just toggle if pausing/resuming
        const isPausing = !sub.isPaused;
        const action = isPausing ? 'Pause' : 'Resume';

        let reason = 'Manual Action';
        if (isPausing) {
            reason = window.prompt("Reason for pausing (optional):", "Member Request");
            if (reason === null) return; // Cancelled
        }

        if (!window.confirm(`Are you sure you want to ${action} this subscription?`)) return;

        try {
            await api.put(`/subscriptions/${sub.id}/toggle-pause`, { reason });
            toast.success(`Subscription ${action}d successfully`);
            fetchMember(); // Refresh
        } catch (e) {
            toast.error(e.response?.data?.message || 'Action failed');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-dark-400" />
            </div>
        );
    }

    if (!member) return null;

    const activeSubscription = member.subscriptions?.find(s => s.status === 'active' || s.status === 'paused');
    const daysRemaining = activeSubscription
        ? Math.ceil((new Date(activeSubscription.endDate) - new Date()) / (1000 * 60 * 60 * 24))
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="btn-icon hover:bg-dark-800 text-dark-400"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-white">{t('members.memberDetails')}</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-2 card"
                >
                    <div className="flex flex-col sm:flex-row items-start gap-6">
                        {/* Photo */}
                        <div className="w-32 h-32 rounded-2xl bg-dark-700 flex-shrink-0 overflow-hidden">
                            {member.photo ? (
                                <img src={member.photo} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl text-dark-400">
                                    {member.firstName[0]}
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">
                                        {member.firstName} {member.lastName}
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        <p className="text-primary-400 font-medium">{member.memberId}</p>
                                        {member.gender && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${member.gender === 'male' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                member.gender === 'female' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                                                    'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                }`}>
                                                {member.gender.charAt(0).toUpperCase() + member.gender.slice(1)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <WhatsAppButtonWithTemplates
                                        phone={member.phone}
                                        memberName={`${member.firstName} ${member.lastName}`}
                                        daysRemaining={daysRemaining}
                                        className="!bg-emerald-500/10 !text-emerald-500 hover:!bg-emerald-500/20 border border-emerald-500/20"
                                    />
                                    <Link to={`/members/${id}/edit`} className="btn-secondary">
                                        <Edit className="w-4 h-4" />
                                        {t('common.edit')}
                                    </Link>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 text-dark-300">
                                    <Phone className="w-5 h-5 text-dark-500" />
                                    <span>{member.phone}</span>
                                </div>

                                {member.email && (
                                    <div className="flex items-center gap-3 text-dark-300">
                                        <Mail className="w-5 h-5 text-dark-500" />
                                        <span>{member.email}</span>
                                    </div>
                                )}

                                {member.address && (
                                    <div className="flex items-center gap-3 text-dark-300">
                                        <MapPin className="w-5 h-5 text-dark-500" />
                                        <span>{member.address}</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 text-dark-300">
                                    <Calendar className="w-5 h-5 text-dark-500" />
                                    <span>Joined {new Date(member.joinDate).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Subscriptions List (Detailed) */}
                    <div className="mt-8 pt-6 border-t border-dark-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Subscriptions</h3>
                            <Link to="/subscriptions" className="btn-primary text-xs py-1.5 h-auto">
                                <CreditCard className="w-3 h-3" /> Assign New
                            </Link>
                        </div>

                        {member.subscriptions && member.subscriptions.length > 0 ? (
                            <div className="space-y-3">
                                {member.subscriptions.map(sub => {
                                    const price = sub.price || sub.plan?.price || 0;
                                    const paid = sub.paidAmount || 0;
                                    const remaining = Math.max(0, price - paid);
                                    const isActive = sub.status === 'active';
                                    const isPaused = sub.isPaused || sub.status === 'paused'; // Handle both flags

                                    return (
                                        <div key={sub.id} className={`bg-dark-900/40 border border-dark-800 rounded-xl p-4 transition-all hover:border-dark-700 ${isActive ? 'ring-1 ring-primary-500/30' : ''}`}>
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

                                                {/* Left: Info */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-white text-base">{sub.plan?.name}</h4>

                                                        <div className="flex items-center gap-1 ml-2">
                                                            {/* Actions moved to Payments page */}
                                                        </div>

                                                        {(sub.status || '').toUpperCase() === 'ACTIVE' && <span className="badge badge-success ml-2">Active</span>}
                                                        {(sub.status || '').toUpperCase() === 'PAUSED' && <span className="badge badge-warning">Paused</span>}
                                                        {(sub.status || '').toUpperCase() === 'EXPIRED' && <span className="badge badge-neutral">Expired</span>}
                                                        {(sub.status || '').toUpperCase() === 'CANCELLED' && <span className="badge badge-error">Cancelled</span>}

                                                        {/* Payment Badges */}
                                                        {(sub.paymentStatus || '').toUpperCase() === 'PAID' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-bold ml-1">PAID</span>}
                                                        {(sub.paymentStatus || '').toUpperCase() === 'PARTIAL' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold ml-1">PARTIAL</span>}
                                                    </div>
                                                    <div className="text-sm text-dark-300 flex items-center gap-3">
                                                        <span>{new Date(sub.startDate).toLocaleDateString()} - {new Date(sub.endDate).toLocaleDateString()}</span>
                                                        {remaining > 0 && sub.status !== 'cancelled' && <span className="text-orange-500 font-bold">Due: {remaining.toLocaleString()} EGP</span>}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* PAUSE / RESUME (Kept on right as standard Action) */}
                                                    {(isActive || isPaused) && sub.status !== 'expired' && sub.status !== 'cancelled' && (
                                                        <button onClick={() => handlePauseToggle(sub)} className={`btn-secondary text-xs px-3 py-1.5 h-auto ${isPaused ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'}`}>
                                                            {isPaused ? <PlayCircle className="w-4 h-4 mr-1.5" /> : <PauseCircle className="w-4 h-4 mr-1.5" />}
                                                            {isPaused ? 'Resume' : 'Pause'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-dark-900/50 rounded-xl p-6 text-center">
                                <p className="text-dark-400 mb-2">{t('subscriptions.noSubscription')}</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* QR Code */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="card flex flex-col items-center"
                >
                    <h3 className="text-lg font-semibold text-white mb-4">{t('members.qrCode')}</h3>

                    <div className="bg-white p-4 rounded-xl">
                        <QRCode value={member.memberId} size={180} />
                    </div>

                    <p className="text-dark-400 text-sm mt-4">{member.memberId}</p>
                    <p className="text-dark-500 text-xs mt-1">Scan for quick check-in</p>
                </motion.div>

                {/* Recent Check-ins */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="card"
                >
                    <h3 className="text-lg font-semibold text-white mb-4">Recent Check-ins</h3>

                    {member.checkIns && member.checkIns.length > 0 ? (
                        <div className="space-y-3">
                            {member.checkIns.slice(0, 5).map((checkIn) => (
                                <div
                                    key={checkIn.id}
                                    className="flex items-center justify-between p-3 bg-dark-900/50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <Clock className="w-4 h-4 text-dark-500" />
                                        <div>
                                            <p className="text-sm text-white">
                                                {new Date(checkIn.checkInTime).toLocaleDateString()}
                                            </p>
                                            <p className="text-xs text-dark-400">
                                                {new Date(checkIn.checkInTime).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="badge badge-info">{checkIn.method}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-dark-500 text-center py-4">No check-ins yet</p>
                    )}
                </motion.div>

                {/* Payment History */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="lg:col-span-2 card"
                >
                    <h3 className="text-lg font-semibold text-white mb-4">Payment History</h3>

                    {member.payments && member.payments.length > 0 ? (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Receipt</th>
                                        <th>Date</th>
                                        <th>Amount</th>
                                        <th>Method</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {member.payments.map((payment) => (
                                        <tr key={payment.id}>
                                            <td className="text-dark-300">{payment.receiptNumber}</td>
                                            <td className="text-dark-300">
                                                {new Date(payment.paidAt).toLocaleDateString()}
                                            </td>
                                            <td className={`font-medium ${payment.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {payment.amount}
                                            </td>
                                            <td className="text-dark-300 capitalize">{payment.method}</td>
                                            <td>
                                                <span className={`badge ${payment.status === 'completed' ? 'badge-success' :
                                                    payment.status === 'refunded' ? 'badge-warning' : 'badge-neutral'
                                                    }`}>
                                                    {payment.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-dark-500 text-center py-4">No payments yet</p>
                    )}
                </motion.div>
            </div>

            {/* Payments Dialog removed for consolidation */}
        </div>
    );
};

export default MemberProfile;
