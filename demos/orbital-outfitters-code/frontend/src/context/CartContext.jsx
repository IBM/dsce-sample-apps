import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cartCount, setCartCount] = useState(0);
  const { isLoggedIn } = useAuth();

  async function refreshCartCount() {
    if (!isLoggedIn) {
      setCartCount(0);
      return;
    }
    try {
      const res = await axiosClient.get('/cart');
      setCartCount(res.data.item_count || 0);
    } catch {
      setCartCount(0);
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      refreshCartCount();
    } else {
      setCartCount(0);
    }
  }, [isLoggedIn]);

  return (
    <CartContext.Provider value={{ cartCount, refreshCartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}

export default CartContext;
