import asyncio
import socket
import json
import os
import argparse

_path = "./parser.sock"
_host = "localhost"
_port = 50001

SHORT_CMD = {
    "commit": {"type": "commit"},
    "load": {"type": "load"},
    "update_all_clan": {"type": "update_all_clan"},
    "queue": {"type": "queue"}
}


class Client:
    # 동기 방식의 Socket 통신 client 입니다. parser_server.py 실행 후 실행해주세요.
    def __init__(self):
        if os.name == "posix":
            self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            self.address = _path
        else:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.address = (_host, _port)
        self.connect()

    def __del__(self):
        self.sock.close()

    def connect(self):
        try:
            self.sock.connect(self.address)
            return True
        except (ConnectionResetError, ConnectionRefusedError, OSError) as e:
            print(e)
            return False

    def reconnect(self):
        return self.connect()

    def send(self, msg: dict):
        msg["_pid"] = os.getpid()
        try:
            self.sock.send(json.dumps(msg).encode())
        except (ConnectionResetError, ConnectionRefusedError, OSError):
            ret = self.reconnect()
            if ret:
                self.sock.send(json.dumps(msg).encode())
            else:
                return "Socket connection Error"
        data = self.sock.recv(1024)
        return data.decode()


class Data:
    def __init__(self):
        self._load_clan()
        self._load_user()
        self._load_clan_blocklist()

    def _load_clan(self):
        with open("data/clan.json", "r", encoding="utf-8") as f:
            self.clan_all: dict = json.load(f)
            self.clan = {k: v for k, v in self.clan_all.items() if v.get("memberCount") > 5}
        self.last_edit_clan = os.path.getmtime("data/clan.json")

    def _load_user(self):
        with open("data/user.json", "r", encoding="utf-8") as f:
            self.user: dict = json.load(f)
        self.last_edit_user = os.path.getmtime("data/user.json")

    def _load_clan_blocklist(self):
        with open("data/clan_blocklist.json", "r", encoding="utf-8") as f:
            self.clan_blocklist: dict = json.load(f)
        self.last_edit_clan_blocklist = os.path.getmtime("data/clan_blocklist.json")

    def update(self):
        if self.last_edit_clan < os.path.getmtime("data/clan.json"):
            self._load_clan()
        if self.last_edit_user < os.path.getmtime("data/user.json"):
            self._load_user()
        if self.last_edit_clan_blocklist < os.path.getmtime("data/clan_blocklist.json"):
            self._load_clan_blocklist()


async def run():
    reader: asyncio.StreamReader
    writer: asyncio.StreamWriter
    if os.name == "posix":
        reader, writer = await asyncio.open_unix_connection(_path)
    else:
        reader, writer = await asyncio.open_connection(_host, _port)

    print("Connected")

    while True:
        line = input(">>> ")
        if not line:
            break
        payload = line.encode()
        writer.write(payload)
        await writer.drain()

        data = await reader.read(1024)
        print(f"received message: {data.decode()}")
    print("disconnect")
    writer.close()
    await writer.wait_closed()


def run_s():
    client = Client()
    while True:
        line = input(">>> ")
        if not line:
            break
        if line.strip() in SHORT_CMD:
            data = client.send(SHORT_CMD[line.strip()])
        else:
            try:
                msg_dict = json.loads(line)
            except json.JSONDecodeError:
                print("cannot decode input to json")
                continue
            data = client.send(msg_dict)
        print(f"received message: {data}")


def run_cmd(cmd: str):
    client = Client()
    if cmd.strip() in SHORT_CMD:
        data = client.send(SHORT_CMD[cmd.strip()])
    else:
        try:
            msg_dict = json.loads(cmd)
        except json.JSONDecodeError:
            print("cannot decode input to json")
            return
        data = client.send(msg_dict)
    print(data)


if __name__ == '__main__':
    # asyncio.run(run(), debug=True)
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--cmd", type=str)
    args = parser.parse_args()
    if args.cmd:
        run_cmd(args.cmd)
    else:
        run_s()
