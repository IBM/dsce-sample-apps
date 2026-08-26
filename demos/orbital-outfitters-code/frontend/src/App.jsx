import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginModal from './components/LoginModal';

import HomePage from './pages/HomePage';
import ProductListingPage from './pages/ProductListingPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import AgenticSearchPage from './pages/AgenticSearchPage';
import AccountPage from './pages/AccountPage';

// Protected pages handle the login modal themselves (Cart, Orders, Account do it inline).
// This wrapper is used by Checkout and OrderDetail which don't have built-in login handling.
function ProtectedRoute({ children, message = 'Please sign in to access this page.' }) {
  const { isLoggedIn } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!isLoggedIn && !dismissed) {
    return (
      <LoginModal
        onClose={() => setDismissed(true)}
        message={message}
      />
    );
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/products" element={<ProductListingPage />} />
      <Route path="/products/:id" element={<ProductDetailPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={
        <ProtectedRoute message="Please sign in to checkout.">
          <CheckoutPage />
        </ProtectedRoute>
      } />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:id" element={<OrderDetailPage />} />
      <Route path="/search" element={<AgenticSearchPage />} />
      <Route path="/account" element={<AccountPage />} />
    </Routes>
  );
}
