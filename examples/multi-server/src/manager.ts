import { BrowserAgent } from '../../../packages/sdk/dist/index.js';
import type { InstanceData } from './entities/Instance.js';

class AgentManager {
  private agents = new Map<string, BrowserAgent>();
  private usedPorts = new Set<number>();
  private readonly BASE_PORT = 9400;
  private readonly MAX_PORT = 9999;

  /** Find the next unused port in the allocated range. */
  allocatePort(): number {
    for (let p = this.BASE_PORT; p <= this.MAX_PORT; p++) {
      if (!this.usedPorts.has(p)) {
        this.usedPorts.add(p);
        return p;
      }
    }
    throw new Error('No available WebSocket ports in range 9400-9999');
  }

  /** Reserve a specific port (used when restoring instances from DB). */
  reservePort(port: number): void {
    this.usedPorts.add(port);
  }

  /** Free a port when an instance is deleted. */
  releasePort(port: number): void {
    this.usedPorts.delete(port);
  }

  /** Start a BrowserAgent WS server for the given instance. */
  async startAgent(instance: InstanceData): Promise<void> {
    if (this.agents.has(instance.id)) {
      return; // already running
    }
    const agent = new BrowserAgent({
      secret: instance.secret,
      port: instance.wsPort,
      allowRemote: true,
      timeout: 60000,
    });
    await agent.start();
    this.agents.set(instance.id, agent);
    agent.onDisconnected(() => {
      console.log(`[Manager] Extension disconnected from instance "${instance.name}" (id=${instance.id})`);
    });
    console.log(`[Manager] Instance "${instance.name}" WS server started on port ${instance.wsPort}`);
  }

  /** Stop and remove a BrowserAgent. */
  async stopAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      await agent.stop();
      this.agents.delete(id);
    }
  }

  getAgent(id: string): BrowserAgent | undefined {
    return this.agents.get(id);
  }

  isConnected(id: string): boolean {
    return this.agents.get(id)?.isConnected ?? false;
  }
}

export const agentManager = new AgentManager();
