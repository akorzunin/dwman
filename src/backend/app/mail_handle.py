import os

from dotenv import load_dotenv
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema
from jinja2 import Template

load_dotenv()

smtp_conf = ConnectionConfig(
    MAIL_USERNAME=os.environ["MAIL_USERNAME"],
    MAIL_PASSWORD=os.environ["MAIL_PASSWORD"],
    MAIL_FROM=os.environ["MAIL_FROM"],
    MAIL_FROM_NAME="savespotifydw",
    MAIL_SERVER=os.environ["MAIL_SERVER"],
    MAIL_PORT=int(os.environ["MAIL_PORT"]),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
    SUPPRESS_SEND=int(os.getenv("MAIL_DRY_RUN", 1)),
)


def render_template(template_filename, context):
    with open(template_filename, encoding="utf-8") as file_:
        template = Template(file_.read())
    return template.render(context)


async def send_email(email: str, subject: str, mail_text: str):
    message = MessageSchema(
        subject=subject,
        recipients=[email],
        body=mail_text,
        subtype="html",
    )
    fm = FastMail(smtp_conf)
    await fm.send_message(message)


def render_notification_text(dw_link, user_id):
    return render_template(
        "src/frontend/templates/mail_notify.html",
        {
            "dw_link": dw_link,
            "host": "https://dwman.akorz-sw1.duckdns.org/",
            "unsubscribe": f"https://dwman.akorz-sw1.duckdns.org/app/user/{user_id}",
        },
    )


def render_save_pl_text(dw_link, user_id):
    return render_template(
        "src/frontend/templates/mail_save_pl.html",
        {
            "dw_link": dw_link,
            "host": "https://dwman.akorz-sw1.duckdns.org/",
            "unsubscribe": f"https://dwman.akorz-sw1.duckdns.org/app/user/{user_id}",
        },
    )
