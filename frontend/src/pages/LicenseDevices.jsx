import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import licenseAdminService from '../services/licenseAdminService';

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
}

function maskFingerprint(value) {
    if (!value || value.length < 12) return value || '-';
    return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function statusClasses(status) {
    switch ((status || '').toLowerCase()) {
        case 'approved':
        case 'active':
            return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
        case 'blocked':
        case 'suspended':
            return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
        case 'revoked':
        case 'inactive':
            return 'bg-red-500/15 text-red-300 border-red-500/30';
        default:
            return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
}

const LicenseDevices = () => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(true);
    const [licenses, setLicenses] = useState([]);
    const [query, setQuery] = useState('');
    const [selectedKey, setSelectedKey] = useState('');
    const [devices, setDevices] = useState([]);
    const [devicesLoading, setDevicesLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const selectedLicense = useMemo(
        () => licenses.find((item) => item.key === selectedKey) || null,
        [licenses, selectedKey]
    );

    const [deviceLimitInput, setDeviceLimitInput] = useState('1');
    const [statusInput, setStatusInput] = useState('active');

    const filteredLicenses = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return licenses;
        return licenses.filter((item) => {
            const haystack = `${item.key || ''} ${item.gymName || ''} ${item.ownerName || ''}`.toLowerCase();
            return haystack.includes(normalized);
        });
    }, [licenses, query]);

    const loadLicenses = async () => {
        setIsLoading(true);
        try {
            const list = await licenseAdminService.listLicenses();
            setLicenses(Array.isArray(list) ? list : []);

            if (!selectedKey && list?.length > 0) {
                setSelectedKey(list[0].key);
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || t('devicesManagement.loadFailed', 'Failed to load licenses'));
        } finally {
            setIsLoading(false);
        }
    };

    const loadDevices = async (licenseKey) => {
        if (!licenseKey) {
            setDevices([]);
            return;
        }

        setDevicesLoading(true);
        try {
            const list = await licenseAdminService.listDevices(licenseKey);
            setDevices(Array.isArray(list) ? list : []);
        } catch (error) {
            toast.error(error?.response?.data?.message || t('devicesManagement.devicesLoadFailed', 'Failed to load devices'));
            setDevices([]);
        } finally {
            setDevicesLoading(false);
        }
    };

    useEffect(() => {
        loadLicenses();
    }, []);

    useEffect(() => {
        if (selectedLicense) {
            setDeviceLimitInput(String(selectedLicense.deviceLimit || 1));
            setStatusInput(selectedLicense.status || 'active');
        }
    }, [selectedLicense]);

    useEffect(() => {
        loadDevices(selectedKey);
    }, [selectedKey]);

    const refreshAll = async () => {
        await loadLicenses();
        await loadDevices(selectedKey);
    };

    const withSubmit = async (action) => {
        setSubmitting(true);
        try {
            await action();
            await refreshAll();
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async (deviceId) => {
        await withSubmit(async () => {
            await licenseAdminService.approveDevice(selectedKey, deviceId);
            toast.success(t('devicesManagement.deviceApproved', 'Device approved'));
        });
    };

    const handleRevoke = async (deviceId) => {
        await withSubmit(async () => {
            await licenseAdminService.revokeDevice(selectedKey, deviceId);
            toast.success(t('devicesManagement.deviceRevoked', 'Device revoked'));
        });
    };

    const handleResetDevices = async () => {
        await withSubmit(async () => {
            await licenseAdminService.resetDevices(selectedKey);
            toast.success(t('devicesManagement.devicesReset', 'License devices reset'));
        });
    };

    const handleSaveLicense = async () => {
        const parsedLimit = Number.parseInt(deviceLimitInput, 10);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
            toast.error(t('devicesManagement.invalidLimit', 'Device limit must be at least 1'));
            return;
        }

        await withSubmit(async () => {
            await licenseAdminService.patchLicense(selectedKey, {
                device_limit: parsedLimit,
                status: statusInput
            });
            toast.success(t('devicesManagement.licenseUpdated', 'License updated'));
        });
    };

    const handleRevokeLicense = async () => {
        await withSubmit(async () => {
            await licenseAdminService.revokeLicense(selectedKey);
            toast.success(t('devicesManagement.licenseRevoked', 'License revoked'));
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4 md:p-6">
                <h2 className="text-xl font-bold text-white mb-2">
                    {t('devicesManagement.title', '????? ???????')}
                </h2>
                <p className="text-slate-400 text-sm mb-4">
                    {t('devicesManagement.subtitle', 'Manage approved devices per license and enforce device limits.')}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                        placeholder={t('devicesManagement.searchPlaceholder', 'Search license key or gym name')}
                    />

                    <select
                        value={selectedKey}
                        onChange={(e) => setSelectedKey(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                        disabled={isLoading}
                    >
                        {filteredLicenses.map((item) => (
                            <option key={item.key} value={item.key}>
                                {item.key} - {item.gymName || '-'}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={loadLicenses}
                        disabled={isLoading || submitting}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50"
                    >
                        {t('devicesManagement.refresh', 'Refresh')}
                    </button>
                </div>
            </div>

            {selectedLicense && (
                <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4 md:p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">{selectedLicense.key}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">{t('devicesManagement.deviceLimit', 'Device Limit')}</label>
                            <input
                                type="number"
                                min={1}
                                value={deviceLimitInput}
                                onChange={(e) => setDeviceLimitInput(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">{t('devicesManagement.licenseStatus', 'License Status')}</label>
                            <select
                                value={statusInput}
                                onChange={(e) => setStatusInput(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                            >
                                <option value="active">active</option>
                                <option value="inactive">inactive</option>
                                <option value="suspended">suspended</option>
                                <option value="revoked">revoked</option>
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={handleSaveLicense}
                            disabled={submitting}
                            className="h-10 self-end px-4 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50"
                        >
                            {t('devicesManagement.saveLicense', 'Save License')}
                        </button>
                        <button
                            type="button"
                            onClick={handleRevokeLicense}
                            disabled={submitting}
                            className="h-10 self-end px-4 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-50"
                        >
                            {t('devicesManagement.revokeLicense', 'Revoke License')}
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                        {t('devicesManagement.currentStats', 'Approved Devices')}: {selectedLicense.approvedDevices || 0} / {selectedLicense.deviceLimit || 1}
                    </p>
                </div>
            )}

            <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">{t('devicesManagement.devicesTable', 'Devices')}</h3>
                    <button
                        type="button"
                        onClick={handleResetDevices}
                        disabled={!selectedKey || submitting}
                        className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold disabled:opacity-50"
                    >
                        {t('devicesManagement.resetDevices', 'Reset License Devices')}
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-slate-300">
                        <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                            <tr>
                                <th className="py-2 px-2">{t('devicesManagement.deviceName', 'Device Name')}</th>
                                <th className="py-2 px-2">{t('devicesManagement.platform', 'Platform')}</th>
                                <th className="py-2 px-2">{t('devicesManagement.appVersion', 'App Version')}</th>
                                <th className="py-2 px-2">{t('devicesManagement.firstActivated', 'First Activated')}</th>
                                <th className="py-2 px-2">{t('devicesManagement.lastSeen', 'Last Seen')}</th>
                                <th className="py-2 px-2">{t('devicesManagement.lastIp', 'Last IP')}</th>
                                <th className="py-2 px-2">{t('devicesManagement.fingerprint', 'Fingerprint')}</th>
                                <th className="py-2 px-2">{t('devicesManagement.status', 'Status')}</th>
                                <th className="py-2 px-2">{t('devicesManagement.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devicesLoading && (
                                <tr>
                                    <td className="py-4 px-2" colSpan={9}>
                                        {t('devicesManagement.loadingDevices', 'Loading devices...')}
                                    </td>
                                </tr>
                            )}
                            {!devicesLoading && devices.length === 0 && (
                                <tr>
                                    <td className="py-4 px-2 text-slate-500" colSpan={9}>
                                        {t('devicesManagement.noDevices', 'No devices found for this license.')}
                                    </td>
                                </tr>
                            )}
                            {!devicesLoading && devices.map((device) => (
                                <tr key={device.id} className="border-b border-slate-800">
                                    <td className="py-2 px-2">{device.deviceName || '-'}</td>
                                    <td className="py-2 px-2">{device.platform || '-'}</td>
                                    <td className="py-2 px-2">{device.appVersion || '-'}</td>
                                    <td className="py-2 px-2">{formatDate(device.firstActivatedAt)}</td>
                                    <td className="py-2 px-2">{formatDate(device.lastSeenAt)}</td>
                                    <td className="py-2 px-2">{device.lastSeenIp || '-'}</td>
                                    <td className="py-2 px-2 font-mono text-xs">{maskFingerprint(device.fingerprint)}</td>
                                    <td className="py-2 px-2">
                                        <span className={`inline-flex px-2 py-1 rounded border text-xs ${statusClasses(device.status)}`}>
                                            {device.status}
                                        </span>
                                    </td>
                                    <td className="py-2 px-2">
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleApprove(device.id)}
                                                disabled={submitting || device.status === 'approved'}
                                                className="px-2 py-1 rounded bg-emerald-700 text-white text-xs disabled:opacity-50"
                                            >
                                                {t('devicesManagement.approve', 'Approve')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRevoke(device.id)}
                                                disabled={submitting || device.status === 'revoked'}
                                                className="px-2 py-1 rounded bg-red-700 text-white text-xs disabled:opacity-50"
                                            >
                                                {t('devicesManagement.revoke', 'Revoke')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LicenseDevices;