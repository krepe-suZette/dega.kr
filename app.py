import json
from flask import Flask, render_template, jsonify, request

from parser_client import Client


app = Flask("main")
p_client = Client(("localhost", 50001))
with open("data/clan.json", encoding="utf-8") as f:
    clan_data: dict = json.load(f)
with open("data/user.json", encoding="utf-8") as f:
    user_data: dict = json.load(f)


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


@app.route("/clan")
def clan():
    return render_template("clan.html", clan_data=clan_data)


@app.route("/clan/<group_id>")
def clan_page(group_id: str):
    if group_id in clan_data:
        return render_template("clan_users.html", clan_data=clan_data.get(group_id))
    else:
        return render_template("404.html"), 404


# ==== API SECTION ====

@app.route("/api/getSteamID")
def api_get_steam_id():
    arr: list = request.args.getlist("id")
    return jsonify({n: user_data[n]["Steam"]["steamID"] for n in arr if user_data.get(n, {}).get("Steam") and user_data[n].get("isPublic", True)})


@app.route("/api/clan/add/<group_id>")
def api_clan_add(group_id: str):
    if not group_id.isnumeric():
        return jsonify({"result": False, "message": "Invalid argument value"})
    skip_dupe = request.args.get("skip_dupe", "true") == "true"
    msg = p_client.send({"type": "clan", "group_id": group_id, "skip_dupe": skip_dupe})
    return jsonify({"result": msg == "OK", "message": msg})


@app.route("/api/clan/memberUpdate")
def api_clan_update():
    pass


@app.route("/api/user/update")
def api_user_update():
    pass


@app.route("/api/frontend/update")
def _update_db():
    with open("data/clan.json", encoding="utf-8") as f:
        clan_data.update(json.load(f))
    with open("data/user.json", encoding="utf-8") as f:
        user_data.update(json.load(f))
    return jsonify({"status": "success"})


# ==== ERROR HANDLING SECTION ====

@app.errorhandler(404)
def error_404(e):
    return render_template("404.html"), 404


if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0")
