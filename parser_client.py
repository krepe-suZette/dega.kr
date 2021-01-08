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
    def __init__(self, address):
        self.address = address
        if isinstance(address, str):
            self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        elif isinstance(address, tuple):
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

        try:
            self.sock.connect(address)
        except ConnectionRefusedError as e:
            print(e)

    def __del__(self):
        self.sock.close()

    def reconnect(self):
        self.__init__(self.address)
        try:
            self.sock.connect((_host, _port))
            return True
        except (ConnectionResetError, ConnectionRefusedError, OSError):
            return False

    def send(self, msg: dict):
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
        with open("data/clan.json", encoding="utf-8") as f:
            self.clan: dict = json.load(f)
        with open("data/user.json", encoding="utf-8") as f:
            self.user: dict = json.load(f)
        self.last_edit_clan = os.path.getmtime("data/clan.json")
        self.last_edit_user = os.path.getmtime("data/user.json")

    def update(self):
        if self.last_edit_clan < os.path.getmtime("data/clan.json"):
            self.last_edit_clan = os.path.getmtime("data/clan.json")
            with open("data/clan.json", encoding="utf-8") as f:
                self.clan: dict = json.load(f)
        if self.last_edit_user < os.path.getmtime("data/user.json"):
            self.last_edit_user = os.path.getmtime("data/user.json")
            with open("data/user.json", encoding="utf-8") as f:
                self.user: dict = json.load(f)


async def run():
    reader: asyncio.StreamReader
    writer: asyncio.StreamWriter
    # reader, writer = await asyncio.open_unix_connection(_path)
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
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((_host, _port))
    while True:
        line = input(">>> ")
        if not line:
            break
        if line.strip() in SHORT_CMD:
            sock.send(json.dumps(SHORT_CMD[line.strip()]).encode())
        else:
            sock.send(line.encode())
        data = sock.recv(1024)
        print(f"received message: {data.decode()}")
    sock.close()


def run_cmd(cmd: str):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((_host, _port))
    if cmd.strip() in SHORT_CMD:
        sock.send(json.dumps(SHORT_CMD[cmd.strip()]).encode())
    else:
        sock.send(cmd.encode())
    data = sock.recv(1024)
    print(data.decode())
    sock.close()


if __name__ == '__main__':
    # asyncio.run(run(), debug=True)
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--cmd", type=str)
    args = parser.parse_args()
    if args.cmd:
        run_cmd(args.cmd)
    else:
        run_s()
