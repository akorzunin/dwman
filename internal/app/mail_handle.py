from jinja2 import Template

from internal.settings import DEPLOY_URL


def render_template(template_filename, context):
    with open(template_filename, encoding="utf-8") as file_:
        template = Template(file_.read())
    return template.render(context)


async def send_email(email: str, subject: str, mail_text: str):
    print(mail_text)


def render_notification_text(dw_link, user_id):
    return render_template(
        "web/templates/mail_notify.html",
        {
            "dw_link": dw_link,
            "host": f"{DEPLOY_URL.rstrip('/')}/",
            "unsubscribe": f"{DEPLOY_URL.rstrip('/')}/app/user/{user_id}",
        },
    )


def render_save_pl_text(dw_link, user_id):
    return render_template(
        "web/templates/mail_save_pl.html",
        {
            "dw_link": dw_link,
            "host": f"{DEPLOY_URL.rstrip('/')}/",
            "unsubscribe": f"{DEPLOY_URL.rstrip('/')}/app/user/{user_id}",
        },
    )
