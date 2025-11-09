import React, { useState, useEffect } from 'react';
import { Users, Package, ShoppingBag, Edit, Trash2, Plus, X, Upload, Search, Filter, LogOut, Eye, Check, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fxootarxevbxtnzoqrgm.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4b290YXJ4ZXZieHRuem9xcmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTc4MzksImV4cCI6MjA3ODE5MzgzOX0.PEkkT4OjPltYkp7zMpgjRXUUWD6obzl4JjNyokzD1hU';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  
  // Data states
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalProducts: 0, totalOrders: 0, totalRevenue: 0 });
  
  // Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    color: '',
    size: '',
    image_url: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, activeTab]);

  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
    }
    setLoading(false);
  };

  const fetchData = async () => {
    try {
      if (activeTab === 'dashboard' || activeTab === 'users') {
        await fetchUsers();
      }
      if (activeTab === 'dashboard' || activeTab === 'products') {
        await fetchProducts();
      }
      if (activeTab === 'dashboard' || activeTab === 'orders') {
        await fetchOrders();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(error);
    } else {
      setUsers(data || []);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(error);
    } else {
      setProducts(data || []);
    }
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        profiles(name, email),
        order_items(
          *,
          products(name, image_url)
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(error);
    } else {
      setOrders(data || []);
      
      // Calculate stats
      const totalRevenue = data.reduce((sum, order) => sum + parseFloat(order.total), 0);
      setStats({
        totalUsers: users.length,
        totalProducts: products.length,
        totalOrders: data.length,
        totalRevenue
      });
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Image upload to Supabase Storage
  const uploadImage = async (file) => {
    try {
      setUploading(true);
      
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setUploading(false);
      return publicUrl;
    } catch (error) {
      setUploading(false);
      console.error('Error uploading image:', error);
      showNotification('Error uploading image', 'error');
      return null;
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    
    let imageUrl = productForm.image_url;
    
    // Upload new image if selected
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
      if (!imageUrl) return;
    }

    const productData = {
      ...productForm,
      price: parseFloat(productForm.price),
      image_url: imageUrl
    };

    if (editingProduct) {
      // Update existing product
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id);

      if (error) {
        showNotification('Error updating product', 'error');
        console.error(error);
      } else {
        showNotification('Product updated successfully');
        setShowProductModal(false);
        resetProductForm();
        fetchProducts();
      }
    } else {
      // Create new product
      const { error } = await supabase
        .from('products')
        .insert([productData]);

      if (error) {
        showNotification('Error creating product', 'error');
        console.error(error);
      } else {
        showNotification('Product created successfully');
        setShowProductModal(false);
        resetProductForm();
        fetchProducts();
      }
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      showNotification('Error deleting product', 'error');
      console.error(error);
    } else {
      showNotification('Product deleted successfully');
      fetchProducts();
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      category: product.category || '',
      color: product.color || '',
      size: product.size || '',
      image_url: product.image_url || ''
    });
    setImagePreview(product.image_url || '');
    setShowProductModal(true);
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      description: '',
      price: '',
      category: '',
      color: '',
      size: '',
      image_url: ''
    });
    setImageFile(null);
    setImagePreview('');
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      showNotification('Error updating order status', 'error');
      console.error(error);
    } else {
      showNotification('Order status updated');
      fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    }
  };

  const handleUpdatePaymentStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: newStatus })
      .eq('id', orderId);

    if (error) {
      showNotification('Error updating payment status', 'error');
      console.error(error);
    } else {
      showNotification('Payment status updated');
      fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, payment_status: newStatus });
      }
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="glass rounded-xl p-8 max-w-md w-full">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">Admin Login</h2>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const email = formData.get('email');
            const password = formData.get('password');
            
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) {
              showNotification(error.message, 'error');
            } else {
              showNotification('Welcome back!');
            }
          }}>
            <div className="space-y-4">
              <div>
                <label className="block text-white mb-2 font-semibold">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-white mb-2 font-semibold">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition-all"
              >
                Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeInUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .glass {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .spinner {
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-top: 4px solid #a855f7;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out; }
        .animate-scale-in { animation: scaleIn 0.3s ease-out; }
        .animate-slide-down { animation: slideDown 0.3s ease-out; }
      `}</style>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg animate-slide-down ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        }`}>
          <p className="text-white font-semibold">{notification.message}</p>
        </div>
      )}

      {/* Header */}
      <header className="glass sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Package className="w-8 h-8 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-white hidden sm:inline">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Package },
              { id: 'products', label: 'Products', icon: Package },
              { id: 'orders', label: 'Orders', icon: ShoppingBag },
              { id: 'users', label: 'Users', icon: Users }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-purple-400 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-semibold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in-up">
            <h2 className="text-3xl font-bold text-white mb-8">Overview</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="glass rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <Users className="w-8 h-8 text-blue-400" />
                  <span className="text-3xl font-bold text-white">{users.length}</span>
                </div>
                <p className="text-slate-300 font-semibold">Total Users</p>
              </div>

              <div className="glass rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <Package className="w-8 h-8 text-green-400" />
                  <span className="text-3xl font-bold text-white">{products.length}</span>
                </div>
                <p className="text-slate-300 font-semibold">Total Products</p>
              </div>

              <div className="glass rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <ShoppingBag className="w-8 h-8 text-purple-400" />
                  <span className="text-3xl font-bold text-white">{orders.length}</span>
                </div>
                <p className="text-slate-300 font-semibold">Total Orders</p>
              </div>

              <div className="glass rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <Package className="w-8 h-8 text-yellow-400" />
                  <span className="text-3xl font-bold text-white">${stats.totalRevenue.toFixed(2)}</span>
                </div>
                <p className="text-slate-300 font-semibold">Total Revenue</p>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="glass rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Recent Orders</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 font-semibold py-3 px-4">Order ID</th>
                      <th className="text-left text-slate-400 font-semibold py-3 px-4">Customer</th>
                      <th className="text-left text-slate-400 font-semibold py-3 px-4">Total</th>
                      <th className="text-left text-slate-400 font-semibold py-3 px-4">Status</th>
                      <th className="text-left text-slate-400 font-semibold py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map(order => (
                      <tr key={order.id} className="border-b border-slate-800 hover:bg-white/5">
                        <td className="py-3 px-4 text-white font-mono text-sm">#{order.id.slice(0, 8)}</td>
                        <td className="py-3 px-4 text-white">{order.profiles?.email || 'N/A'}</td>
                        <td className="py-3 px-4 text-purple-400 font-bold">${parseFloat(order.total).toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            order.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            order.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-sm">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Products View */}
        {activeTab === 'products' && (
          <div className="animate-fade-in-up">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-3xl font-bold text-white">Products</h2>
              <button
                onClick={() => {
                  resetProductForm();
                  setShowProductModal(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Add Product</span>
              </button>
            </div>

            {/* Search */}
            <div className="glass rounded-xl p-4 mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map(product => (
                <div key={product.id} className="glass rounded-xl overflow-hidden">
                  <img
                    src={product.image_url || 'https://via.placeholder.com/300'}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="text-white font-bold mb-2">{product.name}</h3>
                    <p className="text-slate-400 text-sm mb-2 line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-purple-400 font-bold text-xl">${product.price}</span>
                      {product.category && (
                        <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                          {product.category}
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orders View */}
        {activeTab === 'orders' && (
          <div className="animate-fade-in-up">
            <h2 className="text-3xl font-bold text-white mb-6">Orders</h2>

            {/* Search and Filter */}
            <div className="glass rounded-xl p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Orders List */}
            <div className="space-y-4">
              {filteredOrders.map(order => (
                <div key={order.id} className="glass rounded-xl p-6">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 gap-4">
                    <div>
                      <h3 className="text-white font-bold text-lg mb-1">
                        Order #{order.id.slice(0, 8)}
                      </h3>
                      <p className="text-slate-400 text-sm">
                        {order.profiles?.email || 'N/A'} • {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-purple-400 font-bold text-xl">
                        ${parseFloat(order.total).toFixed(2)}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowOrderModal(true);
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      order.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      order.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                      order.status === 'Cancelled' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {order.status}
                    </span>
                    {order.payment_method && (
                      <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-xs font-semibold">
                        {order.payment_method}
                      </span>
                    )}
                    {order.payment_status && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.payment_status === 'Paid' ? 'bg-green-500/20 text-green-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {order.payment_status}
                      </span>
                    )}
                  </div>

                  <div className="text-slate-400 text-sm">
                    {order.order_items.length} item(s) • 
                    {order.shipping_address && ` ${order.shipping_address.city}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users View */}
        {activeTab === 'users' && (
          <div className="animate-fade-in-up">
            <h2 className="text-3xl font-bold text-white mb-6">Users</h2>

            {/* Search */}
            <div className="glass rounded-xl p-4 mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Users Table */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 font-semibold py-4 px-6">Name</th>
                      <th className="text-left text-slate-400 font-semibold py-4 px-6">Email</th>
                      <th className="text-left text-slate-400 font-semibold py-4 px-6">Joined</th>
                      <th className="text-left text-slate-400 font-semibold py-4 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="border-b border-slate-800 hover:bg-white/5">
                        <td className="py-4 px-6 text-white">{user.name || 'N/A'}</td>
                        <td className="py-4 px-6 text-slate-300">{user.email}</td>
                        <td className="py-4 px-6 text-slate-400 text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserModal(true);
                            }}
                            className="flex items-center space-x-2 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Product Modal */}
      {showProductModal && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-50"
            onClick={() => setShowProductModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="glass rounded-xl p-8 max-w-2xl w-full my-8 animate-scale-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              <form onSubmit={handleProductSubmit} className="space-y-4">
                {/* Image Upload */}
                <div>
                  <label className="block text-white mb-2 font-semibold">Product Image</label>
                  <div className="flex flex-col items-center space-y-4">
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    )}
                    <label className="w-full cursor-pointer">
                      <div className="flex items-center justify-center space-x-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors">
                        <Upload className="w-5 h-5 text-purple-400" />
                        <span className="text-white font-semibold">
                          {uploading ? 'Uploading...' : 'Upload Image'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white mb-2 font-semibold">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                      placeholder="Sling Bag Pro"
                    />
                  </div>

                  <div>
                    <label className="block text-white mb-2 font-semibold">Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                      placeholder="29.99"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white mb-2 font-semibold">Description</label>
                  <textarea
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                    rows="3"
                    placeholder="Product description..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-white mb-2 font-semibold">Category</label>
                    <input
                      type="text"
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                      placeholder="Crossbody"
                    />
                  </div>

                  <div>
                    <label className="block text-white mb-2 font-semibold">Color</label>
                    <input
                      type="text"
                      value={productForm.color}
                      onChange={(e) => setProductForm({ ...productForm, color: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                      placeholder="Black"
                    />
                  </div>

                  <div>
                    <label className="block text-white mb-2 font-semibold">Size</label>
                    <input
                      type="text"
                      value={productForm.size}
                      onChange={(e) => setProductForm({ ...productForm, size: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                      placeholder="Medium"
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowProductModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading...' : editingProduct ? 'Update Product' : 'Create Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-50"
            onClick={() => setShowOrderModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="glass rounded-xl p-8 max-w-3xl w-full my-8 animate-scale-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Order #{selectedOrder.id.slice(0, 8)}
                </h2>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Customer Info */}
                <div className="glass rounded-lg p-4">
                  <h3 className="text-white font-bold mb-3">Customer Information</h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-slate-300">
                      <span className="text-slate-400">Email:</span> {selectedOrder.profiles?.email || 'N/A'}
                    </p>
                    <p className="text-slate-300">
                      <span className="text-slate-400">Date:</span> {new Date(selectedOrder.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Shipping Address */}
                {selectedOrder.shipping_address && (
                  <div className="glass rounded-lg p-4">
                    <h3 className="text-white font-bold mb-3">Shipping Address</h3>
                    <div className="text-slate-300 text-sm">
                      <p>{selectedOrder.shipping_address.name}</p>
                      <p>{selectedOrder.shipping_address.address}</p>
                      <p>{selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.zipCode}</p>
                    </div>
                  </div>
                )}

                {/* Payment Info */}
                <div className="glass rounded-lg p-4">
                  <h3 className="text-white font-bold mb-3">Payment Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Method:</span>
                      <span className="text-white font-semibold">
                        {selectedOrder.payment_method || 'N/A'}
                      </span>
                    </div>
                    {selectedOrder.payment_code && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Reference:</span>
                        <span className="text-purple-400 font-mono text-sm">
                          {selectedOrder.payment_code}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Payment Status:</span>
                      <select
                        value={selectedOrder.payment_status || 'Pending'}
                        onChange={(e) => handleUpdatePaymentStatus(selectedOrder.id, e.target.value)}
                        className="px-3 py-1 bg-slate-800 text-white rounded-lg border border-slate-700 text-sm"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Awaiting Payment">Awaiting Payment</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="glass rounded-lg p-4">
                  <h3 className="text-white font-bold mb-3">Order Items</h3>
                  <div className="space-y-3">
                    {selectedOrder.order_items.map(item => (
                      <div key={item.id} className="flex items-center space-x-4">
                        <img
                          src={item.products.image_url || 'https://via.placeholder.com/60'}
                          alt={item.products.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <h4 className="text-white font-semibold">{item.products.name}</h4>
                          <p className="text-slate-400 text-sm">
                            Qty: {item.quantity} × ${parseFloat(item.price_at_purchase).toFixed(2)}
                          </p>
                        </div>
                        <span className="text-white font-bold">
                          ${(item.quantity * parseFloat(item.price_at_purchase)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-700 mt-4 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold text-lg">Total:</span>
                      <span className="text-purple-400 font-bold text-2xl">
                        ${parseFloat(selectedOrder.total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Status */}
                <div className="glass rounded-lg p-4">
                  <h3 className="text-white font-bold mb-3">Order Status</h3>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleUpdateOrderStatus(selectedOrder.id, e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <button
                  onClick={() => setShowOrderModal(false)}
                  className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-50"
            onClick={() => setShowUserModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="glass rounded-xl p-8 max-w-2xl w-full my-8 animate-scale-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">User Details</h2>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              <div className="space-y-6">
                {/* User Info */}
                <div className="glass rounded-lg p-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-xl">{selectedUser.name || 'N/A'}</h3>
                      <p className="text-slate-400">{selectedUser.email}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">User ID:</span>
                      <span className="text-white font-mono">{selectedUser.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Joined:</span>
                      <span className="text-white">
                        {new Date(selectedUser.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* User Orders */}
                <div className="glass rounded-lg p-4">
                  <h3 className="text-white font-bold mb-3">Order History</h3>
                  <div className="space-y-2">
                    {orders
                      .filter(order => order.user_id === selectedUser.id)
                      .slice(0, 5)
                      .map(order => (
                        <div key={order.id} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
                          <div>
                            <p className="text-white font-semibold text-sm">
                              Order #{order.id.slice(0, 8)}
                            </p>
                            <p className="text-slate-400 text-xs">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-purple-400 font-bold">${parseFloat(order.total).toFixed(2)}</p>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              order.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    {orders.filter(order => order.user_id === selectedUser.id).length === 0 && (
                      <p className="text-slate-400 text-sm text-center py-4">No orders yet</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowUserModal(false)}
                  className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}