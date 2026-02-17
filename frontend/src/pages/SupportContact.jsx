import React from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, MessageCircle, Mail, Globe, Clock4, RefreshCw, ShieldAlert } from 'lucide-react';
import { useLicenseStore, useSettingsStore } from '../store';
import publicLicenseApi from '../utils/publicLicenseApi';

const VENDOR_PROFILE_CACHE_KEY = 'vendor_support_profile_cache_v1';

function parseCachedProfile() {
    try {
        const raw = localStorage.getItem(VENDOR_PROFILE_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch (_) {
        return null;
    }
}

function saveCachedProfile(profile) {
    try {
        localStorage.setItem(VENDOR_PROFILE_CACHE_KEY, JSON.stringify(profile));
    } catch (_) {
        // ignore storage failures
    }
}

function normalizePhone(value) {
    return String(value || '').replace(/[^\d]/g, '');
}

function applyTemplate(template, replacements) {
    return String(template || '').replace(/\{(licenseKey|gymName)\}/g, (_, key) => replacements[key] || '');
}

function formatDateValue(value, locale) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString(locale || 'ar');
}

const SupportContact = () => {
    const { t, i18n } = useTranslation();
    const { license } = useLicenseStore();
    const { getSetting } = useSettingsStore();
    const [profile, setProfile] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [source, setSource] = React.useState('online');
    const [errorMessage, setErrorMessage] = React.useState('');

    const gymName = String(getSetting('gym_name', '') || license?.gymName || '').trim();
    const licenseKey = String(license?.licenseKey || '').trim();

    const loadProfile = React.useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');

        try {
            const response = await publicLicenseApi.get('/api/public/vendor-profile');
            const data = response?.data?.data || null;
            if (!data) {
                throw new Error('INVALID_VENDOR_PROFILE');
            }

            setProfile(data);
            setSource('online');
            saveCachedProfile(data);
        } catch (_) {
            const cached = parseCachedProfile();
            if (cached) {
                setProfile(cached);
                setSource('cache');
            } else {
                setProfile(null);
                setSource('none');
                setErrorMessage(t('support.unavailable'));
            }
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    React.useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const whatsappMessage = React.useMemo(() => {
        const template = profile?.whatsappTemplate || t('support.defaultWhatsappTemplate');
        return applyTemplate(template, {
            licenseKey,
            gymName
        }).trim();
    }, [gymName, licenseKey, profile?.whatsappTemplate, t]);

    const whatsappNumber = normalizePhone(profile?.whatsapp || profile?.phone);
    const whatsappLink = whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage || '')}`
        : '';

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 shadow-lg">
                <h2 className="text-2xl font-bold text-white mb-2">{t('support.title')}</h2>
                <p className="text-slate-300">
                    {t('support.builtBy', { name: profile?.displayName || '-' })}
                </p>
                <div className="mt-3 text-xs text-slate-400">
                    {t('support.lastUpdated')}: {formatDateValue(profile?.updatedAt, i18n.language)}
                    {source === 'cache' ? ` (${t('support.cached')})` : ''}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                    href={profile?.phone ? `tel:${profile.phone}` : '#'}
                    className={`rounded-xl border p-4 transition ${
                        profile?.phone
                            ? 'border-emerald-600 bg-emerald-600/10 text-emerald-200 hover:bg-emerald-600/20'
                            : 'border-slate-700 bg-slate-800/50 text-slate-500 pointer-events-none'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5" />
                        <div>
                            <div className="font-semibold">{t('support.call')}</div>
                            <div className="text-xs">{profile?.phone || '-'}</div>
                        </div>
                    </div>
                </a>

                <a
                    href={whatsappLink || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded-xl border p-4 transition ${
                        whatsappLink
                            ? 'border-green-600 bg-green-600/10 text-green-200 hover:bg-green-600/20'
                            : 'border-slate-700 bg-slate-800/50 text-slate-500 pointer-events-none'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <MessageCircle className="w-5 h-5" />
                        <div>
                            <div className="font-semibold">{t('support.whatsapp')}</div>
                            <div className="text-xs">{profile?.whatsapp || profile?.phone || '-'}</div>
                        </div>
                    </div>
                </a>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
                <div className="space-y-3 text-slate-300">
                    <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span>{profile?.email || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-slate-400" />
                        {profile?.website ? (
                            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200">
                                {profile.website}
                            </a>
                        ) : (
                            <span>-</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock4 className="w-4 h-4 text-slate-400" />
                        <span>{profile?.supportHours || '-'}</span>
                    </div>
                </div>

                <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                    <div className="text-xs text-slate-400 mb-2">{t('support.whatsappMessagePreview')}</div>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{whatsappMessage || '-'}</p>
                </div>

                <div className="mt-4 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={loadProfile}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        {t('common.refresh')}
                    </button>
                </div>
            </div>

            {!profile && !isLoading && (
                <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-4 text-red-200 flex items-start gap-2">
                    <ShieldAlert className="w-5 h-5 mt-0.5" />
                    <span>{errorMessage || t('support.unavailable')}</span>
                </div>
            )}
        </div>
    );
};

export default SupportContact;
