import React, { useState, useEffect } from 'react';
import { usePosStore } from '../store';
import { Loader2, AlertTriangle, Calculator, DollarSign, CreditCard, ArrowRightLeft } from 'lucide-react';

const PosShiftModal = ({ isOpen, onClose, onSuccess, onLogoutOnly }) => {
    const { machine, currentShift, openShift, closeShift, closeShiftById, getShiftSummary, isLoading: storeLoading } = usePosStore();
    const currencySymbol = '$'; // Default, ideally from settings
    const [amount, setAmount] = useState('');
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [closedShiftResult, setClosedShiftResult] = useState(null);
    const [shiftSummary, setShiftSummary] = useState(null);
    const [calculating, setCalculating] = useState(false);
    const [forceCloseShiftId, setForceCloseShiftId] = useState(null);
    const [forceCloseMachineId, setForceCloseMachineId] = useState(null);
    const [forceCloseCash, setForceCloseCash] = useState('0');

    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setError(null);
            setSuccessMsg(null);
            setClosedShiftResult(null);
            setShiftSummary(null);
            setForceCloseShiftId(null);
            setForceCloseMachineId(null);
            setForceCloseCash('0');

            // Fetch summary if closing shift
            if (currentShift) {
                setCalculating(true);
                getShiftSummary(currentShift.id).then(res => {
                    setCalculating(false);
                    if (res.success) {
                        setShiftSummary(res.data);
                    } else {
                        setError('Failed to fetch shift summary');
                    }
                });
            }
        }
    }, [isOpen, currentShift]);

    const parseExistingShiftError = (message) => {
        if (!message) return null;
        const idMatch = message.match(/open shift \(ID:\s*(\d+)\)/i);
        if (!idMatch) return null;
        const machineMatch = message.match(/Machine\s*(\d+)/i);
        return {
            shiftId: parseInt(idMatch[1], 10),
            machineId: machineMatch ? parseInt(machineMatch[1], 10) : null
        };
    };

    const handleOpenShift = async (e) => {
        e.preventDefault();
        setError(null);

        const cashValue = parseFloat(amount);
        if (amount === '' || isNaN(cashValue) || cashValue < 0) {
            setError('Please enter a valid amount (0 or more)');
            return;
        }

        const result = await openShift(cashValue);
        if (result.success) {
            setSuccessMsg('Shift opened successfully');
            if (onSuccess) onSuccess('open');
            setTimeout(() => onClose(), 1500);
        } else {
            setError(result.message);
            const existingShift = parseExistingShiftError(result.message);
            if (existingShift) {
                setForceCloseShiftId(existingShift.shiftId);
                setForceCloseMachineId(existingShift.machineId);
            } else {
                setForceCloseShiftId(null);
                setForceCloseMachineId(null);
            }
        }
    };

    const handleCloseShift = async (e) => {
        e.preventDefault();
        setError(null);

        const cashValue = parseFloat(amount);
        if (amount === '' || isNaN(cashValue) || cashValue < 0) {
            setError('Please enter a valid amount (0 or more)');
            return;
        }

        const result = await closeShift(cashValue);
        if (result.success) {
            setClosedShiftResult(result.data);
            if (onSuccess) onSuccess('close');
        } else {
            setError(result.message);
        }
    };

    const handleForceCloseShift = async () => {
        if (!forceCloseShiftId) return;
        setError(null);

        const closingCash = parseFloat(forceCloseCash);
        if (forceCloseCash === '' || isNaN(closingCash) || closingCash < 0) {
            setError('Please enter a valid closing cash amount (0 or more)');
            return;
        }

        const confirmed = window.confirm(`Force close shift #${forceCloseShiftId}?`);
        if (!confirmed) return;

        const result = await closeShiftById(forceCloseShiftId, closingCash);
        if (result.success) {
            setSuccessMsg('Previous shift closed. You can open a new shift now.');
            setForceCloseShiftId(null);
            setForceCloseMachineId(null);
        } else {
            setError(result.message);
        }
    };

    // Live calculations
    const closingVal = parseFloat(amount) || 0;
    const expectedVal = shiftSummary?.expectedCash || 0;
    const diffVal = closingVal - expectedVal;

    if (!isOpen) return null;

    // 1. Loading State (Global)
    if (storeLoading && !closedShiftResult && !calculating) {
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
                    <p className="mt-4 text-gray-600 dark:text-gray-300">Processing...</p>
                </div>
            </div>
        );
    }

    // 2. Shift Closed Result (Final Summary)
    if (closedShiftResult) {
        const { expectedCash, closingCash, cashDifference } = closedShiftResult;
        const diffColor = cashDifference < 0 ? 'text-red-500' : (cashDifference > 0 ? 'text-green-500' : 'text-gray-500');

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Calculator className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-xl font-bold dark:text-white">Shift Closed Successfully</h2>
                        <p className="text-sm text-gray-500">The shift has been finalized.</p>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded">
                            <span className="text-gray-600 dark:text-gray-300">Expected Cash:</span>
                            <span className="font-semibold dark:text-white">${expectedCash?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded">
                            <span className="text-gray-600 dark:text-gray-300">Counted Cash:</span>
                            <span className="font-semibold dark:text-white">${closingCash?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-600 pt-3">
                            <span className="text-gray-600 dark:text-gray-300 font-bold">Difference:</span>
                            <span className={`font-bold ${diffColor}`}>
                                {cashDifference > 0 ? '+' : ''}{cashDifference?.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // 3. Open/Close Form
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full p-6 transition-all ${currentShift ? 'max-w-2xl' : 'max-w-md'}`}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold dark:text-white">
                            {currentShift ? 'Close Shift' : 'Open Shift'}
                        </h2>
                        {machine && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Terminal: <span className="font-mono text-gray-700 dark:text-gray-300">{machine.name}</span>
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {!currentShift && forceCloseShiftId && (
                    <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/60 rounded text-sm">
                        <div className="flex items-center justify-between gap-2 text-yellow-800 dark:text-yellow-200 font-medium">
                            <span>
                                Existing open shift detected{forceCloseMachineId ? ` on Machine ${forceCloseMachineId}` : ''}.
                            </span>
                            <span className="text-xs text-yellow-700 dark:text-yellow-300">Shift #{forceCloseShiftId}</span>
                        </div>
                        <label className="block text-xs text-yellow-700 dark:text-yellow-300 mt-3 mb-1">
                            Closing Cash for Shift #{forceCloseShiftId}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-600 dark:text-yellow-300 font-bold">
                                {currencySymbol}
                            </span>
                            <input
                                type="number"
                                step="0.01"
                                value={forceCloseCash}
                                onChange={(e) => setForceCloseCash(e.target.value)}
                                className="w-full pl-8 pr-4 py-2 text-sm border rounded-md bg-white dark:bg-gray-800 border-yellow-200 dark:border-yellow-800/60 dark:text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                                placeholder="0.00"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleForceCloseShift}
                            className="mt-3 w-full py-2 px-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md font-medium transition-colors"
                        >
                            Force Close Shift
                        </button>
                    </div>
                )}

                {successMsg && (
                    <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-sm">
                        {successMsg}
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-8">
                    {/* LEFT COL: Summary (Only for closing) */}
                    {currentShift && (
                        <div className="flex-1 space-y-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Shift Summary</h3>
                            {calculating ? (
                                <div className="py-10 text-center text-gray-500">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    Calculating totals...
                                </div>
                            ) : (
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                                        <span className="text-gray-500">Opened By</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {shiftSummary?.opener?.firstName || 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                                        <span className="text-gray-500">Opened At</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {shiftSummary?.openedAt ? new Date(shiftSummary.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </span>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg space-y-2 mt-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500 flex items-center gap-2"><DollarSign className="w-3 h-3" /> Opening Cash</span>
                                            <span className="font-mono text-gray-900 dark:text-white">{currencySymbol}{shiftSummary?.openingCash?.toFixed(2)}</span>
                                        </div>

                                        <div className="border-t border-dashed border-gray-200 dark:border-gray-600 my-1 pt-1 space-y-1">
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>Gross Collected</span>
                                                <span>{currencySymbol}{shiftSummary?.totalCollected?.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-red-500">
                                                <span>Refunds</span>
                                                <span>-{currencySymbol}{shiftSummary?.totalRefunded?.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                                            <span className="flex items-center gap-2">Net Cash (Collected)</span>
                                            <span className="font-mono">{currencySymbol}{shiftSummary?.netCash?.toFixed(2)}</span>
                                        </div>

                                        <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between font-bold">
                                            <span className="text-gray-700 dark:text-gray-200">Expected in Drawer</span>
                                            <span className="text-gray-900 dark:text-white">{currencySymbol}{shiftSummary?.expectedCash?.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-center">
                                            <div className="text-xs text-blue-600 dark:text-blue-400 mb-1 flex items-center justify-center gap-1"><CreditCard className="w-3 h-3" /> Card</div>
                                            <div className="font-mono font-bold text-gray-800 dark:text-gray-200">${shiftSummary?.cardSales?.toFixed(2)}</div>
                                        </div>
                                        <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded text-center">
                                            <div className="text-xs text-purple-600 dark:text-purple-400 mb-1 flex items-center justify-center gap-1"><ArrowRightLeft className="w-3 h-3" /> Transfer</div>
                                            <div className="font-mono font-bold text-gray-800 dark:text-gray-200">${shiftSummary?.transferSales?.toFixed(2)}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* RIGHT COL: Input & Action */}
                    <div className="flex-1 flex flex-col justify-between">
                        <form onSubmit={currentShift ? handleCloseShift : handleOpenShift}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {currentShift ? 'Closing Cash Count (Drawer Count)' : 'Opening Cash Float'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-8 pr-4 py-3 text-lg border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>

                                {currentShift && !calculating && (
                                    <div className={`mt-4 p-4 rounded-lg border text-center transition-colors ${diffVal < 0
                                        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                        : diffVal > 0
                                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                            : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                                        }`}>
                                        <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Difference</div>
                                        <div className={`text-2xl font-bold font-mono ${diffVal < 0 ? 'text-red-500' : diffVal > 0 ? 'text-green-500' : 'text-gray-400'
                                            }`}>
                                            {diffVal > 0 ? '+' : ''}{diffVal.toFixed(2)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={`flex-1 py-2 px-4 text-white rounded font-medium shadow-md transition-all transform active:scale-95 ${currentShift
                                        ? 'bg-red-600 hover:bg-red-700 text-lg shadow-red-500/20'
                                        : 'bg-green-600 hover:bg-green-700 text-lg shadow-green-500/20'
                                        }`}
                                >
                                    {currentShift ? 'Confirm Close' : 'Open Shift'}
                                </button>
                            </div>

                            {/* Logout Option - Only when closing shift */}
                            {currentShift && onLogoutOnly && (
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
                                    <button
                                        type="button"
                                        onClick={onLogoutOnly}
                                        className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors"
                                    >
                                        Or Logout (Keep Shift Open)
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PosShiftModal;
