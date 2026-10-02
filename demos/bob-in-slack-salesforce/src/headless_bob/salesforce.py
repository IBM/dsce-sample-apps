"""Salesforce client for the case flow: cases, Chatter posts, opportunities
and the predefined changes the service deploys after a human approves.

Deliberately service-side, not a Bob tool: credentials live in the service
environment and Bob never sees them (docs/deployment-approaches.md).

Auth: JWT bearer flow against an External Client App (or Connected App):
    HB_SF_LOGIN_URL     e.g. https://login.salesforce.com
    HB_SF_CLIENT_ID     the app's consumer key
    HB_SF_USERNAME      integration user's username
    HB_SF_PRIVATE_KEY_B64  base64 of the app's RSA private key (PEM)
"""

import base64
import time

import httpx
import jwt

API = "/services/data/v60.0"


class SalesforceError(RuntimeError):
    pass


class SalesforceClient:
    def __init__(self, login_url: str, client_id: str, username: str, private_key_pem: str):
        self.login_url = login_url.rstrip("/")
        self.client_id = client_id
        self.username = username
        self.private_key_pem = private_key_pem
        self._token: str | None = None
        self._instance: str = ""
        self._token_at: float = 0.0

    @classmethod
    def from_env(cls, env: dict) -> "SalesforceClient | None":
        login = env.get("HB_SF_LOGIN_URL", "")
        cid = env.get("HB_SF_CLIENT_ID", "")
        user = env.get("HB_SF_USERNAME", "")
        key_b64 = env.get("HB_SF_PRIVATE_KEY_B64", "")
        if not (login and cid and user and key_b64):
            return None
        return cls(login, cid, user, base64.b64decode(key_b64).decode())

    # -- auth ----------------------------------------------------------------

    def _ensure_token(self) -> None:
        if self._token and time.time() - self._token_at < 45 * 60:
            return
        assertion = jwt.encode(
            {
                "iss": self.client_id,
                "sub": self.username,
                "aud": self.login_url,
                "exp": int(time.time()) + 300,
            },
            self.private_key_pem,
            algorithm="RS256",
        )
        response = httpx.post(
            f"{self.login_url}/services/oauth2/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
            timeout=20,
        )
        payload = response.json()
        if "access_token" not in payload:
            raise SalesforceError(f"Salesforce auth failed: {payload.get('error_description', payload)}")
        self._token = payload["access_token"]
        self._instance = payload["instance_url"].rstrip("/")
        self._token_at = time.time()

    def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        """One HTTP call with a single re-auth + retry on 401. Salesforce
        revokes live tokens when an admin edits the connected app, the user,
        or session policies — the cached token then dies before its 45-min
        refresh; a retry with a fresh JWT login keeps the demo beat alive."""
        self._ensure_token()
        for attempt in (1, 2):
            response = httpx.request(
                method, f"{self._instance}{path}",
                headers={"Authorization": f"Bearer {self._token}"}, timeout=20, **kwargs)
            if response.status_code == 401 and attempt == 1:
                self._token = None
                self._ensure_token()
                continue
            return response
        return response

    def _get(self, path: str, **params) -> dict:
        response = self._request("GET", path, params=params)
        if response.status_code >= 300:
            raise SalesforceError(f"GET {path} -> {response.status_code}: {response.text[:200]}")
        return response.json()

    def _post(self, path: str, body: dict) -> dict:
        response = self._request("POST", path, json=body)
        if response.status_code >= 300:
            raise SalesforceError(f"POST {path} -> {response.status_code}: {response.text[:200]}")
        return response.json() if response.text else {}

    def _patch(self, path: str, body: dict) -> None:
        response = self._request("PATCH", path, json=body)
        if response.status_code >= 300:
            raise SalesforceError(f"PATCH {path} -> {response.status_code}: {response.text[:200]}")

    def _delete(self, path: str) -> None:
        response = self._request("DELETE", path)
        if response.status_code >= 300:
            raise SalesforceError(f"DELETE {path} -> {response.status_code}: {response.text[:200]}")

    def _soql(self, query: str) -> list[dict]:
        return self._get(f"{API}/query", q=query).get("records", [])

    # -- lookups -------------------------------------------------------------

    def find_opportunity(self, name_contains: str) -> dict | None:
        safe = name_contains.replace("'", "\\'")
        records = self._soql(
            f"SELECT Id, Name FROM Opportunity WHERE Name LIKE '%{safe}%' LIMIT 1"
        )
        return records[0] if records else None

    def create_case(self, subject: str, description: str, supplied_email: str = "",
                    supplied_name: str = "", owner_id: str | None = None) -> dict:
        result = self._post(f"{API}/sobjects/Case", {
            "Subject": subject[:255],
            "Description": description[:30000],
            "Origin": "Web",
            "Status": "New",
            **({"SuppliedEmail": supplied_email} if supplied_email else {}),
            **({"SuppliedName": supplied_name[:80]} if supplied_name else {}),
            **({"OwnerId": owner_id} if owner_id else {}),
        })
        case = self._get(f"{API}/sobjects/Case/{result['id']}")
        return {"Id": result["id"], "CaseNumber": case.get("CaseNumber", ""),
                "Subject": subject}

    def attach_to_case(self, case_id: str, title: str, body: str) -> None:
        text = f"{title}\n\n{body}"
        if len(text) > 9000:
            text = text[:9000] + "\n… (truncated)"
        try:
            self._post(f"{API}/chatter/feed-elements", {
                "feedElementType": "FeedItem",
                "subjectId": case_id,
                "body": {"messageSegments": [{"type": "Text", "text": text}]},
            })
        except SalesforceError as exc:
            # Orgs without Chatter (FUNCTIONALITY_NOT_ENABLED): fall back to
            # a Case Comment so the summary still lands on the record.
            if "FUNCTIONALITY_NOT_ENABLED" not in str(exc):
                raise
            self._post(f"{API}/sobjects/CaseComment", {
                "ParentId": case_id,
                "CommentBody": text[:4000],
                "IsPublished": True,
            })

    def get_case_status(self, case_id: str) -> dict | None:
        """None when the case no longer exists (deleted — the org is shared with
        IDE users who may clean up 'stray' cases)."""
        response = self._request("GET", f"{API}/sobjects/Case/{case_id}",
                                 params={"fields": "Id,IsClosed,IsDeleted"})
        if response.status_code == 404:
            return None
        if response.status_code >= 300:
            raise SalesforceError(f"GET Case/{case_id} -> {response.status_code}: {response.text[:200]}")
        data = response.json()
        return None if data.get("IsDeleted") else data

    def close_case(self, case_id: str) -> None:
        self._patch(f"{API}/sobjects/Case/{case_id}", {"Status": "Closed"})

    def delete_case(self, case_id: str) -> None:
        self._delete(f"{API}/sobjects/Case/{case_id}")

    # -- Tooling API: the real org change ------------------------------------

    def deploy_validation_rule(self, *, object_name: str, rule_name: str,
                               formula: str, error_message: str) -> str:
        """Create an active Validation Rule; returns its Tooling id."""
        # Tooling API allows ONLY FullName + Metadata on create; the target
        # object is encoded in FullName ("Opportunity.Rule_Name").
        result = self._post("/services/data/v60.0/tooling/sobjects/ValidationRule", {
            "FullName": f"{object_name}.{rule_name}",
            "Metadata": {
                "active": True,
                "description": "Deployed by Bob (sample) — auto-removed on case close.",
                "errorConditionFormula": formula,
                "errorMessage": error_message,
                "errorDisplayField": None,
            },
        })
        return result.get("id", "")

    def user_id_for(self, username: str) -> str | None:
        rows = self._soql(f"SELECT Id FROM User WHERE Username = '{username}' AND IsActive = true")
        return rows[0]["Id"] if rows else None

    def get_instance_url(self) -> str:
        self._ensure_token()
        return self._instance

    def delete_validation_rule(self, rule_id: str) -> None:
        self._delete(f"/services/data/v60.0/tooling/sobjects/ValidationRule/{rule_id}")
