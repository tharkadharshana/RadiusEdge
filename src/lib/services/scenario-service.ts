import { sshService } from './ssh-service';
import { dbService } from './db-service';
import { radiusService } from './radius-service';
import { apiService } from './api-service';

interface ScenarioVariable {
  name: string;
  value: string | number | boolean;
}

interface ScenarioContext {
  variables: Map<string, ScenarioVariable>;
  currentStepIndex: number;
  loopCount: Map<string, number>;
  lastStepResult: any;
}

interface ScenarioStep {
  id: string;
  type: 'ssh' | 'sql' | 'radius' | 'api' | 'delay' | 'log' | 'conditional' | 'loop';
  name: string;
  enabled: boolean;
  config: any;
}

interface ScenarioResult {
  success: boolean;
  stepResults: {
    stepId: string;
    stepName: string;
    status: 'success' | 'failure' | 'skipped';
    output?: any;
    error?: Error;
  }[];
}

export class ScenarioService {
  private context: ScenarioContext = {
    variables: new Map(),
    currentStepIndex: 0,
    loopCount: new Map(),
    lastStepResult: null,
  };

  constructor() {
    this.resetContext();
  }

  private resetContext(): void {
    this.context = {
      variables: new Map(),
      currentStepIndex: 0,
      loopCount: new Map(),
      lastStepResult: null,
    };
  }

  async executeScenario(steps: ScenarioStep[]): Promise<ScenarioResult> {
    this.resetContext();
    const results: ScenarioResult = {
      success: true,
      stepResults: [],
    };

    for (let i = 0; i < steps.length; i++) {
      this.context.currentStepIndex = i;
      const step = steps[i];

      if (!step.enabled) {
        results.stepResults.push({
          stepId: step.id,
          stepName: step.name,
          status: 'skipped',
          output: 'Step is disabled',
        });
        continue;
      }

      try {
        const stepResult = await this.executeStep(step);
        results.stepResults.push({
          stepId: step.id,
          stepName: step.name,
          status: stepResult.success ? 'success' : 'failure',
          output: stepResult.output,
          error: stepResult.error,
        });

        if (!stepResult.success && step.config.haltOnFailure !== false) {
          results.success = false;
          break;
        }

        this.context.lastStepResult = stepResult.output;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.stepResults.push({
          stepId: step.id,
          stepName: step.name,
          status: 'failure',
          error: new Error(errorMessage),
        });
        results.success = false;
        break;
      }
    }

    return results;
  }

  private async executeStep(step: ScenarioStep): Promise<{ success: boolean; output?: any; error?: Error }> {
    // Interpolate variables in step configuration
    const config = this.interpolateVariables(step.config);

    switch (step.type) {
      case 'ssh':
        return this.executeSshStep(config);
      case 'sql':
        return this.executeSqlStep(config);
      case 'radius':
        return this.executeRadiusStep(config);
      case 'api':
        return this.executeApiStep(config);
      case 'delay':
        return this.executeDelayStep(config);
      case 'log':
        return this.executeLogStep(config);
      case 'conditional':
        return this.executeConditionalStep(config);
      case 'loop':
        return this.executeLoopStep(config);
      default:
        throw new Error(`Unsupported step type: ${step.type}`);
    }
  }

  private async executeSshStep(config: any): Promise<{ success: boolean; output?: any; error?: Error }> {
    try {
      if (!sshService.isConnected() || 
          sshService.getConnectionConfig()?.host !== config.host || 
          sshService.getConnectionConfig()?.port !== config.port) {
        await sshService.connect({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          privateKey: config.privateKey,
        });
      }

      const result = await sshService.executeCommand(config.command);
      const success = result.code === 0 && 
                     (!config.expectedOutput || result.stdout.includes(config.expectedOutput));

      return {
        success,
        output: {
          stdout: result.stdout,
          stderr: result.stderr,
          code: result.code,
        },
        error: success ? undefined : new Error('SSH command failed or output validation failed'),
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error in SSH step'),
      };
    }
  }

  private async executeSqlStep(config: any): Promise<{ success: boolean; output?: any; error?: Error }> {
    try {
      if (!dbService.isConnected() || 
          dbService.getCurrentConfig()?.host !== config.host || 
          dbService.getCurrentConfig()?.database !== config.database) {
        await dbService.connect({
          type: config.type,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          database: config.database,
        });
      }

      const result = await dbService.executeQuery(config.query);
      const success = !result.error && 
                     (!config.expectedValue || 
                      (result.rows[0]?.[config.expectedColumn] === config.expectedValue));

      return {
        success,
        output: result.rows,
        error: result.error,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error in SQL step'),
      };
    }
  }

