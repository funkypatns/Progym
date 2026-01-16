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
    UserX,
    MessageCircle,
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-dark-400" />
            </div>
        );
    }

    if (!member) {
        return null;
    }

    const activeSubscription = member.subscriptions?.find(s => s.status === 'active');
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

                    {/* Subscription Status */}
                    <div className="mt-6 pt-6 border-t border-dark-700">
                        <h3 className="text-lg font-semibold text-white mb-4">Current Subscription</h3>

                        {activeSubscription ? (
                            <div className="bg-dark-900/50 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${daysRemaining > 7 ? 'bg-emerald-500/20' :
                                            daysRemaining > 0 ? 'bg-yellow-500/20' : 'bg-red-500/20'
                                            }`}>
                                            {daysRemaining > 7 ? (
                                                <CheckCircle className="w-6 h-6 text-emerald-400" />
                                            ) : daysRemaining > 0 ? (
                                                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                                            ) : (
                                                <XCircle className="w-6 h-6 text-red-400" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{activeSubscription.plan.name}</p>
                                            <p className="text-sm text-dark-400">
                                                {new Date(activeSubscription.startDate).toLocaleDateString()} - {' '}
                                                {new Date(activeSubscription.endDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <p className={`text-2xl font-bold ${daysRemaining > 7 ? 'text-emerald-400' :
                                            daysRemaining > 0 ? 'text-yellow-400' : 'text-red-400'
                                            }`}>
                                            {daysRemaining > 0 ? daysRemaining : 0}
                                        </p>
                                        <p className="text-sm text-dark-400">{t('subscriptions.daysRemaining')}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-dark-900/50 rounded-xl p-4 text-center">
                                <p className="text-dark-400">{t('subscriptions.noSubscription')}</p>
                                <Link to="/subscriptions" className="btn-primary mt-4">
                                    <CreditCard className="w-4 h-4" />
                                    {t('subscriptions.assignSubscription')}
                                </Link>
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
                                            <td className="text-emerald-400 font-medium">
                                                ${payment.amount}
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
        </div>
    );
};

export default MemberProfile;
