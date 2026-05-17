import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { LiveDataService, type LiveMatch } from './live-data.service';

@WebSocketGateway({ namespace: '/sports', cors: { origin: '*' } })
export class SportsGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;

  constructor(private readonly liveData: LiveDataService) {}

  afterInit() {
    // Push live match updates to all connected clients whenever the poller fires
    this.liveData.onUpdate((matches: LiveMatch[]) => {
      this.server.emit('live-matches', matches);
    });
  }

  @SubscribeMessage('get-live-matches')
  handleGetLive() {
    return this.liveData.getLiveMatches();
  }
}
