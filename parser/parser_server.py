import asyncio
import json
import re
import logging
import html
import os

import aiohttp
import aiofile
import bs4
import pydest
from dotenv import load_dotenv

load_dotenv()
_socket_type = os.getenv("PARSER_SOCKET_TYPE", "tcp")
_path = os.getenv("PARSER_SOCKET_PATH", "/tmp/parser.sock")
_host = os.getenv("PARSER_SOCKET_HOST", "localhost")
_port = int(os.getenv("PARSER_SOCKET_PORT", 50001))
API_KEY = os.getenv("BUNGIE_API_KEY", "")
_data_path = os.getenv("DATA_PATH", "./data")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
fmt = logging.Formatter("%(asctime)s|%(levelname)s|%(message)s")
fh = logging.FileHandler("parser.log", "a", encoding="utf-8")
sh = logging.StreamHandler()
fh.setLevel(logging.INFO)
fh.setFormatter(fmt)
logger.addHandler(fh)
logger.addHandler(sh)


def parse_account_info(tag: bs4.Tag):
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
        self.json_user_path = os.path.join(_data_path, "user.json")
        self.json_clan_path = os.path.join(_data_path, "clan.json")
        if not os.path.exists(_data_path):
            os.mkdir(_data_path)

        if os.path.exists(self.json_clan_path):
            with open(self.json_clan_path, "r", encoding="utf-8") as f:
                self.clan: dict = json.load(f)
        else:
            with open(self.json_clan_path, "w", encoding="utf-8") as f:
                json.dump({}, f, ensure_ascii=False, indent=2)
            self.clan: dict = {}
        if os.path.exists(self.json_user_path):
            with open(self.json_user_path, "r", encoding="utf-8") as f:
                self.user: dict = json.load(f)
        else:
            with open(self.json_user_path, "w", encoding="utf-8") as f:
                json.dump({}, f, ensure_ascii=False, indent=2)
            self.user: dict = {}

    def __del__(self):
        self.commit()
        self.destiny.close()
        self.session.close()

    async def load(self):
        async with aiofile.async_open(self.json_clan_path, "r", encoding="utf-8") as f:
            self.clan: dict = json.loads(await f.read())
        async with aiofile.async_open(self.json_user_path, "r", encoding="utf-8") as f:
            self.user: dict = json.loads(await f.read())

    async def commit(self):
        async with aiofile.async_open(self.json_clan_path, "w", encoding="utf-8") as f:
            await f.write(json.dumps(self.clan, ensure_ascii=False, indent=2))
        async with aiofile.async_open(self.json_user_path, "w", encoding="utf-8") as f:
            await f.write(json.dumps(self.user, ensure_ascii=False, indent=2))

    async def get_clan_members(self, group_id: int, skip_dupe=True) -> None:
        # 클랜 내 모든 멤버의 계정 정보
        # 번지 이름 도입으로 인한 기능 비활성화
        # try:
        #     resp = await self.destiny.api.get_members_of_group(group_id)
        # except pydest.PydestException as e:
        #     logger.error(f"[Parser] get_clan_members error: {e}")
        #     return
        # if resp.get("ErrorCode") != 1:
        #     # 올바르지 않은 요청
        #     logger.error(f"[Parser] get_clan_members error: {resp.get('ErrorStatus', 'API Request Error')}")
        #     return
        # if skip_dupe:
        #     result = [await self.get_user_profile(n["destinyUserInfo"]["membershipId"]) for n in resp["Response"]["results"] if "Steam" not in self.user.get(n["destinyUserInfo"]["membershipId"], {})]
        # else:
        #     result = [await self.get_user_profile(n["destinyUserInfo"]["membershipId"]) for n in resp["Response"]["results"]]
        # self.user.update(result)
        # await self.commit()
        pass

    async def get_clan(self, group_id: int, commit=True) -> tuple:
        logger.info(f"[Parser] get_clan {group_id} start")
        # 클랜 정보 가져오기
        # 10명 미만인 경우 취소
        resp = await self.session.get(f"https://www.bungie.net/Platform/GroupV2/{group_id}/", headers={"X-API-KEY": "3632dd9656a54c6d90b31777940b2581"})
        try:
            resp_dict: dict = await resp.json()
        except aiohttp.ContentTypeError:
            return False, "HTTP Request Error"

        if resp_dict.get("ErrorCode") == 686:
            # ClanNotFound error
            # remove existing clan info data
            self.clan.pop(str(group_id), None)
            await self.commit()
            logger.warning(f"[Parser] get_clan error: The requested Clan was not found.")
            return False, "The requested Clan was not found."
        elif resp_dict.get("ErrorCode") != 1:
            # 기타 API 요청 에러
            logger.warning(f"[Parser] get_clan error: {resp_dict.get('ErrorStatus', 'API Request Error')}")
            return False, resp_dict.get("ErrorStatus", "API Request Error")
        elif group_id not in self.clan and resp_dict["Response"]["detail"]["memberCount"] < 10:
            # 클랜 **신규** 등록 조건 미달 (구성원 10명 미만)
            logger.info(f"[Parser] get_clan error: Clan member count must be 10 or more")
            return False, "Clan member count must be 10 or more"
        data = {
            "id": resp_dict["Response"]["detail"]["groupId"],
            "name": html.unescape(resp_dict["Response"]["detail"]["name"]),
            "icon": "",
            "memberCount": resp_dict["Response"]["detail"]["memberCount"],
            "locale": resp_dict["Response"]["detail"]["locale"],
            "callsign": html.unescape(resp_dict["Response"]["detail"]["clanInfo"]["clanCallsign"]),
            "motto": html.unescape(resp_dict["Response"]["detail"]["motto"]),
            "about": html.unescape(resp_dict["Response"]["detail"]["about"])
        }
        self.clan[data["id"]] = data
        if commit:
            await self.commit()
        logger.info(f"[Parser] get_clan success")
        return True, ""

    async def get_user_profile(self, membership_id: str, membership_type=3) -> tuple:
        # 개인 유저 데이터 (Bungie.net)
        resp = await self.session.get(f"https://www.bungie.net/ko/Profile/{membership_type}/{membership_id}")
        soup = bs4.BeautifulSoup(await resp.text(), "html.parser")
        pf_list = soup.select(".profiles-container > *")
        account_info = dict(parse_account_info(n) for n in pf_list)
        # 기존 값 상속
        if "Steam" in self.user.get(membership_id, {}):
            account_info["isPublic"] = self.user[membership_id]["isPublic"]
        else:
            account_info["isPublic"] = True if "Steam" in account_info else False
        logger.info(f"[Parser] get profile {membership_id}")
        return membership_id, account_info

    async def get_users(self, user_list: list):
        result = [await self.get_user_profile(n) for n in user_list]
        self.user.update(result)
        await self.commit()

    async def update_all_clan(self, skip_dupe=True):
        clan_list = tuple(self.clan.keys())
        for group_id in clan_list:
            stat, msg = await self.get_clan(group_id, commit=False)
            if stat:
                await self.get_clan_members(group_id, skip_dupe)
        await self.commit()


