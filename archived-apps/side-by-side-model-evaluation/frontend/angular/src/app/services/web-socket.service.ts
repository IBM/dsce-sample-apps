import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from '../../environments/environment';

interface MessageData {
  message: string;
  time?: string;
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private socket$!: WebSocketSubject<any>;
  public receivedData: MessageData[] = [];

  public connect(topic, callback): void {
    if (!this.socket$ || this.socket$.closed) {
      this.socket$ = webSocket(environment.BACKEND_API_URL+"/ws/"+topic);

      this.socket$.subscribe((data: MessageData) => {
		// console.log("MESSAGE Received on WebSocket: >> ", data);
        this.receivedData.push(data);
		callback(data);
      });
    }
  }

  sendMessage(message: string) {
    this.socket$.next({ message });
  }

  close() {
    this.socket$.complete();
  }
}
