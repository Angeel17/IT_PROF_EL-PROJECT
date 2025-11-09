// File: src/main.jsx (or src/index.jsx)

import React from 'react'
import ReactDOM from 'react-dom/client'
// Import the browser router
import { BrowserRouter } from 'react-router-dom' 
import App from './App.jsx'
import './index.css' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Wrap your App component here */}
    <BrowserRouter> 
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)