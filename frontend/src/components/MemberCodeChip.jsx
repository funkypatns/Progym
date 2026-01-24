import React from 'react';
import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';

const MemberCodeChip = ({ code, className = '' }) => {
    const handleCopy = async () => {
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            toast.success('Member code copied');
        } catch (error) {
            toast.error('Failed to copy');
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-slate-800/60 text-slate-200 border border-slate-700 hover:border-indigo-400/60 transition-colors ${className}`}
            title="Copy member code"
        >
            <span className="font-mono">{code || '-'}</span>
            <Copy size={12} />
        </button>
    );
};

export default MemberCodeChip;
