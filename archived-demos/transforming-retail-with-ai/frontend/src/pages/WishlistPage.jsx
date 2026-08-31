import React, { useEffect, useState } from "react";
import api from "../api";

function WishlistPage() {
  const [items, setItems] = useState([]);

  async function loadWishlist() {
    try {
      const res = await api.get("/wishlist");
      setItems(res.data);
    } catch {
      setItems([]);
    }
  }

  async function remove(productId) {
    await api.delete(`/wishlist/${productId}`);
    await loadWishlist();
  }

  useEffect(() => {
    loadWishlist();
  }, []);

  return (
    <div className="page">
      <h2 className="page-title">My Wishlist</h2>
      {items.length === 0 ? (
        <p>No items in wishlist yet.</p>
      ) : (
        <div className="product-grid">
          {items.map((item) => (
            <div key={item.wishlist_item_id} className="product-card">
              <div className="product-image">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} />
                ) : (
                  <span className="product-image-placeholder">No image</span>
                )}
              </div>
              <div className="product-body">
                <h3 className="product-name">{item.name}</h3>
                <div className="product-meta">
                  <span className="product-price">
                    ₹{Number(item.price).toFixed(2)}
                  </span>
                  <span className="product-stock">{item.category}</span>
                </div>
                <button
                  className="btn-secondary-sm"
                  onClick={() => remove(item.product_id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WishlistPage;
