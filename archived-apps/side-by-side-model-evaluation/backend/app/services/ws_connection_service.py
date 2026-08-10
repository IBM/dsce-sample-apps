
from datetime import datetime
from services.utils import singleton
from fastapi import WebSocket, WebSocketDisconnect

@singleton
class ConnectionManager:
    """Class defining socket events"""
    def __init__(self):
        """init method, keeping track of connections"""
        self.active_connections = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """connect event"""
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        while True:
            try:
                # Receive the JSON data sent by a client.
                data = await websocket.receive_json()
                print(f"\n\nIN ConnectionManager.connect data received for {client_id}, data: {data}\n\n")
            except WebSocketDisconnect:
                print(f"\n\nIN ConnectionManager CONNECTION IS CLOSED FOR {client_id}\n\n")
                break
            except Exception as err:
                print(err)
                break
        print(f"\n\nIN ConnectionManager.connect to {client_id}\n\n")

    async def send_message(self, client_id: str, message: str):
        """Direct Message"""
        print(f"\n\n1: IN ConnectionManager.send_message to {client_id}: {message}\n\n")
        if client_id in self.active_connections:
            for websocket in self.active_connections[client_id]:
                print(f"\n\n2: IN ConnectionManager.send_message, WebSocket Connection to {client_id} FOUND \n\n")
                try:
                    # await websocket.send_text(message)
                    await websocket.send_json(
                        {
                            "message": message,
                            "time": datetime.now().strftime("%H:%M:%S"),
                        }
                    )
                    print(f"\n\n3: IN ConnectionManager.send_message message sent successfully to {client_id}\n\n")
                except WebSocketDisconnect as err:
                    print(err)
                except Exception as err:
                    print(err)
    
    def disconnect(self, client_id: str):
        """disconnect event"""
        if client_id in self.active_connections:
            print(f"\n\nIN ConnectionManager.disconnect for {client_id}\n\n")
            del self.active_connections[client_id]
            
        