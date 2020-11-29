import re
import json
import asyncio

import requests
import bs4
import pydest


def parse_clan_info(group_id: int):
    resp = requests.get(f"https://www.bungie.net/Platform/GroupV2/{group_id}/", headers={"X-API-KEY": "3632dd9656a54c6d90b31777940b2581"})
    if resp.status_code != 200:
        return
    resp_j: dict = resp.json()
    data: dict = {
        "id": resp_j["Response"]["detail"]["groupId"],
        "name": resp_j["Response"]["detail"]["name"],
        "icon": "",
        "callsign": resp_j["Response"]["detail"]["clanInfo"]["clanCallsign"],
        "motto": resp_j["Response"]["detail"]["motto"],
        "about": resp_j["Response"]["detail"]["about"]
    }
    return data["id"], data


async def parse_all_members(group_id: int):
    destiny = pydest.Pydest("3632dd9656a54c6d90b31777940b2581")
    resp = await destiny.api.get_members_of_group(group_id)
    await destiny.close()
    if resp.get("ErrorCode") != 1:
        return
    data = {}
    for member in resp["Response"]["results"]:
        print("Parsing SteamID for " + member["destinyUserInfo"]["membershipId"])
        data[member["destinyUserInfo"]["membershipId"]] = profile(member["destinyUserInfo"]["membershipId"])
    return data


async def save_all_members(group_id: int):
    data: dict = await parse_all_members(group_id)
    data = {}
    print(data)
    with open("data/user.json", "r", encoding="utf-8") as f:
        db: dict = json.load(f)
    db.update(data)
    with open("data/user.json", "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def parse_account_info(tag: bs4.Tag):
    name = tag.find("div", attrs={"class": "title"}).text.strip().replace("\n", "")
    platform = tag.find("div", attrs={"class": "subtitle"}).text.strip()
    data = {}

    if platform == "Steam":
        re_steam = re.match(r"^(.+) [(]ID: ([0-9]+)[)]$", name)
        steam_name, steam_id = re_steam.groups()
        data["steamID"] = steam_id
        data["name"] = steam_name
        data["url"] = tag.attrs["data-profilelink"]
    else:
        data["name"] = name
        if tag.has_attr("href"):
            data["url"] = tag.attrs["href"]
    return platform, data


def profile(membership_id, membership_type=3):
    resp = requests.get(f"https://www.bungie.net/ko/Profile/{membership_type}/{membership_id}")
    soup = bs4.BeautifulSoup(resp.text, "html.parser")
    pf_list = soup.select(".profiles-container > *")
    acc_info: dict = dict(parse_account_info(n) for n in pf_list)
    return acc_info


if __name__ == '__main__':
    # print(parse_clan_info(3269437))
    loop = asyncio.get_event_loop()
    loop.run_until_complete(save_all_members(3269437))
