import asyncio
import socket
import json

_path = "./parser.sock"
_host = "localhost"
_port = 50001


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
        sock.send(line.encode())
        data = sock.recv(1024)
        print(f"received message: {data.decode()}")
    sock.close()


if __name__ == '__main__':
    # asyncio.run(run(), debug=True)
    run_s()
