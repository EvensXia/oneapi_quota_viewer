import * as https from 'https';
import * as http from 'http';
import { IncomingMessage } from 'http';
import * as zlib from 'zlib';

export interface OneAPIData {
  quota: number;
  usedQuota: number;
  email: string;
  success: boolean;
}

export class OneAPI {
  domain: string;
  accessToken: string;
  url: string;
  urlStatus: string;
  headers: Record<string, string>;
  data: { quotaPerUnit?: number } = {};
  isHttps: boolean;

  constructor(domain: string, accessToken: string) {
    this.domain = domain.replace(/\/+$/, '');  // 去除多余的 '/'
    this.accessToken = accessToken;
    this.isHttps = domain.startsWith('https://');  // 判断是否是 HTTPS
    this.url = `${this.domain}/api/user/self`;
    this.urlStatus = `${this.domain}/api/status`;
    this.headers = { 
      Authorization: `Bearer ${this.accessToken}`,
      'Accept-Encoding': 'gzip, deflate, identity'  // 支持的编码格式
    };
    this.fetchStatus();
  }

  fetchStatus(): void {
    const client = this.isHttps ? https : http;  // 根据协议选择客户端
    client.get(this.urlStatus, { headers: this.headers }, (response) => {
      this.handleResponse(response, (jsonData) => {
        this.data = jsonData.data || {};
      });
    }).on('error', (error: Error) => console.error('Failed to fetch status:', error));
  }

  fetchBalance(): Promise<OneAPIData> {
    const client = this.isHttps ? https : http;  // 根据协议选择客户端
    return new Promise((resolve, reject) => {
      client.get(this.url, { headers: this.headers }, (response) => {
        this.handleResponse(response, (jsonData) => {
          const apiData = jsonData.data || {};
          resolve({
            quota: apiData.quota / (this.data.quotaPerUnit || 500000),
            usedQuota: apiData.used_quota / (this.data.quotaPerUnit || 500000),
            email: apiData.email,
            success: true,
          });
        }, reject);
      }).on('error', (error: Error) => reject({
        quota: 0,
        usedQuota: 0,
        email: `Request failed: ${error.message}`,
        success: false,
      }));
    });
  }

  private handleResponse(response: IncomingMessage, onSuccess: (data: any) => void, onError?: (error: OneAPIData) => void) {
    const contentType = response.headers['content-type'] || '';
    const encoding = response.headers['content-encoding'];
    let stream: IncomingMessage | zlib.Gunzip | zlib.Inflate = response;

    // 解压缩响应数据（如果需要）
    if (encoding === 'gzip') {
      stream = response.pipe(zlib.createGunzip());
    } else if (encoding === 'deflate') {
      stream = response.pipe(zlib.createInflate());
    }

    let data = '';
    stream.on('data', (chunk: Buffer) => data += chunk.toString());
    stream.on('end', () => {
      try {
        if (!contentType.includes('application/json')) {
          throw new Error(`Unexpected content-type: ${contentType}`);
        }
        const jsonData = JSON.parse(data);
        onSuccess(jsonData);
      } catch (error) {
        console.error('Error parsing response:', error);
        console.error('Received data:', data);
        if (onError) {
          onError({
            quota: 0,
            usedQuota: 0,
            email: `Error parsing response: ${(error as Error).message}`,
            success: false,
          });
        }
      }
    });
  }
}
