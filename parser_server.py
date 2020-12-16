import asyncio
import json
import re
import logging
import html

import aiohttp
import aiofile
import bs4
import pydest

_path = "./parser.sock"
_host = "localhost"
_port = 50001

with open("API_KEY", "r") as f:
    API_KEY = f.read().strip()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
fmt = logging.Formatter("%(asctime)s|%(levelname)s|%(message)s")
fh = logging.FileHandler("parser.log", "a", encoding="utf-8")
fh.setLevel(logging.INFO)
fh.setFormatter(fmt)
logger.addHandler(fh)


def parse_account_info(tag:bs4.Tag):
    name = tag.find("div", attrs={"class": "title"}).text.strip().replace("\n", "")
    platform = tag.find("div", attrs={"class": "subtitle"}).text.strip().replace("\n", "")
    if platform == "Steam":
        re_steam = re.match(r"^(.+) [(]ID: ([0-9]+)[)]$", name)
        steam_name, steam_id = re_steam.groups()
        data = {
            "steamID": steam_id,
            "name": steam_name,
            "url": tag.attrs["data-profilelink"]
        }
    else:
        data = {"name": name}
        if tag.has_attr("href"):
            data["url"] = tag.attrs["href"]
    return platform, data


class Parser:
    def __init__(self, api_key: str):
        self._api_key = api_key
        self.destiny = pydest.Pydest(api_key)
        self.session = aiohttp.ClientSession()
        with open("data/clan.json", "r", encoding="utf-8") as f:
            self.clan: dict = json.load(f)
        with open("data/user.json", "r", encoding="utf-8") as f:
            self.user: dict = json.load(f)

    def __del__(self):
        self.commit()
        self.destiny.close()
        self.session.close()

    async def load(self):
        async with aiofile.async_open("data/clan.json", "r", encoding="utf-8") as f:
            self.clan: dict = json.loads(await f.read())
        async with aiofile.async_open("data/user.json", "r", encoding="utf-8") as f:
            self.user: dict = json.loads(await f.read())

    async def commit(self):
        async with aiofile.async_open("data/clan.json", "w", encoding="utf-8") as f:
            await f.write(json.dumps(self.clan, ensure_ascii=False, indent=2))
        async with aiofile.async_open("data/user.json", "w", encoding="utf-8") as f:
            await f.write(json.dumps(self.user, ensure_ascii=False, indent=2))

    async def get_clan_members(self, group_id: int, skip_dupe=True):
        # 클랜 내 모든 멤버의 계정 정보
        resp = await self.destiny.api.get_members_of_group(group_id)
        if resp.get("ErrorCode") != 1:
            # 올바르지 않은 요청
            return
        if skip_dupe:
            result = [await self.get_user_profile(n["destinyUserInfo"]["membershipId"]) for n in resp["Response"]["results"] if n["destinyUserInfo"]["membershipId"] not in self.user]
        else:
            result = [await self.get_user_profile(n["destinyUserInfo"]["membershipId"]) for n in resp["Response"]["results"]]
        self.user.update(result)
        await self.commit()

    async def get_clan(self, group_id: int) -> tuple:
        # 클랜 정보 가져오기
        # 10명 미만인 경우 취소
        resp = await self.session.get(f"https://www.bungie.net/Platform/GroupV2/{group_id}/", headers={"X-API-KEY": "3632dd9656a54c6d90b31777940b2581"})
        if resp.status != 200:
            # API 요청 에러
            return False, "HTTP Request Error"
        resp_dict: dict = await resp.json()
        if resp_dict.get("ErrorCode") != 1:
            # API 요청 에러
            return False, "API Request Error"
        elif resp_dict["Response"]["detail"]["memberCount"] < 10:
            # 클랜 등록 조건 미달 (구성원 10명 미만)
            return False, "Clan member count must be 10 or more"
        data = {
            "id": resp_dict["Response"]["detail"]["groupId"],
            "name": html.unescape(resp_dict["Response"]["detail"]["name"]),
            "icon": "",
            "callsign": html.unescape(resp_dict["Response"]["detail"]["clanInfo"]["clanCallsign"]),
            "motto": html.unescape(resp_dict["Response"]["detail"]["motto"]),
            "about": html.unescape(resp_dict["Response"]["detail"]["about"])
        }
        self.clan[data["id"]] = data
        await self.commit()
        return True, ""

    async def get_user_profile(self, membership_id, membership_type=3) -> tuple:
        # 개인 유저 데이터 (Bungie.net)
        resp = await self.session.get(f"https://www.bungie.net/ko/Profile/{membership_type}/{membership_id}")
        soup = bs4.BeautifulSoup(await resp.text(), "html.parser")
        pf_list = soup.select(".profiles-container > *")
        account_info = dict(parse_account_info(n) for n in pf_list)
        account_info["isPublic"] = True if account_info else False
        logger.info(f"[Parser] get profile {membership_id}")
        return membership_id, account_info

    async def get_users(self, user_list: list):
        result = [await self.get_user_profile(n) for n in user_list]
        self.user.update(result)
        await self.commit()


