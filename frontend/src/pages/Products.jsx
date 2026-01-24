import React, { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Package, ShoppingCart, Trash2, X, TrendingUp, DollarSign, Box, Edit3, ImagePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const Products = () => {
    const { t } = useTranslation();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState([]);
    const [showCartModal, setShowCartModal] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await apiClient.get('/products');
            if (response.data.success) {
                setProducts(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [newProduct, setNewProduct] = useState({ name: '', sku: '', salePrice: '', description: '', isActive: true });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [imageError, setImageError] = useState('');

    const resetModalState = () => {
        setNewProduct({ name: '', sku: '', salePrice: '', description: '', isActive: true });
        setEditingProduct(null);
        setImageFile(null);
        setImagePreview('');
        setImageError('');
    };

    const closeModal = () => {
        setShowModal(false);
        resetModalState();
    };

    const openAddModal = () => {
        resetModalState();
        setShowModal(true);
    };

    const openEditModal = (product) => {
        setEditingProduct(product);
        setNewProduct({
            name: product.name || '',
            sku: product.sku || '',
            salePrice: product.salePrice || '',
            description: product.description || '',
            isActive: product.isActive ?? true
        });
        setImageFile(null);
        setImagePreview(product.imageUrl || '');
        setImageError('');
        setShowModal(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setImageError('Supported formats: JPG, PNG, WEBP');
            setImageFile(null);
            return;
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setImageError('Max size is 5MB');
            setImageFile(null);
            return;
        }

        setImageError('');
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSaveProduct = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append('name', newProduct.name);
            payload.append('sku', newProduct.sku || '');
            payload.append('salePrice', newProduct.salePrice);
            payload.append('description', newProduct.description || '');
            payload.append('isActive', newProduct.isActive);
            if (imageFile) {
                payload.append('image', imageFile);
            }

            if (editingProduct) {
                await apiClient.put(`/products/${editingProduct.id}`, payload, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Product updated');
            } else {
                await apiClient.post('/products', payload, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Product added');
            }

            setShowModal(false);
            resetModalState();
            fetchProducts();
        } catch (error) {
            console.error(error);
            toast.error('Failed to save product');
        }
    };

    const addToCart = (product) => {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            setCart(cart.map(item =>
                item.id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const removeFromCart = (productId) => {
        setCart(cart.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId, delta) => {
        setCart(cart.map(item => {
            if (item.id === productId) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">{t('common.loading')}</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 p-2 lg:p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Enhanced Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-xl p-6"
                >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/30">
                                <ShoppingCart className="text-white" size={32} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-indigo-600 dark:from-white dark:to-indigo-400">
                                    {t('nav.products') || 'Point of Sale'}
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                                    Manage products and process sales
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={openAddModal}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-95"
                            >
                                <Plus size={20} />
                                Add Product
                            </button>

                            <button
                                onClick={() => setShowCartModal(true)}
                                className="relative p-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl transition-all hover:scale-110 border border-emerald-500/20"
                            >
                                <ShoppingCart size={24} />
                                {cartCount > 0 && (
                                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="mt-6 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search products by name or SKU..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                        />
                    </div>
                </motion.div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-6 shadow-lg"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                <Box className="text-blue-600 dark:text-blue-400" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Products</p>
                                <p className="text-3xl font-black text-gray-900 dark:text-white">{products.length}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-6 shadow-lg"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                                <TrendingUp className="text-emerald-600 dark:text-emerald-400" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">In Stock</p>
                                <p className="text-3xl font-black text-gray-900 dark:text-white">{products.filter(p => p.stock > 0).length}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 shadow-xl shadow-emerald-500/30"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
                                <DollarSign className="text-white" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white/80 uppercase tracking-wider">Cart Total</p>
                                <p className="text-3xl font-black text-white">{cartTotal.toFixed(2)}</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Products Grid */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                >
                    <AnimatePresence>
                        {filteredProducts.length > 0 ? filteredProducts.map((product, index) => (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: index * 0.05 }}
                                className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 overflow-hidden hover:-translate-y-1"
                            >
                                <div className="relative h-48 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 flex items-center justify-center overflow-hidden">
                                    {product.imageUrl ? (
                                        <img
                                            src={product.imageUrl}
                                            alt={product.name}
                                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center">
                                            <Package className="text-indigo-300 dark:text-indigo-700 group-hover:scale-110 transition-transform duration-300" size={80} />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => openEditModal(product)}
                                        className="absolute top-3 right-3 p-2 rounded-full bg-white/80 dark:bg-slate-900/80 text-indigo-600 dark:text-indigo-300 shadow-lg hover:scale-105 transition-transform"
                                        title="Edit Product"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    {product.stock <= 0 && (
                                        <div className="absolute top-3 left-3 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg">
                                            Out of Stock
                                        </div>
                                    )}
                                    {product.stock > 0 && product.stock < 10 && (
                                        <div className="absolute top-3 left-3 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full shadow-lg">
                                            Low Stock
                                        </div>
                                    )}
                                </div>

                                <div className="p-5 space-y-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {product.name}
                                        </h3>
                                        {product.sku && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">SKU: {product.sku}</p>
                                        )}
                                        {product.description && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">{product.description}</p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5">
                                        <div>
                                            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                                {product.salePrice}
                                                <span className="text-sm text-gray-500 ml-1">EGP</span>
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                Stock: <span className="font-bold">{product.stock || 0}</span>
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => addToCart(product)}
                                            disabled={product.stock <= 0}
                                            className={`p-3 rounded-xl font-bold transition-all ${product.stock > 0
                                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 hover:scale-110'
                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )) : (
                            <div className="col-span-full py-20 text-center">
                                <Package size={80} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No products found</h3>
                                <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or add a new product.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            {/* Add Product Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                        onClick={closeModal}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-white/10"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                                <h3 className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                                </h3>
                                <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                                    <X size={24} className="text-gray-500" />
                                </button>
                            </div>
                            <form onSubmit={handleSaveProduct} className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Product Image</label>
                                        <div className="relative w-full aspect-square rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-slate-800/50 overflow-hidden flex items-center justify-center">
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-gray-400">
                                                    <ImagePlus size={32} />
                                                    <span className="text-xs font-semibold">Upload</span>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                onChange={handleImageChange}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                        </div>
                                        {imageError && (
                                            <p className="text-xs font-semibold text-red-500">{imageError}</p>
                                        )}
                                    </div>

                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Product Name *</label>
                                            <input
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-slate-800 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                                required
                                                value={newProduct.name}
                                                onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">SKU</label>
                                                <input
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-slate-800 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                                    value={newProduct.sku}
                                                    onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Price (EGP) *</label>
                                                <input
                                                    type="number" step="0.01"
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-slate-800 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                                    required
                                                    value={newProduct.salePrice}
                                                    onChange={e => setNewProduct({ ...newProduct, salePrice: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Description</label>
                                            <textarea
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-slate-800 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none"
                                                rows="4"
                                                value={newProduct.description}
                                                onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={closeModal} className="px-6 py-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 font-bold transition-all">Cancel</button>
                                    <button type="submit" className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02]">
                                        {editingProduct ? 'Update Product' : 'Save Product'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cart Modal */}
            <AnimatePresence>
                {showCartModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md"
                        onClick={() => setShowCartModal(false)}
                    >
                        <motion.div
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: "100%", opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500 rounded-xl">
                                        <ShoppingCart className="text-white" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Shopping Cart</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{cartCount} items</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowCartModal(false)} className="p-2 hover:bg-white/50 dark:hover:bg-white/5 rounded-xl transition-colors">
                                    <X size={24} className="text-gray-500" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                                {cart.length > 0 ? cart.map((item) => (
                                    <motion.div
                                        key={item.id}
                                        layout
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5"
                                    >
                                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl flex items-center justify-center overflow-hidden">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <Package className="text-indigo-500" size={28} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-900 dark:text-white truncate">{item.name}</h4>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{item.salePrice} EGP each</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateQuantity(item.id, -1)}
                                                className="w-8 h-8 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-bold transition-colors"
                                            >
                                                -
                                            </button>
                                            <span className="w-12 text-center font-bold text-gray-900 dark:text-white">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.id, 1)}
                                                className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-lg text-gray-900 dark:text-white">{(item.salePrice * item.quantity).toFixed(2)}</p>
                                            <p className="text-xs text-gray-500">EGP</p>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </motion.div>
                                )) : (
                                    <div className="py-16 text-center">
                                        <ShoppingCart size={80} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Cart is empty</h3>
                                        <p className="text-gray-500 dark:text-gray-400">Add products to get started</p>
                                    </div>
                                )}
                            </div>

                            {cart.length > 0 && (
                                <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-slate-800/50 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-lg font-bold text-gray-700 dark:text-gray-300">Total</span>
                                        <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                                            {cartTotal.toFixed(2)} EGP
                                        </span>
                                    </div>
                                    <button className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02]">
                                        Complete Purchase
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Products;
