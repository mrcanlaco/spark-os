import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { OllamaAdapter, DeepSeekAdapter, IModelAdapter } from '../models/adapter';

export async function pingModels(): Promise<void> {
  const rootDir = process.cwd();
  const yamlPath = path.join(rootDir, 'spark.yaml');
  if (!fs.existsSync(yamlPath)) {
    console.error('[SPARK] spark.yaml not found. Please run "spark init" first.');
    return;
  }
  
  const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
  const parsed = parseYaml(yamlContent);
  const registry = parsed?.model_registry?.adapters || [];

  console.log('[SPARK] Pinging models in registry...\n');

  let activeAdapter: IModelAdapter | null = null;

  for (const cfg of registry) {
    let adapter: IModelAdapter | null = null;
    if (cfg.provider === 'ollama') {
      adapter = new OllamaAdapter(cfg.id, cfg.base_url, cfg.model_name);
    } else if (cfg.provider === 'deepseek') {
      adapter = new DeepSeekAdapter(cfg.id, process.env.DEEPSEEK_API_KEY || '');
    }

    if (adapter) {
      const isHealthy = await adapter.ping();
      console.log(`- ${adapter.id} (${adapter.provider}): ${isHealthy ? 'HEALTHY ✅' : 'UNHEALTHY ❌'}`);
      
      if (isHealthy && !activeAdapter) {
        activeAdapter = adapter;
      }
    }
  }

  console.log('\n================================');
  if (activeAdapter) {
    console.log(`[SPARK] Active model selected for routing: ${activeAdapter.id}`);
  } else {
    console.log(`[SPARK] No healthy models available! (Fallback failed)`);
  }
}
