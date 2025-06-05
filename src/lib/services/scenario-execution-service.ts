import { sshService } from './ssh-service';
import { dbService } from './db-service';
import { radiusService } from './radius-service';
import { apiService } from './api-service';
import { scenarioService } from './scenario-service';

interface ScenarioExecutionConfig {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, string>;
  steps: ScenarioStep[];
  serverConfig?: {
    id: string;
    host: string;
    port: number;
    secret: string;
    sshPreambleSteps?: SshPreambleStep[];
  };
  dbConfig?: {
    id: string;
    type: 'mysql' | 'postgresql' | 'mssql' | 'sqlite';
    host: string;
    port: number;
    username: string;
    password?: string;
    database: string;
    sshPreambleSteps?: SshPreambleStep[];
  };
}

interface SshPreambleStep {
  name: string;
  command: string;
  isEnabled: boolean;
  expectedOutputContains?: string;
}

interface ScenarioStep {
  id: string;
  type: 'ssh' | 'sql' | 'radius' | 'api' | 'delay' | 'log' | 'conditional' | 'loop';
  name: string;
  enabled: boolean;
  config: any;
}

interface ScenarioExecutionResult {
  success: boolean;
  stepResults: {
    stepId: string;
    stepName: string;
    status: 'success' | 'failure' | 'skipped';
    output?: any;
    error?: Error;
  }[];
}

export class ScenarioExecutionService {
  async executeScenario(config: ScenarioExecutionConfig): Promise<ScenarioExecutionResult> {
    // Set up variables
    for (const [name, value] of Object.entries(config.variables)) {
      scenarioService.setVariable(name, value);
    }

    // Execute SSH preamble steps for server config if present
    if (config.serverConfig?.sshPreambleSteps) {
      const sshResult = await this.executeSshPreambleSteps(
        config.serverConfig.sshPreambleSteps,
        {
          host: config.serverConfig.host,
          port: config.serverConfig.port,
        }
      );

      if (!sshResult.success) {
        return {
          success: false,
          stepResults: [
            {
              stepId: 'server_ssh_preamble',
              stepName: 'Server SSH Preamble',
              status: 'failure',
              error: new Error('Server SSH preamble steps failed'),
              output: sshResult.stepResults,
            },
          ],
        };
      }
    }

    // Execute SSH preamble steps for database config if present
    if (config.dbConfig?.sshPreambleSteps) {
      const sshResult = await this.executeSshPreambleSteps(
        config.dbConfig.sshPreambleSteps,
        {
          host: config.dbConfig.host,
          port: config.dbConfig.port,
        }
      );

      if (!sshResult.success) {
        return {
          success: false,
          stepResults: [
            {
              stepId: 'db_ssh_preamble',
              stepName: 'Database SSH Preamble',
              status: 'failure',
              error: new Error('Database SSH preamble steps failed'),
              output: sshResult.stepResults,
            },
          ],
        };
      }
    }

    // Execute the main scenario steps
    return scenarioService.executeScenario(config.steps);
  }

  private async executeSshPreambleSteps(
    steps: SshPreambleStep[],
    serverInfo: { host: string; port: number }
  ): Promise<ScenarioExecutionResult> {
    const results: ScenarioExecutionResult['stepResults'] = [];
    let success = true;

    for (const step of steps) {
      if (!step.isEnabled) {
        results.push({
          stepId: step.name,
          stepName: step.name,
          status: 'skipped',
          output: 'Step is disabled',
        });
        continue;
      }

      try {
        const result = await sshService.executeCommand(step.command);
        const stepSuccess = result.code === 0 && 
                          (!step.expectedOutputContains || 
                           result.stdout.includes(step.expectedOutputContains));

        results.push({
          stepId: step.name,
          stepName: step.name,
          status: stepSuccess ? 'success' : 'failure',
          output: {
            stdout: result.stdout,
            stderr: result.stderr,
            code: result.code,
          },
          error: stepSuccess ? undefined : new Error('SSH command failed or output validation failed'),
        });

        if (!stepSuccess) {
          success = false;
          break;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          stepId: step.name,
          stepName: step.name,
          status: 'failure',
          error: new Error(errorMessage),
        });
        success = false;
        break;
      }
    }

    return {
      success,
      stepResults: results,
    };
  }
}

// Create a singleton instance
export const scenarioExecutionService = new ScenarioExecutionService(); 