import React, { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import { useTranslation } from 'react-i18next';
import { usePosStore } from '../store';
import { toast } from 'react-hot-toast';
import { ShoppingCart, Trash2, Plus, Minus, Search, CreditCard, Banknote } from 'lucide-react';

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
    };

    const updateQty = (id, delta) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.qty + delta);
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    const remove = (id) => setCart(cart.filter(x => x.id !== id));
    const total = cart.reduce((sum, item) => sum + (item.salePrice * item.qty), 0);

    const handleCheckout = async () => {
        if (!cart.length) return;
        try {
            await apiClient.post('/sales', {
                items: cart.map(x => ({ productId: x.id, qty: x.qty })),
                paymentMethod: 'cash',
                notes: 'Quick Sale'
            });
            toast.success('Sale Completed');
            setCart([]);
        } catch (e) {
            toast.error('Failed');
        }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] p-4 gap-4">
            {/* Products */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col p-4">
                <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                        <input
                            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
                    {loading ? <div className="col-span-full text-center">Loading...</div> :
                        products.length === 0 ? <div className="col-span-full text-center text-gray-500">No products</div> :
                            products.map(p => (
                                <div key={p.id}
                                    onClick={() => addToCart(p)}
                                    className="border dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:shadow-md transition bg-gray-50 dark:bg-gray-750">
                                    <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded mb-2 flex items-center justify-center">
                                        {p.imageUrl ?
                                            <img src={p.imageUrl} alt="" className="h-full w-full object-cover rounded" /> :
                                            <span className="text-2xl opacity-50">{p.name[0]}</span>
                                        }
                                    </div>
                                    <div className="font-bold truncate">{p.name}</div>
                                    <div className="text-blue-600 font-mono">{p.salePrice}</div>
                                    <div className="text-xs text-gray-500">Stock: {p.stock}</div>
                                </div>
                            ))}
                </div>
            </div>

            {/* Cart */}
            <div className="w-96 bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col p-4">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" /> Cart
                </h2>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {cart.map(item => (
                        <div key={item.id} className="flex gap-2 items-center p-2 border rounded dark:border-gray-700">
                            <div className="flex-1">
                                <div className="font-medium text-sm">{item.name}</div>
                                <div className="text-xs text-gray-500">{item.salePrice} x {item.qty}</div>
                            </div>
                            <div className="font-bold">{(item.salePrice * item.qty).toFixed(2)}</div>
                            <div className="flex flex-col gap-1">
                                <button onClick={() => updateQty(item.id, 1)} className="p-1 bg-gray-100 dark:bg-gray-700 rounded"><Plus size={12} /></button>
                                <button onClick={() => updateQty(item.id, -1)} className="p-1 bg-gray-100 dark:bg-gray-700 rounded"><Minus size={12} /></button>
                            </div>
                            <button onClick={() => remove(item.id)} className="text-red-500"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
                <div className="border-t mt-4 pt-4 dark:border-gray-700">
                    <div className="flex justify-between text-xl font-bold mb-4">
                        <span>Total</span>
                        <span>{total.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={handleCheckout}
                        disabled={!cart.length || !currentShift}
                        className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
                    >
                        PAY NOW
                    </button>
                    {!currentShift && <div className="text-red-500 text-xs text-center mt-2">Shift Closed</div>}
                </div>
            </div>
        </div>
    );
};

export default Sales;
