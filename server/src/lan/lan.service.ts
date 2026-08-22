import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { networkInterfaces, hostname } from 'os';
import { randomUUID } from 'crypto';
import * as dgram from 'dgram';

export interface LanAddress { iface: string; ip: string; url: string }
export interface LanInfo {
  serverId: string;
  name: string;
  version: string;
  host: string;
  port: number;
  addresses: LanAddress[];
  serverTime: string;
}

/** UDP discovery protocol constants (KobeOS LAN, v1). */
export const DISCOVERY_PORT = 37020;
export const PROBE_MAGIC = 'KOBEOS_DISCOVER_V1';
export const INFO_MAGIC = 'KOBEOS_INFO_V1';

/**
 * LAN discovery so the web app / other devices can reach this self-hosted
 * server over WiFi WITHOUT internet. Two zero-config mechanisms:
 *
 *  1. HTTP handshake — GET /lan/info returns this server's LAN addresses, a
 *     stable id, and version. Any client that reaches the server on ANY address
 *     learns all of them (and can pick the best one / show a QR).
 *  2. UDP beacon — native/desktop clients broadcast a PROBE_MAGIC datagram to
 *     the subnet; this server replies with an INFO packet. Pure stdlib dgram, so
 *     it works with no internet and without avahi/dns-sd installed (unlike the
 *     existing mDNS relay). Browsers can't do UDP — they use /lan/info + a QR.
 */
@Injectable()
export class LanService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LanService.name);
  private readonly serverId = process.env.KOBE_SERVER_ID || randomUUID();
  private readonly version = process.env.npm_package_version || '1.0.0';
  private socket?: dgram.Socket;

  onModuleInit(): void {
    if (process.env.KOBE_LAN_BEACON === 'off') return;
    this.startBeacon();
  }

  onModuleDestroy(): void {
    try { this.socket?.close(); } catch { /* already closed */ }
    this.socket = undefined;
  }

  private httpPort(): number {
    return Number(process.env.PORT || 3000);
  }

  /** All usable IPv4 LAN addresses (non-internal), as reachable base URLs. */
  addresses(): LanAddress[] {
    const port = this.httpPort();
    const out: LanAddress[] = [];
    const ifaces = networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        // Node <18 gives family 'IPv4'; >=18 may give the number 4.
        const isV4 = iface.family === 'IPv4' || (iface.family as unknown as number) === 4;
        if (isV4 && !iface.internal) {
          out.push({ iface: name, ip: iface.address, url: `http://${iface.address}:${port}` });
        }
      }
    }
    return out;
  }

  getInfo(): LanInfo {
    return {
      serverId: this.serverId,
      name: process.env.KOBE_SERVER_NAME || hostname() || 'KobeOS',
      version: this.version,
      host: hostname(),
      port: this.httpPort(),
      addresses: this.addresses(),
      serverTime: new Date().toISOString(),
    };
  }

  /** The datagram this server sends in reply to a discovery probe. */
  buildInfoPacket(): Buffer {
    const info = this.getInfo();
    return Buffer.from(JSON.stringify({ magic: INFO_MAGIC, ...info }));
  }

  private startBeacon(port = DISCOVERY_PORT): void {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    socket.on('error', (e) => { this.logger.warn(`LAN beacon error: ${e.message}`); try { socket.close(); } catch { /* noop */ } });
    socket.on('message', (msg, rinfo) => this.handleProbe(socket, msg, rinfo));
    socket.bind(port, () => {
      try { socket.setBroadcast(true); } catch { /* not permitted; unicast replies still work */ }
      this.logger.log(`LAN discovery beacon on udp:${port} (server ${this.serverId.slice(0, 8)})`);
    });
    this.socket = socket;
  }

  /** Reply to a valid probe with our info packet (unicast back to the sender). */
  handleProbe(socket: dgram.Socket, msg: Buffer, rinfo: dgram.RemoteInfo): void {
    if (!msg.toString('utf8').startsWith(PROBE_MAGIC)) return;
    const reply = this.buildInfoPacket();
    socket.send(reply, 0, reply.length, rinfo.port, rinfo.address, (err) => {
      if (err) this.logger.warn(`LAN beacon reply failed: ${err.message}`);
    });
  }
}
