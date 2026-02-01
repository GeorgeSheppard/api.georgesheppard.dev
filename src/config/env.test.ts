import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Environment Configuration Sync', () => {
  it('should have all env.ts variables in infra/compose.yaml', () => {
    // Read the env.ts file to extract required environment variables
    const envTsPath = join(process.cwd(), 'src/config/env.ts');
    const envTsContent = readFileSync(envTsPath, 'utf-8');

    // Read the compose.yaml file
    const composeYamlPath = join(process.cwd(), 'infra/compose.yaml');
    const composeYamlContent = readFileSync(composeYamlPath, 'utf-8');

    // Extract all environment variable names from envSchema in env.ts
    // This regex matches patterns like: VARIABLE_NAME: z.string()
    const envVarRegex = /^\s+([A-Z_]+):\s+z\./gm;
    const envVars: string[] = [];
    let match;

    while ((match = envVarRegex.exec(envTsContent)) !== null) {
      envVars.push(match[1]);
    }

    // Variables that are composed from other variables or handled differently in compose
    const excludedVars = [
      'NODE_ENV', // Hardcoded as 'production' in compose
      'PORT', // Hardcoded as '5240' in compose
      'DATABASE_HOST', // Handled separately as service reference
      'DATABASE_PORT', // Handled separately as service reference
      'RABBITMQ_HOST', // Handled separately as service reference
      'RABBITMQ_PORT', // Handled separately as service reference
    ];

    const requiredVars = envVars.filter((v) => !excludedVars.includes(v));

    // Check each required variable exists in compose.yaml
    const missingVars: string[] = [];
    for (const varName of requiredVars) {
      // Look for the pattern: VAR_NAME: '${VAR_NAME}'
      const pattern = new RegExp(`${varName}:\\s+'\\$\\{${varName}\\}'`, 'm');
      if (!pattern.test(composeYamlContent)) {
        missingVars.push(varName);
      }
    }

    expect(
      missingVars,
      `The following environment variables are defined in src/config/env.ts but missing from infra/compose.yaml: ${missingVars.join(', ')}. Please add them to the api service environment section.`,
    ).toEqual([]);
  });
});
