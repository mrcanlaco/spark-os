export function getDefaultSparkYaml(projectName: string): string {
  return `project:
  name: "${projectName}"
  tech_stack: []
  coding_conventions: ""

deployment:
  provider: "vercel"
  connection_secret_env: "SPARK_DEPLOY_TOKEN"
  environments:
    staging:
      branch: "spark/agent/*"
      strategy: "sdk_direct"
    production:
      branch: "main"
      strategy: "ci_yaml"

budget:
  budget_cap_usd: 15.0
  shared_overflow_pool: 10.0

model_registry:
  adapters:
    - id: "ollama-local"
      provider: "ollama"
      model_name: "hermes-3-llama-3-8b"
      base_url: "http://localhost:11434"
    - id: "deepseek-cloud"
      provider: "deepseek"
      model_name: "deepseek-coder"
`;
}
