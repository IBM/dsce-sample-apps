// ==================== USER IDENTITY ====================
// Calls analytics.identify() once per page load when an IBM w3id session
// is present, or when a Segment ajs_user_id cookie exists from a prior
// IBM property visit (e.g. developer.ibm.com).
//
// Priority:
//   1. w3id JWT in localStorage ('w3id_token') — full traits available
//   2. Segment cookie ('ajs_user_id') — userId only, no traits
//
// IBM w3id sets a JWT in localStorage under the key 'w3id_token' after SSO.
// The token payload contains: sub (IBMid / IUI), email, name (givenName + sn),
// isIBMEmployee. All fields are read-only from the client side; no auth logic
// is performed here — we only read what the SSO flow has already stored.
//
// Call order: identify() must be called BEFORE any track() calls on the page.
// baseof.html loads this module before the other JS bundles.

(function () {
  if (!window.analytics) return;

  // ── Helper: read a cookie by name ────────────────────────────────────────
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  // ── 1. Try to read the w3id JWT from localStorage ────────────────────────
  var raw = null;
  try {
    raw = localStorage.getItem('w3id_token');
  } catch (e) {
    // localStorage blocked (private browsing, cross-origin frame, etc.)
  }

  if (raw) {
    // ── 2. Decode the JWT payload (base64url, middle segment) ──────────────
    var payload = null;
    try {
      var parts = raw.split('.');
      if (parts.length === 3) {
        var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        payload = JSON.parse(atob(b64));
      }
    } catch (e) {
      // Malformed token — fall through to cookie fallback
    }

    if (payload) {
      // ── 3. Check expiry ─────────────────────────────────────────────────
      var expired = payload.exp && Date.now() / 1000 > payload.exp;

      if (!expired) {
        // ── 4. Build the identify traits ──────────────────────────────────
        var userId = payload.sub || payload.uid || payload.iui || null;

        if (userId) {
          var traits = {};
          if (payload.email)        traits.email       = payload.email;
          if (payload.name)         traits.name        = payload.name;
          if (payload.given_name)   traits.firstName   = payload.given_name;
          if (payload.family_name)  traits.lastName    = payload.family_name;
          if (typeof payload.isEmployee !== 'undefined') {
            traits.isIBMer = Boolean(payload.isEmployee);
          } else {
            traits.isIBMer = (payload.emailtype === 'IBMER' || payload.realm === 'IBMid');
          }
          if (payload.locale) traits.locale = payload.locale;

          // ── 5. Fire identify with full traits ───────────────────────────
          window.analytics.identify(userId, traits);
          return; // Done — no need to check cookie fallback
        }
      }
    }
  }

  // ── 6. Fallback: read Segment's ajs_user_id cookie ───────────────────────
  // Set by Segment on a prior identify() call from any IBM property on the
  // same domain (e.g. developer.ibm.com). No traits available — userId only.
  var ajsUserId = getCookie('ajs_user_id');
  if (ajsUserId) {
    window.analytics.identify(ajsUserId);
  }
})();