async def worker(queue: asyncio.Queue):
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
                logger.warning(f"[Worker] clan ({data.get('group_id')}) {msg}")
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
        elif data.get("type") == "update_all_clan":
            logger.info(f"[Worker] update_all_clan start")
            await parser.update_all_clan(data.get("skip_dupe", True))
            logger.info(f"[Worker] update_all_clan success")
        else:
            logger.warning(f"[Worker] unknown ({data})")


async def run():
    task_queue = asyncio.Queue()
    task = asyncio.create_task(worker(task_queue))

    async def handler(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        peer_name = writer.get_extra_info("peername")
        if peer_name:
            peer_intro = f"from {peer_name[0]}:{peer_name[1]}"
        else:
            peer_intro = f"via {_path}"
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
            if task.done():
                result_msg = "오류가 발생하였습니다. 관리자에게 연락해주세요."
                logger.error("[Server] Worker loop closed!!!")
            else:
                result_msg = "OK"
            try:
                resp = json.loads(msg)
                if not isinstance(resp, dict):
                    raise TypeError
                if resp.get("type") == "queue":
                    writer.write(f"{task_queue.qsize()}".encode())
                    logger.info(f"[Server] Received {peer_intro} {msg} -> {task_queue.qsize()}")
                else:
                    await task_queue.put(resp)
                    writer.write(result_msg.encode())
                    logger.info(f"[Server] Received {peer_intro} {msg}")
            except json.decoder.JSONDecodeError:
                writer.write("JSON decode error".encode())
                logger.error(f"[Server] JSONDecodeError {peer_intro} {msg}")
            except TypeError:
                writer.write("TypeError".encode())
                logger.error(f"[Server] TypeError {peer_intro} {msg}")
            finally:
                await writer.drain()

    if _socket_type == "unix":
        if os.name != "posix":
            logger.error("[Server] Unix socket is not supported in this OS")
            return
        server = await asyncio.start_unix_server(handler, _path)
    else:
        server = await asyncio.start_server(handler, host=_host, port=_port)
    _sock_path = _path if _socket_type == "unix" else f"{_host}:{_port}"
    logger.info(f"[Server] Start! ({_socket_type} {_sock_path})")
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
    # asyncio.run(run(), debug=True)
    asyncio.run(run())