async def worker(queue):
    parser = Parser(API_KEY)
    logger.info("[Worker] Start!")

    while True:
        data: dict = await queue.get()

        if data.get("type") == "clan":
            logger.info(f"[Worker] clan ({data.get('group_id')}) start")
            # 클랜 추가/업데이트 요청 (클랜 추가 + 해당 클랜 멤버 전체 스캔 (중복 건너뛰기)
            # 클랜 추가 및 저장
            ret, msg = await parser.get_clan(data.get("group_id"))
            if not ret:
                # 클랜 검색 실패시 로깅 후 종료
                logger.info(f"[Worker] clan ({data.get('group_id')}) {msg}")
                continue
            # 클랜 구성원 정보 추가 및 저장
            await parser.get_clan_members(data.get("group_id"), data.get("skip_dupe", True))
            logger.info(f"[Worker] clan ({data.get('group_id')}) success")

        elif data.get("type") == "user":
            logger.info(f"[Worker] user ({data.get('membership_id')}) start")
            # 유저 추가/업데이트 요청 (덮어쓰기)
            # TODO 검증코드 추가
            k, v = await parser.get_user_profile(data.get("membership_id"), data.get("membership_type", 3))
            parser.user[k] = v
            await parser.commit()
            logger.info(f"[Worker] user ({data.get('membership_id')}) success")

        elif data.get("type") == "users":
            logger.info(f"[Worker] users start")
            # 여러 유저 한번에 추가 - {"type": "users", "list": [membership_id, ...]}
            # TODO 검증코드 추가
            await parser.get_users(data.get("list"))
            logger.info(f"[Worker] users ({len(data.get('list', []))}) success")
        elif data.get("type") == "commit":
            logger.info(f"[Worker] commit start")
            await parser.commit()
            logger.info(f"[Worker] commit success")
        elif data.get("type") == "load":
            logger.info(f"[Worker] load start")
            await parser.load()
            logger.info(f"[Worker] load success")
        else:
            logger.warning(f"[Worker] unknown ({data})")


async def run():
    task_queue = asyncio.Queue()
    task = asyncio.create_task(worker(task_queue))

    async def handler(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        peer_name = writer.get_extra_info('peername')
        while True:
            try:
                data = await reader.read(1024)
            except ConnectionResetError:
                logger.warning(f"[Server] Session force close: {peer_name}")
                break
            if reader.at_eof():
                logger.warning(f"[Server] Session close: {peer_name}")
                break
            msg = data.decode()
            try:
                resp = json.loads(msg)
                if not isinstance(resp, dict):
                    raise TypeError
                if resp.get("type") == "queue":
                    writer.write(f"{task_queue.qsize()}".encode())
                else:
                    await task_queue.put(resp)
                    writer.write("OK".encode())
                    # logger.info(f"[Server] Received from {peer_name}|{resp}")
            except json.decoder.JSONDecodeError:
                writer.write("JSON decode error".encode())
                logger.error(f"[Server] JSONDecodeError {peer_name} {msg}")
            except TypeError:
                writer.write("TypeError".encode())
                logger.error(f"[Server] TypeError {peer_name} {msg}")
            finally:
                await writer.drain()

    # server = await asyncio.start_unix_server(handler, _path)
    server = await asyncio.start_server(handler, host=_host, port=_port)
    logger.info("[Server] Start!")
    async with server:
        await server.serve_forever()


async def test():
    task_queue = asyncio.Queue()
    await task_queue.put({"type": "clan", "group_id": "4408265"})
    await task_queue.put({"type": "commit"})
    await worker(task_queue)


if __name__ == '__main__':
    # ch = logging.StreamHandler()
    # ch.setLevel(logging.INFO)
    # ch.setFormatter(fmt)
    # logger.addHandler(ch)
    # asyncio.run(test(), debug=True)
    asyncio.run(run(), debug=True)
