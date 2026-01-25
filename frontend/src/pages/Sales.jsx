import React, { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import { useTranslation } from 'react-i18next';
import { usePosStore } from '../store';
import { toast } from 'react-hot-toast';
import { ShoppingCart, Trash2, Plus, Minus, Search, CreditCard, Banknote, Package, TrendingUp, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sales = () => {
    const { t } = useTranslation();
    const { currentShift } = usePosStore();
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, [search]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            params.append('active', 'true');
            const res = await apiClient.get(`/products?${params}`);
            if (res.data.success) setProducts(res.data.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product) => {
        if (!currentShift) return toast.error('Open a shift first!');
        const existing = cart.find(x => x.id === product.id);
        if (existing) {
            setCart(cart.map(x => x.id === product.id ? { ...x, qty: x.qty + 1 } : x));
        } else {
            setCart([...cart, { ...product, qty: 1 }]);
        }
        toast.success(`Added ${product.name} to cart`);
    };

    const updateQty = (id, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.qty + delta);
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    const setQty = (id, value) => {
        const nextQty = parseInt(value, 10);
        if (!Number.isFinite(nextQty) || nextQty < 1) return;
        setCart(prev => prev.map(item => (
            item.id === id ? { ...item, qty: nextQty } : item
        )));
    };

    const remove = (id) => {
        setCart(cart.filter(x => x.id !== id));
        toast.success('Removed from cart');
    };

    const total = cart.reduce((sum, item) => sum + (item.salePrice * item.qty), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

    const handleCheckout = async () => {
        if (!cart.length) return;
        try {
            await apiClient.post('/sales', {
                items: cart.map(x => ({ productId: x.id, qty: x.qty })),
                paymentMethod: 'cash',
                notes: 'Quick Sale'
            });
            toast.success('Sale Completed Successfully! 🎉');
            setCart([]);
        } catch (e) {
            toast.error('Sale Failed');
        }
    };

    return (
        <div className="h-full min-h-0 bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950/20 p-2 lg:p-4 overflow-hidden">
            <div className="h-full min-h-0 max-w-[1920px] mx-auto flex gap-4 lg:gap-6">

                {/* Left: Products Section */}
                <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">

                    {/* Header with Search */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl p-6"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/30">
                                <ShoppingCart className="text-white" size={28} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-purple-600 dark:from-white dark:to-purple-400">
                                    Point of Sale
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    Fast checkout and sales processing
                                </p>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                                placeholder="Search products by name or SKU..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {/* Shift Status Indicator */}
                        {!currentShift && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center gap-3">
                                <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                                    Shift is closed. Open a shift to start making sales.
                                </p>
                            </div>
                        )}
                        {currentShift && (
                            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl flex items-center gap-3">
                                <CheckCircle className="text-emerald-500 flex-shrink-0" size={20} />
                                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                    Shift is active and ready for sales
                                </p>
                            </div>
                        )}
                    </motion.div>

                    {/* Products Grid */}
                    <div className="flex-1 min-h-0 overflow-y-auto bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl p-6">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">Loading products...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                <AnimatePresence>
                                    {products.length === 0 ? (
                                        <div className="col-span-full py-20 text-center">
                                            <Package size={80} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No products found</h3>
                                            <p className="text-gray-500 dark:text-gray-400">Try adjusting your search.</p>
                                        </div>
                                    ) : products.map((p, index) => (
                                        <motion.div
                                            key={p.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            transition={{ delay: index * 0.03 }}
                                            onClick={() => addToCart(p)}
                                            className="group bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1"
                                        >
                                            <div className="relative h-32 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 flex items-center justify-center overflow-hidden">
                                                {p.imageUrl ? (
                                                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                                ) : (
                                                    <Package className="text-purple-300 dark:text-purple-700 group-hover:scale-110 transition-transform duration-300" size={50} />
                                                )}
                                                {p.stock > 0 && p.stock < 10 && (
                                                    <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow-lg">
                                                        Low
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-3 space-y-2">
                                                <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                    {p.name}
                                                </h3>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-lg font-black text-purple-600 dark:text-purple-400">
                                                        {p.salePrice}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        Stock: <span className="font-bold">{p.stock}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Cart Sidebar */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="w-[380px] h-full min-h-0 flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden"
                >
                    {/* Cart Header */}
                    <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-3 bg-purple-500 rounded-xl shadow-lg">
                                <ShoppingCart className="text-white" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">Cart</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{totalItems} items</p>
                            </div>
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <AnimatePresence>
                            {cart.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full flex flex-col items-center justify-center py-12"
                                >
                                    <ShoppingCart size={80} className="text-gray-300 dark:text-gray-600 mb-4" />
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cart is empty</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                                        Click on products to add them
                                    </p>
                                </motion.div>
                            ) : cart.map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <Package className="text-purple-500" size={24} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate mb-1">{item.name}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                {item.salePrice} EGP × {item.qty}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-white/10">
                                                    <button
                                                        onClick={() => updateQty(item.id, -1)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-l-lg transition-colors"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        inputMode="numeric"
                                                        value={item.qty}
                                                        onChange={(e) => setQty(item.id, e.target.value)}
                                                        className="w-12 px-1 text-center font-bold text-sm bg-transparent outline-none"
                                                    />
                                                    <button
                                                        onClick={() => updateQty(item.id, 1)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-r-lg transition-colors"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => remove(item.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-lg text-purple-600 dark:text-purple-400">
                                                {(item.salePrice * item.qty).toFixed(2)}
                                            </p>
                                            <p className="text-xs text-gray-500">EGP</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {/* Cart Footer */}
                    <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-slate-800/50 space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                                <span className="font-bold text-gray-900 dark:text-white">{total.toFixed(2)} EGP</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Tax (0%)</span>
                                <span className="font-bold text-gray-900 dark:text-white">0.00 EGP</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-lg font-bold text-gray-700 dark:text-gray-300">Total</span>
                                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
                                    {total.toFixed(2)} EGP
                                </span>
                            </div>

                            <button
                                onClick={handleCheckout}
                                disabled={!cart.length || !currentShift}
                                className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl transition-all ${cart.length && currentShift
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/30 hover:scale-[1.02] active:scale-95'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {!currentShift ? 'Shift Closed' : cart.length ? 'Complete Payment' : 'Cart Empty'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Sales;
