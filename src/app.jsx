// File: src/App.jsx

import React from 'react';
// Import the necessary routing components
import { Routes, Route, Navigate } from 'react-router-dom';

// Import your newly separated components
import AdminDashboard from './AdminDashboard'; 
import SlingShop from './SlingShop';           

export default function App() {
  return (
    // <Routes> defines the routing area
    <Routes>
      
      {/* Route for the Admin Dashboard */}
      <Route 
        path="/sling-shop-admin" 
        element={<AdminDashboard />} 
      />
      
      {/* Route for the public Shop/User interface */}
      <Route 
        path="/sling-shop-user" 
        element={<SlingShop />} 
      />
      
      {/* Redirect the base URL to the user shop */}
      <Route path="/" element={<Navigate to="/sling-shop-user" replace />} />

      {/* Catch-all for any other path (404 Page) */}
      <Route path="*" element={
        <div style={{ padding: '50px', textAlign: 'center' }}>
          <h1>404 Not Found</h1>
          <p>The requested page was not found.</p>
        </div>
      } />
    </Routes>
  );
}