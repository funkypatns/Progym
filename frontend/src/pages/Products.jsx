import React, { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import { useTranslation } from 'react-i18next';

const Products = () => {
    const { t } = useTranslation();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

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

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="p-6">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                    {t('nav.products') || 'Products'}
                </h1>
                <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    onClick={() => alert('Add Product feature coming soon')}
                >
                    Add Product
                </button>
            </header>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-3 border-b dark:border-gray-600">Name</th>
                                <th className="px-6 py-3 border-b dark:border-gray-600">SKU</th>
                                <th className="px-6 py-3 border-b dark:border-gray-600">Price</th>
                                <th className="px-6 py-3 border-b dark:border-gray-600">Stock</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {products.length > 0 ? products.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition">
                                    <td className="px-6 py-4 text-gray-800 dark:text-gray-200">
                                        <div className="font-medium">{product.name}</div>
                                        {product.description && <div className="text-xs text-gray-500">{product.description}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-mono text-sm">
                                        {product.sku || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-800 dark:text-gray-200 font-bold">
                                        {product.salePrice}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${product.stock > 0
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            }`}>
                                            {product.stock}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500 italic">
                                        No products found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Products;
