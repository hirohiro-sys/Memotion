import { DurableObject } from "cloudflare:workers";

// 通知の送信済みの記録を持つ Durable Object。インスタンスは1つ（名前 "notify"）だけ使う。
// KV と違い、書いた値は次の読み込みからどの拠点でもすぐに読める。毎分の cron が、
// 送った次の分に古い記録を読んで同じ通知を送り直さないために使う。
export class NotifySentState extends DurableObject {
  async read(key: string): Promise<string | null> {
    return (await this.ctx.storage.get<string>(key)) ?? null;
  }

  async write(key: string, value: string): Promise<void> {
    await this.ctx.storage.put(key, value);
  }

  async remove(key: string): Promise<void> {
    await this.ctx.storage.delete(key);
  }
}
