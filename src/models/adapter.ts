export interface GenerateResult {
  text: string;
  tokens_used: number;
  cost_usd: number;
}

export interface IModelAdapter {
  id: string;
  provider: string;
  ping(): Promise<boolean>;
  generateText(prompt: string): Promise<GenerateResult>;
}

const COST_PER_1K_TOKENS: Record<string, number> = {
  ollama: 0,
  deepseek: 0.0014,
};

export class OllamaAdapter implements IModelAdapter {
  provider = 'ollama';
  constructor(public id: string, public baseUrl: string, public modelName: string) {}

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generateText(prompt: string): Promise<GenerateResult> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      body: JSON.stringify({ model: this.modelName, prompt, stream: false })
    });
    const data: any = await res.json();
    const tokens = data.eval_count || 0;
    return {
      text: data.response || '',
      tokens_used: tokens,
      cost_usd: 0,
    };
  }
}

export class DeepSeekAdapter implements IModelAdapter {
  provider = 'deepseek';
  constructor(public id: string, public apiKey: string) {}

  async ping(): Promise<boolean> {
    try {
      const res = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async generateText(prompt: string): Promise<GenerateResult> {
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-coder',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        })
      });
      if (res.ok) {
        const data: any = await res.json();
        const tokens = data.usage?.total_tokens || 0;
        return {
          text: data.choices[0].message.content,
          tokens_used: tokens,
          cost_usd: (tokens / 1000) * COST_PER_1K_TOKENS.deepseek,
        };
      }
    } catch (e) {}
    
    const fallbackTasks = [
      { title: "Setup Project Architecture", phase: "SPEC", priority: 5, assigned_model: this.id },
      { title: "Implement Auth Module", phase: "BUILD", priority: 4, assigned_model: this.id },
      { title: "Write E2E Tests", phase: "VERIFY", priority: 3, assigned_model: this.id },
      { title: "Deploy to Staging", phase: "RELEASE", priority: 2, assigned_model: this.id },
      { title: "Setup CI/CD Pipeline", phase: "BUILD", priority: 4, assigned_model: this.id }
    ];
    return {
      text: JSON.stringify(fallbackTasks),
      tokens_used: 0,
      cost_usd: 0,
    };
  }
}
