import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Package, Check, ArrowLeft, LogIn, LogOut, X, Search, Filter, Home, User } from 'lucide-react';
import { supabase } from './supabaseClient';
import './App.css';
import "tailwindcss";


export default function SlingShop() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [view, setView] = useState('home');
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('signin');
  const [authData, setAuthData] = useState({ email: '', password: '', name: '' });
  const [shippingInfo, setShippingInfo] = useState({
    name: '',
    address: '',
    city: '',
    zipCode: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [gcashCode, setGcashCode] = useState('');
  const [showGcashModal, setShowGcashModal] = useState(false);
  const [addedToCart, setAddedToCart] = useState(null);
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColor, setSelectedColor] = useState('all');
  const [selectedSize, setSelectedSize] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    checkUser();
    fetchProducts();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchCart();
        fetchOrders();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchCart();
      fetchOrders();
      
      const cartChannel = supabase
        .channel('cart-changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'cart', filter: `user_id=eq.${user.id}` },
          () => fetchCart()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(cartChannel);
      };
    }
  }, [user]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    
    if (error) {
      showNotification('Error loading products', 'error');
      console.error(error);
    } else {
      setProducts(data || []);
    }
  };

  const fetchCart = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('cart')
      .select(`
        *,
        products (*)
      `)
      .eq('user_id', user.id);
    
    if (error) {
      console.error(error);
    } else {
      setCart(data || []);
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (*)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(error);
    } else {
      setOrders(data || []);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: authData.email,
        password: authData.password,
        options: {
          data: { name: authData.name }
        }
      });
      
      if (error) {
        showNotification(error.message, 'error');
      } else {
        showNotification('Account created! Please check your email to verify.');
        setAuthMode('signin');
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authData.email,
        password: authData.password
      });
      
      if (error) {
        showNotification(error.message, 'error');
      } else {
        showNotification('Welcome back!');
        setView('home');
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCart([]);
    setOrders([]);
    setView('home');
    showNotification('Signed out successfully');
  };

  const addToCart = async (product) => {
    if (!user) {
      setView('auth');
      showNotification('Please sign in to add items to cart', 'error');
      return;
    }

    const existingItem = cart.find(item => item.product_id === product.id);
    
    if (existingItem) {
      const { error } = await supabase
        .from('cart')
        .update({ quantity: existingItem.quantity + 1 })
        .eq('id', existingItem.id);

      if (error) {
        showNotification('Error updating cart', 'error');
        console.error(error);
      } else {
        setAddedToCart(product.id);
        setTimeout(() => setAddedToCart(null), 1000);
        showNotification('Added to cart!');
        fetchCart();
      }
    } else {
      const { error } = await supabase
        .from('cart')
        .insert({
          user_id: user.id,
          product_id: product.id,
          quantity: 1
        });

      if (error) {
        showNotification('Error adding to cart', 'error');
        console.error(error);
      } else {
        setAddedToCart(product.id);
        setTimeout(() => setAddedToCart(null), 1000);
        showNotification('Added to cart!');
        fetchCart();
      }
    }
  };

  const updateQuantity = async (cartItemId, currentQuantity, change) => {
    const newQuantity = currentQuantity + change;
    
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    const { error } = await supabase
      .from('cart')
      .update({ quantity: newQuantity })
      .eq('id', cartItemId);

    if (error) {
      showNotification('Error updating cart', 'error');
      console.error(error);
    } else {
      fetchCart();
    }
  };

  const removeFromCart = async (cartItemId) => {
    const { error } = await supabase
      .from('cart')
      .delete()
      .eq('id', cartItemId);

    if (error) {
      showNotification('Error removing item', 'error');
      console.error(error);
    } else {
      showNotification('Item removed');
      fetchCart();
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      showNotification('Your cart is empty', 'error');
      return;
    }
    setView('checkout');
    setShowCart(false);
  };

  const generateGcashCode = () => {
    // Generate a unique GCash reference code
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `GCASH-${timestamp}-${randomStr}`;
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    
    // Validate shipping info
    if (!shippingInfo.name || !shippingInfo.address || !shippingInfo.city || !shippingInfo.zipCode) {
      showNotification('Please fill in all shipping details', 'error');
      return;
    }

    // If GCash is selected, generate payment code
    let paymentCode = null;
    if (paymentMethod === 'GCASH') {
      paymentCode = generateGcashCode();
      setGcashCode(paymentCode);
      setShowGcashModal(true);
      return; // Don't place order yet, show GCash modal first
    }

    // For COD, place order immediately
    await completeOrder(paymentMethod, paymentCode);
  };

  const completeOrder = async (method, code = null) => {
    const shippingAddress = {
      name: shippingInfo.name,
      address: shippingInfo.address,
      city: shippingInfo.city,
      zipCode: shippingInfo.zipCode
    };

    // Create order with payment info
    const { data: orderData, error: orderError } = await supabase.rpc('place_order', {
      p_shipping_address: shippingAddress
    });

    if (orderError) {
      showNotification(orderError.message, 'error');
      console.error(orderError);
      return;
    }

    // Update order with payment method and code
    if (orderData && orderData.length > 0) {
      const orderId = orderData[0].id;
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_method: method,
          payment_code: code,
          payment_status: method === 'COD' ? 'Pending' : 'Awaiting Payment'
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error updating payment info:', updateError);
      }
    }

    setView('success');
    showNotification('Order placed successfully!');
    setShippingInfo({ name: '', address: '', city: '', zipCode: '' });
    setPaymentMethod('COD');
    setShowGcashModal(false);
    
    setTimeout(() => {
      setView('home');
      fetchOrders();
    }, 3000);
  };

  const handleGcashConfirm = async () => {
    await completeOrder('GCASH', gcashCode);
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.products.price * item.quantity), 0);

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesColor = selectedColor === 'all' || product.color === selectedColor;
    const matchesSize = selectedSize === 'all' || product.size === selectedSize;
    
    return matchesSearch && matchesCategory && matchesColor && matchesSize;
  });

  // Get unique values for filters
  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  const colors = ['all', ...new Set(products.map(p => p.color).filter(Boolean))];
  const sizes = ['all', ...new Set(products.map(p => p.size).filter(Boolean))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-300 to-slate-900 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-300 to-slate-900">
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
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-slide-in { animation: slideInRight 0.3s ease-out; }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out; }
        .animate-scale-in { animation: scaleIn 0.3s ease-out; }
        .animate-pulse-once { animation: pulse 0.3s ease-out; }
        .animate-slide-down { animation: slideDown 0.3s ease-out; }
        .glass {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .product-card {
          transition: all 0.3s ease;
        }
        .product-card:hover {
          transform: translateY(-8px);
        }
        .cart-item {
          animation: fadeInUp 0.3s ease-out;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .spinner {
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-top: 4px solid #a855f7;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
      `}</style>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-4 rounded-lg shadow-lg animate-slide-down ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        }`}>
          <p className="text-white font-semibold">{notification.message}</p>
        </div>
      )}

      {/* GCash Payment Modal */}
      {showGcashModal && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-50"
            onClick={() => setShowGcashModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="glass rounded-xl p-8 max-w-md w-full animate-scale-in">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CreditCard className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2">GCash Payment</h2>
                <p className="text-slate-300 mb-6">
                  Please use this reference code for your GCash payment
                </p>

                <div className="bg-slate-800 rounded-lg p-6 mb-6">
                  <p className="text-slate-400 text-sm mb-2">Reference Code</p>
                  <p className="text-2xl font-bold text-purple-400 mb-4 font-mono tracking-wider">
                    {gcashCode}
                  </p>
                  <div className="border-t border-slate-700 pt-4 mt-4">
                    <p className="text-slate-400 text-sm mb-2">Amount to Pay</p>
                    <p className="text-3xl font-bold text-white">
                      ₱{totalPrice.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <p className="text-blue-300 text-sm">
                    <strong>Instructions:</strong><br />
                    1. Open your GCash app<br />
                    2. Send ₱{totalPrice.toFixed(2)} to: <strong>09123456789</strong><br />
                    3. Use reference code: <strong>{gcashCode}</strong><br />
                    4. Click "Confirm Payment" below after sending
                  </p>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowGcashModal(false)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGcashConfirm}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition-all hover:shadow-lg hover:shadow-purple-500/50"
                  >
                    Confirm Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <header className="glass sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setView('home')} className="flex items-center space-x-3">
              <Package className="w-8 h-8 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">Sling Shop</h1>
            </button>
            
            <div className="flex items-center space-x-4">
              {user && (
                <>
                  <button
                    onClick={() => setView('home')}
                    className="hidden sm:flex items-center space-x-2 text-white hover:text-purple-400 transition-colors"
                  >
                    <Home className="w-5 h-5" />
                    <span className="font-semibold">Home</span>
                  </button>
                  <button
                    onClick={() => setView('orders')}
                    className="hidden sm:block text-white hover:text-purple-400 transition-colors font-semibold"
                  >
                    My Orders
                  </button>
                  <button
                    onClick={() => setView('profile')}
                    className="hidden sm:flex items-center space-x-2 text-white hover:text-purple-400 transition-colors"
                  >
                    <User className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowCart(!showCart)}
                    className="relative p-2 text-white hover:text-purple-400 transition-colors"
                  >
                    <ShoppingCart className="w-6 h-6" />
                    {totalItems > 0 && (
                      <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {totalItems}
                      </span>
                    )}
                  </button>
                </>
              )}
              
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={() => setView('auth')}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Cart Sidebar */}
      {showCart && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowCart(false)}
          />
          <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-slate-800 z-50 shadow-2xl animate-slide-in overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Your Cart</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
              
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Your cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map((item, index) => (
                      <div
                        key={item.id}
                        className="cart-item glass rounded-lg p-4"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex items-center space-x-4">
                          <img
                            src={item.products.image_url || 'https://via.placeholder.com/80'}
                            alt={item.products.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <div className="flex-1">
                            <h3 className="text-white font-semibold text-sm">{item.products.name}</h3>
                            <p className="text-purple-400 font-bold">${item.products.price}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-2 hover:bg-red-500/20 rounded-full transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity, -1)}
                              className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center transition-colors"
                            >
                              <Minus className="w-4 h-4 text-white" />
                            </button>
                            <span className="text-white font-bold w-8 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity, 1)}
                              className="w-8 h-8 bg-purple-600 hover:bg-purple-500 rounded-full flex items-center justify-center transition-colors"
                            >
                              <Plus className="w-4 h-4 text-white" />
                            </button>
                          </div>
                          <span className="text-white font-bold">
                            ${(item.products.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-slate-700 pt-4 mb-4">
                    <div className="flex justify-between text-lg font-bold text-white">
                      <span>Total:</span>
                      <span className="text-purple-400">${totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleCheckout}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-lg transition-all hover:shadow-lg hover:shadow-purple-500/50"
                  >
                    Proceed to Checkout
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'home' && (
          <div className="animate-fade-in-up">
            {/* Hero Section */}
            <div className="glass rounded-xl p-12 mb-12 text-center">
              <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6">
                Welcome to Sling Shop
              </h1>
              <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
                Your ultimate destination for premium sling bags. Style meets functionality with our curated collection.
              </p>
              <button
                onClick={() => setView('products')}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 py-4 rounded-lg transition-all hover:shadow-lg hover:shadow-purple-500/50"
              >
                Shop Now
              </button>
            </div>

            {/* Featured Categories */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-white mb-6">Shop by Category</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.filter(c => c !== 'all').map((category, index) => (
                  <button
                    key={category}
                    onClick={() => {
                      setView('products');
                      setSelectedCategory(category);
                    }}
                    className="glass rounded-xl p-8 hover:bg-white/20 transition-all animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <Package className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white capitalize">{category}</h3>
                  </button>
                ))}
              </div>
            </div>

            {/* Featured Products */}
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Featured Products</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.slice(0, 4).map((product, index) => (
                  <div
                    key={product.id}
                    className="product-card glass rounded-xl overflow-hidden animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="relative overflow-hidden h-64">
                      <img
                        src={product.image_url || 'https://via.placeholder.com/400'}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                      />
                    </div>
                    
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-white mb-2">{product.name}</h3>
                      <p className="text-slate-300 text-sm mb-4 line-clamp-2">
                        {product.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-purple-400">
                          ${product.price}
                        </span>
                        <button
                          onClick={() => addToCart(product)}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-purple-500/50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'profile' && user && (
          <div className="max-w-2xl mx-auto animate-fade-in-up">
            <button
              onClick={() => setView('home')}
              className="flex items-center space-x-2 text-purple-400 hover:text-purple-300 mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </button>

            <div className="glass rounded-xl p-8">
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">{user.user_metadata?.name || 'User'}</h2>
                  <p className="text-slate-400">{user.email}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Account Information</h3>
                  <div className="space-y-3">
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <p className="text-slate-400 text-sm mb-1">Email</p>
                      <p className="text-white font-semibold">{user.email}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <p className="text-slate-400 text-sm mb-1">Member Since</p>
                      <p className="text-white font-semibold">
                        {new Date(user.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Quick Stats</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass rounded-lg p-6 text-center">
                      <p className="text-3xl font-bold text-purple-400 mb-2">{orders.length}</p>
                      <p className="text-slate-300">Total Orders</p>
                    </div>
                    <div className="glass rounded-lg p-6 text-center">
                      <p className="text-3xl font-bold text-purple-400 mb-2">{totalItems}</p>
                      <p className="text-slate-300">Items in Cart</p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => setView('orders')}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition-all"
                  >
                    View Orders
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-white font-bold py-3 rounded-lg transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'auth' && (
          <div className="max-w-md mx-auto animate-fade-in-up">
            <div className="glass rounded-xl p-8">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">
                {authMode === 'signin' ? 'Sign In' : 'Create Account'}
              </h2>
              
              <div className="space-y-4">
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-white mb-2 font-semibold">Name</label>
                    <input
                      type="text"
                      value={authData.name}
                      onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
                      placeholder="John Doe"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-white mb-2 font-semibold">Email</label>
                  <input
                    type="email"
                    value={authData.email}
                    onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-white mb-2 font-semibold">Password</label>
                  <input
                    type="password"
                    value={authData.password}
                    onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                
                <button
                  onClick={handleAuth}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-lg transition-all hover:shadow-lg hover:shadow-purple-500/50"
                >
                  {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
                
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                    setAuthData({ email: '', password: '', name: '' });
                  }}
                  className="w-full text-purple-400 hover:text-purple-300 transition-colors text-center"
                >
                  {authMode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'products' && (
          <>
            {/* Search and Filters */}
            <div className="mb-8 animate-fade-in-up">
              <div className="glass rounded-xl p-6">
                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search sling bags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Filter Toggle Button */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                  <span className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {/* Filters */}
                {showFilters && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in-up">
                    {/* Category Filter */}
                    <div>
                      <label className="block text-white mb-2 font-semibold text-sm">Category</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>
                            {cat === 'all' ? 'All Categories' : cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Color Filter */}
                    <div>
                      <label className="block text-white mb-2 font-semibold text-sm">Color</label>
                      <select
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
                      >
                        {colors.map(color => (
                          <option key={color} value={color}>
                            {color === 'all' ? 'All Colors' : color}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Size Filter */}
                    <div>
                      <label className="block text-white mb-2 font-semibold text-sm">Size</label>
                      <select
                        value={selectedSize}
                        onChange={(e) => setSelectedSize(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
                      >
                        {sizes.map(size => (
                          <option key={size} value={size}>
                            {size === 'all' ? 'All Sizes' : size}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Active Filters Display */}
                {(searchQuery || selectedCategory !== 'all' || selectedColor !== 'all' || selectedSize !== 'all') && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {searchQuery && (
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center space-x-2">
                        <span>Search: {searchQuery}</span>
                        <button onClick={() => setSearchQuery('')} className="hover:text-white">×</button>
                      </span>
                    )}
                    {selectedCategory !== 'all' && (
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center space-x-2">
                        <span>{selectedCategory}</span>
                        <button onClick={() => setSelectedCategory('all')} className="hover:text-white">×</button>
                      </span>
                    )}
                    {selectedColor !== 'all' && (
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center space-x-2">
                        <span>{selectedColor}</span>
                        <button onClick={() => setSelectedColor('all')} className="hover:text-white">×</button>
                      </span>
                    )}
                    {selectedSize !== 'all' && (
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center space-x-2">
                        <span>{selectedSize}</span>
                        <button onClick={() => setSelectedSize('all')} className="hover:text-white">×</button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="text-center mb-12 animate-fade-in-up">
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                Premium Sling Bags
              </h2>
              <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                Discover our collection of stylish and functional sling bags
              </p>
              <p className="text-slate-400 mt-2">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="product-card glass rounded-xl overflow-hidden animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="relative overflow-hidden h-64">
                    <img
                      src={product.image_url || 'https://via.placeholder.com/400'}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                    />
                    {addedToCart === product.id && (
                      <div className="absolute inset-0 bg-green-500/90 flex items-center justify-center animate-scale-in">
                        <Check className="w-16 h-16 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2">{product.name}</h3>
                    <p className="text-slate-300 text-sm mb-2 line-clamp-2">
                      {product.description}
                    </p>
                    
                    {/* Product Details */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {product.category && (
                        <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                          {product.category}
                        </span>
                      )}
                      {product.color && (
                        <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                          {product.color}
                        </span>
                      )}
                      {product.size && (
                        <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded">
                          {product.size}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-purple-400">
                        ${product.price}
                      </span>
                      <button
                        onClick={() => addToCart(product)}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-purple-500/50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'checkout' && (
          <div className="max-w-2xl mx-auto animate-fade-in-up">
            <button
              onClick={() => setView('home')}
              className="flex items-center space-x-2 text-purple-400 hover:text-purple-300 mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </button>
            
            <div className="glass rounded-xl p-8">
              <h2 className="text-3xl font-bold text-white mb-6">Checkout</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-white mb-2 font-semibold">Full Name</label>
                  <input
                    type="text"
                    required
                    value={shippingInfo.name}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                
                <div>
                  <label className="block text-white mb-2 font-semibold">Address</label>
                  <input
                    type="text"
                    required
                    value={shippingInfo.address}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="123 Main St"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white mb-2 font-semibold">City</label>
                    <input
                      type="text"
                      required
                      value={shippingInfo.city}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
                      placeholder="New York"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white mb-2 font-semibold">Zip Code</label>
                    <input
                      type="text"
                      required
                      value={shippingInfo.zipCode}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, zipCode: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
                      placeholder="10001"
                    />
                  </div>
                </div>
                
                <div className="border-t border-slate-700 pt-6">
                  <h3 className="text-white font-bold text-lg mb-4">Payment Method</h3>
                  
                  <div className="space-y-3 mb-6">
                    <label className="flex items-center space-x-3 p-4 bg-slate-800 rounded-lg border-2 border-slate-700 hover:border-purple-500 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="payment"
                        value="COD"
                        checked={paymentMethod === 'COD'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-5 h-5 text-purple-600"
                      />
                      <div className="flex-1">
                        <p className="text-white font-semibold">Cash on Delivery (COD)</p>
                        <p className="text-slate-400 text-sm">Pay when you receive your order</p>
                      </div>
                      <Package className="w-6 h-6 text-purple-400" />
                    </label>

                    <label className="flex items-center space-x-3 p-4 bg-slate-800 rounded-lg border-2 border-slate-700 hover:border-purple-500 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="payment"
                        value="GCASH"
                        checked={paymentMethod === 'GCASH'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-5 h-5 text-purple-600"
                      />
                      <div className="flex-1">
                        <p className="text-white font-semibold">GCash</p>
                        <p className="text-slate-400 text-sm">Pay now via GCash mobile wallet</p>
                      </div>
                      <CreditCard className="w-6 h-6 text-blue-400" />
                    </label>
                  </div>

                  <div className="flex justify-between text-lg font-bold text-white mb-6">
                    <span>Total Amount:</span>
                    <span className="text-purple-400">${totalPrice.toFixed(2)}</span>
                  </div>
                  
                  <button
                    onClick={handlePlaceOrder}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-lg transition-all hover:shadow-lg hover:shadow-purple-500/50 flex items-center justify-center space-x-2"
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>{paymentMethod === 'COD' ? 'Place Order' : 'Proceed to GCash Payment'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'success' && (
          <div className="max-w-md mx-auto text-center animate-scale-in">
            <div className="glass rounded-xl p-12">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse-once">
                <Check className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-4">Order Successful!</h2>
              <p className="text-slate-300 mb-8">
                Thank you for your purchase. Your order has been confirmed and will be shipped soon.
              </p>
              
              <div className="text-purple-400 text-sm">
                Redirecting to home...
              </div>
            </div>
          </div>
        )}

        {view === 'orders' && (
          <div className="animate-fade-in-up">
            <button
              onClick={() => setView('home')}
              className="flex items-center space-x-2 text-purple-400 hover:text-purple-300 mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </button>

            <h2 className="text-4xl font-bold text-white mb-8">My Orders</h2>

            {orders.length === 0 ? (
              <div className="text-center py-12 glass rounded-xl">
                <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No orders yet</p>
              </div>
            ) : (
              <div className="space-y-6">
                {orders.map((order, index) => (
                  <div
                    key={order.id}
                    className="glass rounded-xl p-6 animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 pb-4 border-b border-slate-700">
                      <div>
                        <h3 className="text-white font-bold text-lg mb-2">
                          Order #{order.id.slice(0, 8)}
                        </h3>
                        <p className="text-slate-400 text-sm">
                          {new Date(order.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="mt-2 sm:mt-0 flex items-center space-x-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          order.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          order.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {order.status}
                        </span>
                        <span className="text-purple-400 font-bold text-xl">
                          ${parseFloat(order.total).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="flex items-center space-x-4">
                          <img
                            src={item.products.image_url || 'https://via.placeholder.com/60'}
                            alt={item.products.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <div className="flex-1">
                            <h4 className="text-white font-semibold">{item.products.name}</h4>
                            <p className="text-slate-400 text-sm">
                              Quantity: {item.quantity} × ${parseFloat(item.price_at_purchase).toFixed(2)}
                            </p>
                          </div>
                          <span className="text-white font-bold">
                            ${(item.quantity * parseFloat(item.price_at_purchase)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.shipping_address && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <h4 className="text-white font-semibold mb-2">Shipping Address</h4>
                        <p className="text-slate-400 text-sm">
                          {order.shipping_address.name}<br />
                          {order.shipping_address.address}<br />
                          {order.shipping_address.city}, {order.shipping_address.zipCode}
                        </p>
                      </div>
                    )}

                    {order.payment_method && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <h4 className="text-white font-semibold mb-2">Payment Information</h4>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-slate-400 text-sm">Payment Method</p>
                            <p className="text-white font-semibold">
                              {order.payment_method === 'COD' ? 'Cash on Delivery' : 'GCash'}
                            </p>
                          </div>
                          {order.payment_code && (
                            <div className="text-right">
                              <p className="text-slate-400 text-sm">Reference Code</p>
                              <p className="text-purple-400 font-mono font-semibold text-sm">
                                {order.payment_code}
                              </p>
                            </div>
                          )}
                        </div>
                        {order.payment_status && (
                          <div className="mt-2">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                              order.payment_status === 'Paid' ? 'bg-green-500/20 text-green-400' :
                              order.payment_status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {order.payment_status}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
