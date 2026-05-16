"""Email service using Gmail SMTP.

Falls back to logging when SMTP is not configured.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def send_invite_email(to_email: str, org_name: str, role: str, invite_token: str, inviter_name: str) -> bool:
    """Send an invitation email with the accept link."""
    logger.info("[EMAIL] send_invite_email called — to=%s, org=%s, role=%s, inviter=%s", to_email, org_name, role, inviter_name)
    invite_url = f"{settings.frontend_url}/invite/{invite_token}"
    subject = f"You've been invited to join {org_name}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin: 0;">LoopBoard Analytics</h1>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
            <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px;">You're invited!</h2>
            <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                <strong>{inviter_name}</strong> has invited you to join <strong>{org_name}</strong> as
                <strong style="text-transform: capitalize;">{role}</strong>.
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{invite_url}"
                   style="display: inline-block; background: #2563eb; color: #ffffff; font-size: 15px;
                          font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
                    Accept Invitation
                </a>
            </div>
            <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">
                This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.
            </p>
            <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0 16px;" />
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Can't click the button? Copy this link:<br/>
                <a href="{invite_url}" style="color: #2563eb; word-break: break-all;">{invite_url}</a>
            </p>
        </div>
    </div>
    """
    text = (
        f"{inviter_name} has invited you to join {org_name} as {role}.\n\n"
        f"Accept your invitation: {invite_url}\n\n"
        f"This invitation expires in 7 days."
    )
    return _send(to_email, subject, html, text)


def send_alert_email(to_emails: list[str], rule_name: str, severity: str, org_name: str,
                     metric: str, operator: str, threshold: float, actual_value: float,
                     event_type: str) -> bool:
    """Send alert notification email."""
    severity_colors = {"critical": "#dc2626", "warning": "#f59e0b", "info": "#3b82f6"}
    color = severity_colors.get(severity, "#6b7280")

    subject = f"[{severity.upper()}] Alert: {rule_name}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin: 0;">LoopBoard Analytics</h1>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
            <div style="display: inline-block; background: {color}; color: #fff; font-size: 12px;
                        font-weight: 600; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;
                        margin-bottom: 16px;">
                {severity}
            </div>
            <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 16px;">{rule_name}</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Organization</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 500;">{org_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Event Type</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 500;">{event_type}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Condition</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 500;">{metric} {operator} {threshold}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Actual Value</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; color: {color};">{actual_value}</td>
                </tr>
            </table>
            <div style="text-align: center; margin-top: 24px;">
                <a href="{settings.frontend_url}/alerts"
                   style="display: inline-block; background: #2563eb; color: #ffffff; font-size: 14px;
                          font-weight: 600; padding: 10px 24px; border-radius: 8px; text-decoration: none;">
                    View Alerts
                </a>
            </div>
        </div>
    </div>
    """
    text = (
        f"[{severity.upper()}] Alert: {rule_name}\n\n"
        f"Organization: {org_name}\n"
        f"Event Type: {event_type}\n"
        f"Condition: {metric} {operator} {threshold}\n"
        f"Actual Value: {actual_value}\n\n"
        f"View alerts: {settings.frontend_url}/alerts"
    )
    success = True
    for email in to_emails:
        if not _send(email, subject, html, text):
            success = False
    return success


def _send(to_email: str, subject: str, html: str, text: str) -> bool:
    """Send an email via Gmail SMTP or log to console."""
    logger.info("[EMAIL] _send called — to=%s, subject=%s", to_email, subject)
    logger.info("[EMAIL] SMTP config — host=%s, port=%s, user=%s, password_set=%s",
                settings.smtp_host, settings.smtp_port, settings.smtp_user, bool(settings.smtp_password))

    if not settings.smtp_user or not settings.smtp_password:
        logger.info("[EMAIL-LOG] No SMTP credentials — To: %s | Subject: %s | %s", to_email, subject, text[:200])
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.smtp_sender_name} <{settings.smtp_user}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))

        port = settings.smtp_port
        if port == 465:
            logger.info("[EMAIL] Connecting via SMTP_SSL to %s:%s ...", settings.smtp_host, port)
            with smtplib.SMTP_SSL(settings.smtp_host, port, timeout=15) as server:
                logger.info("[EMAIL] Connected. Logging in as %s ...", settings.smtp_user)
                server.login(settings.smtp_user, settings.smtp_password)
                logger.info("[EMAIL] Logged in. Sending to %s ...", to_email)
                server.sendmail(settings.smtp_user, to_email, msg.as_string())
        else:
            logger.info("[EMAIL] Connecting via STARTTLS to %s:%s ...", settings.smtp_host, port)
            with smtplib.SMTP(settings.smtp_host, port, timeout=15) as server:
                server.starttls()
                logger.info("[EMAIL] STARTTLS done. Logging in as %s ...", settings.smtp_user)
                server.login(settings.smtp_user, settings.smtp_password)
                logger.info("[EMAIL] Logged in. Sending to %s ...", to_email)
                server.sendmail(settings.smtp_user, to_email, msg.as_string())

        logger.info("[EMAIL] Successfully sent to %s: %s", to_email, subject)
        return True
    except Exception:
        logger.exception("[EMAIL] Failed to send email to %s", to_email)
        return False
