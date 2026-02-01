import React from 'react';
import { useAuthStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';

const PermissionDebug = () => {
    // Only show in development
    if (import.meta.env.MODE !== 'development') {
        return null;
    }

    const { user } = useAuthStore();
    const { isAdmin } = usePermissions();
    const [isOpen, setIsOpen] = React.useState(false);

    if (!user) return null;

    // Helper to format permissions
    const getPermissionsList = () => {
        if (!user.permissions) return ['No permissions found'];
        if (typeof user.permissions === 'string') {
            try {
                return JSON.parse(user.permissions);
            } catch (e) {
                return user.permissions.split(',').map(p => p.trim());
            }
        }
        return Array.isArray(user.permissions) ? user.permissions : [String(user.permissions)];
    };

    const permissions = getPermissionsList();

    return (
        <div className="fixed bottom-4 right-4 z-[9999] font-mono text-xs">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`bg-slate-800 text-white px-3 py-1 rounded-t-md border-t border-l border-r border-slate-700 shadow-lg flex items-center gap-2 ${isOpen ? 'bg-slate-900 font-bold' : 'opacity-75 hover:opacity-100'}`}
            >
                <span className={`w-2 h-2 rounded-full ${user.role === 'admin' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                {user.role} ({user.role === 'admin' ? 'ALL' : permissions.length})
            </button>

            {isOpen && (
                <div className="bg-slate-900 border border-slate-700 text-slate-300 p-4 rounded-tl-md shadow-2xl w-80 max-h-96 overflow-y-auto">
                    <div className="mb-2 border-b border-slate-700 pb-2">
                        <p><span className="text-slate-500">User:</span> {user.username}</p>
                        <p><span className="text-slate-500">ID:</span> {user.id}</p>
                        <p><span className="text-slate-500">Role:</span> {user.role} {isAdmin() && '(Superuser)'}</p>
                    </div>
                    <div>
                        <p className="font-bold text-slate-100 mb-1">Effective Permissions:</p>
                        {user.role === 'admin' ? (
                            <p className="text-red-400 italic">Admin has wildcard access (*)</p>
                        ) : (
                            <ul className="list-disc pl-4 space-y-0.5">
                                {permissions.length > 0 ? (
                                    permissions.map((p, i) => (
                                        <li key={i} className="text-green-400">{p}</li>
                                    ))
                                ) : (
                                    <li className="text-yellow-500">No permissions array found</li>
                                )}
                            </ul>
                        )}
                    </div>
                    <div className="mt-4 pt-2 border-t border-slate-700 text-[10px] text-slate-500">
                        Debug Mode Only
                    </div>
                </div>
            )}
        </div>
    );
};

export default PermissionDebug;