  private async executeRadiusStep(config: any): Promise<{ success: boolean; output?: any; error?: Error }> {
    try {
      const serverConfig = {
        host: config.host,
        port: config.port,
        secret: config.secret,
        timeout: config.timeout,
        retries: config.retries,
      };

      let response;
      if (config.useRadtest) {
        response = await radiusService.sendPacketUsingRadtest(
          config.username,
          config.password,
          serverConfig,
          config.nasPort
        );
      } else if (config.useRadclient) {
        response = await radiusService.sendPacketUsingRadclient(
          {
            code: config.packetType,
            attributes: config.attributes,
          },
          serverConfig
        );
      } else {
        response = await radiusService.sendPacketUsingLibrary(
          {
            code: config.packetType,
            attributes: config.attributes,
          },
          serverConfig
        );
      }

      const success = !response.error && 
                     radiusService.validatePacketResponse(response, config.expectedAttributes);

      return {
        success,
        output: response,
        error: response.error,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error in RADIUS step'),
      };
    }
  }

  private async executeApiStep(config: any): Promise<{ success: boolean; output?: any; error?: Error }> {
    try {
      const response = await apiService.makeRequest({
        url: config.url,
        method: config.method,
        headers: config.headers,
        body: config.body,
        timeout: config.timeout,
      });

      const success = apiService.validateResponse(
        response,
        config.expectedStatus,
        config.validationRules
      );

      return {
        success,
        output: response,
        error: response.error,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error in API step'),
      };
    }
  }

  private async executeDelayStep(config: any): Promise<{ success: boolean; output?: any }> {
    const delay = config.milliseconds || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    return {
      success: true,
      output: `Delayed for ${delay}ms`,
    };
  }

  private executeLogStep(config: any): { success: boolean; output?: any } {
    console.log(`[Scenario Log] ${config.message}`);
    return {
      success: true,
      output: config.message,
    };
  }

  private async executeConditionalStep(config: any): Promise<{ success: boolean; output?: any }> {
    const condition = this.evaluateCondition(config.condition);
    if (condition && config.thenStep) {
      return this.executeStep(config.thenStep);
    } else if (!condition && config.elseStep) {
      return this.executeStep(config.elseStep);
    }
    return {
      success: true,
      output: `Condition evaluated to ${condition}, no step executed`,
    };
  }

  private async executeLoopStep(config: any): Promise<{ success: boolean; output?: any; error?: Error }> {
    const maxIterations = config.maxIterations || 10;
    let iteration = 0;
    const results = [];

    while (iteration < maxIterations) {
      if (config.condition && !this.evaluateCondition(config.condition)) {
        break;
      }

      try {
        const stepResult = await this.executeStep(config.step);
        results.push(stepResult);

        if (!stepResult.success && config.breakOnFailure) {
          return {
            success: false,
            output: results,
            error: stepResult.error,
          };
        }
      } catch (error: unknown) {
        return {
          success: false,
          output: results,
          error: error instanceof Error ? error : new Error('Unknown error in loop step'),
        };
      }

      iteration++;
    }

    return {
      success: true,
      output: results,
    };
  }

  private interpolateVariables(obj: any): any {
    if (typeof obj === 'string') {
      return obj.replace(/\${([^}]+)}/g, (match, varName) => {
        const variable = this.context.variables.get(varName);
        return variable ? String(variable.value) : match;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateVariables(item));
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateVariables(value);
      }
      return result;
    }

    return obj;
  }

  private evaluateCondition(condition: string): boolean {
    // Simple condition evaluation for demonstration
    // In a real implementation, you would want a more robust expression evaluator
    try {
      const context = {
        lastResult: this.context.lastStepResult,
        variables: Object.fromEntries(this.context.variables),
      };
      return new Function('context', `with(context) { return ${condition}; }`)(context);
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
  }

  setVariable(name: string, value: string | number | boolean): void {
    this.context.variables.set(name, { name, value });
  }

  getVariable(name: string): ScenarioVariable | undefined {
    return this.context.variables.get(name);
  }
}

// Create a singleton instance
export const scenarioService = new ScenarioService(); 