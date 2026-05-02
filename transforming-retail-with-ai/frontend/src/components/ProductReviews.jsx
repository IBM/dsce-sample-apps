import React, { useEffect, useState } from "react";
import api from "../api";

function ProductReviews({ productId }) {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  async function loadReviews() {
    try {
      const res = await api.get(`/products/${productId}/reviews`);
      setReviews(res.data);
    } catch {
      setReviews([]);
    }
  }

  useEffect(() => {
    if (productId) {
      loadReviews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post(`/products/${productId}/reviews`, { rating, comment });
      setComment("");
      setRating(5);
      await loadReviews();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add review");
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ marginBottom: 8 }}>Reviews</h4>
      {reviews.length === 0 ? (
        <p style={{ fontSize: 13, color: "#6b7280" }}>No reviews yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13 }}>
          {reviews.map((r) => (
            <li
              key={r.id}
              style={{
                borderBottom: "1px solid #e5e7eb",
                padding: "6px 0"
              }}
            >
              <div style={{ fontWeight: 500 }}>
                {r.username} • {r.rating}★
              </div>
              {r.comment && <div>{r.comment}</div>}
              <div style={{ fontSize: 11, color: "#9ca3af" }}>
                {new Date(r.created_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 10, fontSize: 13 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #d1d5db" }}
          >
            {[5, 4, 3, 2, 1].map((v) => (
              <option key={v} value={v}>
                {v} star{v > 1 ? "s" : ""}
              </option>
            ))}
          </select>
          <input
            placeholder="Add a short review..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #d1d5db"
            }}
          />
          <button
            type="submit"
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "none",
              backgroundColor: "#2563eb",
              color: "#fff",
              cursor: "pointer"
            }}
          >
            Post
          </button>
        </div>
        {error && (
          <div style={{ color: "#b91c1c", fontSize: 12 }}>{error}</div>
        )}
      </form>
    </div>
  );
}

export default ProductReviews;
