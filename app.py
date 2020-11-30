import json
import time

from flask import Flask, render_template, jsonify, request


app = Flask("main")
with open("data/clan.json", encoding="utf-8") as f:
    clan_data: dict = json.load(f)
with open("data/user.json", encoding="utf-8") as f:
    user_data: dict = json.load(f)


@app.route("/")
def root():
    return render_template("root.html")


@app.route("/clan")
def clan():
    return render_template("clan.html", clan_data=clan_data)


@app.route("/clan/<group_id>")
def clan_page(group_id: str):
    return render_template("clan_users.html", clan_data=clan_data.get(group_id))


@app.route("/api/getSteamID")
def api_get_steam_id():
    arr: list = request.args.getlist("id")
    return jsonify({n: user_data[n]["Steam"]["steamID"] for n in arr if user_data.get(n, {}).get("Steam")})


@app.route("/api/frontend/update")
def _update_db():
    with open("data/clan.json", encoding="utf-8") as f:
        clan_data.update(json.load(f))
    with open("data/user.json", encoding="utf-8") as f:
        user_data.update(json.load(f))
    return jsonify({"status": "success"})


if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0")
