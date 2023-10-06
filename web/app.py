import os

from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv

from .parser_client import Client, Data

app = Flask(__name__)
p_client = Client()
data = Data()

load_dotenv()
app.config["version"] = os.getenv("VERSION", "...")
app.config["last_update"] = os.getenv("LAST_UPDATE", "")


@app.route("/")
def root():
    return render_template("root.html")


@app.route("/update-log")
def update_log():
    return render_template("update-log.html")


@app.route("/request")
def add_request():
    return render_template("request.html")


@app.route("/help")
def help():
    return render_template("help.html")


@app.route("/faq")
def faq():
    return render_template("faq.html")


@app.route("/clan")
def clan():
    data.update()
    return render_template("clan.html", clan_data=data.clan, clans_cnt=len(data.clan), users_cnt=len(data.user))


@app.route("/clan/<group_id>")
def clan_page(group_id: str):
    data.update()
    if group_id in data.clan_all:
        return render_template("clan_users.html", clan_data=data.clan_all.get(group_id))
    else:
        return render_template("404.html"), 404


@app.route("/setting")
def setting():
    return render_template("setting.html")


# ==== API SECTION ====

@app.route("/api/getSteamID")
def api_get_steam_id():
    data.update()
    arr: list = request.args.getlist("id")
    return jsonify({n: data.user[n]["Steam"]["steamID"] for n in arr if data.user.get(n, {}).get("Steam") and data.user[n].get("isPublic", True)})


@app.route("/api/clan/add/<group_id>")
def api_clan_add(group_id: str):
    if not group_id.isnumeric():
        return jsonify({"result": False, "message": "Invalid argument value"})
    if group_id in data.clan_blocklist:
        return jsonify({"result": False, "message": data.clan_blocklist.get(group_id)})
    skip_dupe = request.args.get("skip_dupe", "true") == "true"
    msg = p_client.send({"type": "clan", "group_id": group_id, "skip_dupe": skip_dupe})
    return jsonify({"result": msg == "OK", "message": msg})


@app.route("/api/clan/memberUpdate")
def api_clan_update():
    pass


@app.route("/api/user/update")
def api_user_update():
    pass


@app.route("/api/update")
def _update_db():
    data.update()
    return jsonify({"status": "success"})


# ==== ERROR HANDLING SECTION ====

@app.errorhandler(404)
def error_404(e):
    return render_template("404.html"), 404


if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0")
