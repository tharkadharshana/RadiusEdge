import { spawn } from 'child_process';
import radius from 'radius';
import { promisify } from 'util';

interface RadiusAttribute {
  type: string;
  value: string | number | Buffer;
}

interface RadiusPacket {
  code: 'Access-Request' | 'Access-Accept' | 'Access-Reject' | 'Access-Challenge' | 'Accounting-Request' | 'Accounting-Response';
  identifier?: number;
  attributes: RadiusAttribute[];
}

interface RadiusServerConfig {
  host: string;
  port: number;
  secret: string;
  timeout?: number;
  retries?: number;
}

interface RadiusResponse {
  code: string;
  attributes: RadiusAttribute[];
  raw?: Buffer;
  error?: Error;
}

export class RadiusService {
  constructor() {
    // No initialization needed
  }

  async sendPacketUsingLibrary(
    packet: RadiusPacket,
    serverConfig: RadiusServerConfig
  ): Promise<RadiusResponse> {
    return new Promise((resolve, reject) => {
      const client = radius.createClient({
        host: serverConfig.host,
        port: serverConfig.port,
        secret: serverConfig.secret,
        timeout: serverConfig.timeout || 5000,
        retries: serverConfig.retries || 3,
      });

      const radiusPacket = {
        code: packet.code,
        identifier: packet.identifier || Math.floor(Math.random() * 256),
        attributes: packet.attributes,
      };

      client.send(radiusPacket, (err: Error | null, response: any) => {
        if (err) {
          resolve({ 
            code: 'Error',
            attributes: [],
            error: err
          });
          return;
        }

        resolve({
          code: response.code,
          attributes: response.attributes,
          raw: response.raw
        });
      });
    });
  }

  async sendPacketUsingRadclient(
    packet: RadiusPacket,
    serverConfig: RadiusServerConfig
  ): Promise<RadiusResponse> {
    // Convert packet attributes to radclient format
    const attributeStrings = packet.attributes.map(attr => {
      return `${attr.type}=${attr.value}`;
    });

    // Build radclient command
    const args = [
      `${serverConfig.host}:${serverConfig.port}`,
      packet.code.toLowerCase(),
      serverConfig.secret,
      ...attributeStrings
    ];

    return new Promise((resolve) => {
      const radclient = spawn('radclient', args);
      let stdout = '';
      let stderr = '';

      radclient.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      radclient.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      radclient.on('close', (code) => {
        if (code !== 0) {
          resolve({
            code: 'Error',
            attributes: [],
            error: new Error(`radclient failed with code ${code}: ${stderr}`)
          });
          return;
        }

        // Parse radclient output to extract response code and attributes
        const attributes: RadiusAttribute[] = [];
        let responseCode = 'Unknown';

        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.includes('Received Access-Accept')) {
            responseCode = 'Access-Accept';
          } else if (line.includes('Received Access-Reject')) {
            responseCode = 'Access-Reject';
          } else if (line.includes('Received Access-Challenge')) {
            responseCode = 'Access-Challenge';
          } else if (line.match(/^\s+[\w-]+ = /)) {
            // Parse attribute line
            const [type, value] = line.trim().split(' = ');
            attributes.push({ type, value: value.replace(/['"]/g, '') });
          }
        }

        resolve({
          code: responseCode,
          attributes,
        });
      });
    });
  }

  async sendPacketUsingRadtest(
    username: string,
    password: string,
    serverConfig: RadiusServerConfig,
    nasPort: number = 0
  ): Promise<RadiusResponse> {
    const args = [
      username,
      password,
      serverConfig.host,
      String(serverConfig.port),
      serverConfig.secret,
      String(nasPort)
    ];

    return new Promise((resolve) => {
      const radtest = spawn('radtest', args);
      let stdout = '';
      let stderr = '';

      radtest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      radtest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      radtest.on('close', (code) => {
        if (code !== 0) {
          resolve({
            code: 'Error',
            attributes: [],
            error: new Error(`radtest failed with code ${code}: ${stderr}`)
          });
          return;
        }

        // Parse radtest output
        let responseCode = 'Unknown';
        const attributes: RadiusAttribute[] = [];

        if (stdout.includes('Access-Accept')) {
          responseCode = 'Access-Accept';
        } else if (stdout.includes('Access-Reject')) {
          responseCode = 'Access-Reject';
        } else if (stdout.includes('Access-Challenge')) {
          responseCode = 'Access-Challenge';
        }

        // Extract attributes from output
        const lines = stdout.split('\n');
        for (const line of lines) {
          const match = line.match(/^\s+(?:Reply-Message|Class|State|Session-Timeout)\s+=\s+(.+)$/);
          if (match) {
            attributes.push({
              type: line.split('=')[0].trim(),
              value: match[1].trim().replace(/['"]/g, '')
            });
          }
        }

        resolve({
          code: responseCode,
          attributes,
        });
      });
    });
  }

  validatePacketResponse(
    response: RadiusResponse,
    expectedAttributes?: { [key: string]: string | number | Buffer }
  ): boolean {
    if (response.error) {
      return false;
    }

    if (!expectedAttributes) {
      return true;
    }

    // Check each expected attribute
    for (const [key, value] of Object.entries(expectedAttributes)) {
      const matchingAttr = response.attributes.find(attr => attr.type === key);
      if (!matchingAttr) {
        return false;
      }

      if (Buffer.isBuffer(value)) {
        if (!Buffer.isBuffer(matchingAttr.value) || !value.equals(matchingAttr.value as Buffer)) {
          return false;
        }
      } else if (matchingAttr.value !== value) {
        return false;
      }
    }

    return true;
  }
}

// Create a singleton instance
export const radiusService = new RadiusService(); 