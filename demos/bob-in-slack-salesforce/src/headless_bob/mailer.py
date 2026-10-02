"""Outbound email: the case-closure note to the requester.

Env-driven transports (Gmail API via OAuth refresh token, or SMTP):

    HB_MAIL_TRANSPORT       gmail | smtp | "" (disabled)
    HB_GMAIL_CLIENT_ID / HB_GMAIL_CLIENT_SECRET / HB_GMAIL_REFRESH_TOKEN
    HB_MAIL_FROM            sender address (and display identity)
    HB_SMTP_HOST / HB_SMTP_PORT / HB_SMTP_USER / HB_SMTP_PASSWORD

Sending is best-effort and NEVER raises into the flow — callers get a bool.
The only recipient is HB_CASE_REQUESTER_EMAIL, the case's requester.
"""

import base64
from email.message import EmailMessage
import logging
import smtplib
import ssl

import httpx

LOGGER = logging.getLogger("headless_bob.mailer")


class Mailer:
    def __init__(self, env: dict):
        self.transport = (env.get("HB_MAIL_TRANSPORT") or "").strip().lower()
        self.from_addr = env.get("HB_MAIL_FROM", "")
        self.gmail_client_id = env.get("HB_GMAIL_CLIENT_ID", "")
        self.gmail_client_secret = env.get("HB_GMAIL_CLIENT_SECRET", "")
        self.gmail_refresh_token = env.get("HB_GMAIL_REFRESH_TOKEN", "")
        self.smtp_host = env.get("HB_SMTP_HOST", "")
        self.smtp_port = int(env.get("HB_SMTP_PORT", "587") or 587)
        self.smtp_user = env.get("HB_SMTP_USER", "")
        self.smtp_password = env.get("HB_SMTP_PASSWORD", "")

    @property
    def configured(self) -> bool:
        if self.transport == "gmail":
            return bool(self.gmail_client_id and self.gmail_client_secret
                        and self.gmail_refresh_token and self.from_addr)
        if self.transport == "smtp":
            return bool(self.smtp_host and self.from_addr)
        return False

    def send(self, to: str, subject: str, body: str,
             attachments: list[tuple[str, bytes, str]] | None = None) -> bool:
        """Best-effort send. Returns success; never raises.
        attachments: [(filename, bytes, mime e.g. "text/csv")]"""
        if not self.configured:
            LOGGER.info("mailer not configured; skipping send to %s", to)
            return False
        try:
            if self.transport == "gmail":
                self._send_gmail(to, subject, body, attachments)
            else:
                self._send_smtp(to, subject, body, attachments)
            return True
        except Exception:
            LOGGER.exception("email send failed (to=%s)", to)
            return False

    # -- transports -----------------------------------------------------------

    def _build(self, to: str, subject: str, body: str,
               attachments: list | None) -> EmailMessage:
        message = EmailMessage()
        message["To"] = to
        message["From"] = self.from_addr
        message["Subject"] = subject
        message.set_content(body)
        for filename, data, mime in attachments or []:
            maintype, _, subtype = mime.partition("/")
            message.add_attachment(data, maintype=maintype, subtype=subtype or "octet-stream",
                                   filename=filename)
        return message

    def _gmail_access_token(self) -> str:
        response = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": self.gmail_client_id,
                "client_secret": self.gmail_client_secret,
                "refresh_token": self.gmail_refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=20,
        )
        payload = response.json()
        token = payload.get("access_token")
        if not token:
            raise RuntimeError(f"gmail token refresh failed: {payload.get('error_description', payload)}")
        return token

    def _send_gmail(self, to: str, subject: str, body: str,
                    attachments: list | None = None) -> None:
        message = self._build(to, subject, body, attachments)
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        response = httpx.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            json={"raw": raw},
            headers={"Authorization": f"Bearer {self._gmail_access_token()}"},
            timeout=20,
        )
        if response.status_code >= 300:
            raise RuntimeError(f"gmail send -> {response.status_code}: {response.text[:200]}")

    def _send_smtp(self, to: str, subject: str, body: str,
                   attachments: list | None = None) -> None:
        message = self._build(to, subject, body, attachments)
        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=20) as server:
            server.starttls(context=ssl.create_default_context())
            if self.smtp_user:
                server.login(self.smtp_user, self.smtp_password)
            server.send_message(message)


def closure_email(case_number: str, summary: str) -> tuple[str, str]:
    subject = f"Your case {case_number} has been resolved"
    body = (
        f"Good news — case {case_number} was resolved and closed.\n\n"
        f"Resolution summary:\n{summary}\n\n"
        "This resolution was proposed, implemented, and verified by Bob,\n"
        "with each step approved by the Salesforce product owner.\n\n"
        "— Bob\n"
    )
    return subject, body
