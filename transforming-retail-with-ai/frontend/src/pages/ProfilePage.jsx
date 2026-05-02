import React, { useEffect, useState } from "react";
import api from "../api";

function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");

  async function loadProfile() {
    try {
      const res = await api.get("/me");
      setProfile(res.data);
      setAddress(res.data.default_address || "");
    } catch (err) {
      setProfile(null);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function handleSave() {
    setMessage("");
    try {
      await api.put("/me/address", { defaultAddress: address });
      setMessage("Address updated.");
      await loadProfile();

      const stored = localStorage.getItem("authUser");
      if (stored) {
        try {
          const user = JSON.parse(stored);
          user.default_address = address;
          localStorage.setItem("authUser", JSON.stringify(user));
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setMessage("Unable to update address.");
    }
  }

  if (!profile) {
    return (
      <div className="page">
        <h2 className="page-title">My Profile</h2>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="page-title">My Profile</h2>
      <p>
        <strong>Username:</strong> {profile.username}
      </p>
      <p>
        <strong>Joined:</strong>{" "}
        {new Date(profile.created_at).toLocaleDateString()}
      </p>
      <p>
        <strong>Role:</strong> {profile.is_admin ? "Admin" : "User"}
      </p>

      <div className="checkout-section" style={{ marginTop: 16 }}>
        <label className="field-label">
          Default delivery address
          <textarea
            className="field-input textarea"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter default address"
          />
        </label>
        <button className="btn-primary" onClick={handleSave}>
          Save
        </button>
        {message && <div className="info-text">{message}</div>}
      </div>
    </div>
  );
}

export default ProfilePage;
