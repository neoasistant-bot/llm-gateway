import { Injectable } from '@nestjs/common';

interface BuildPromptParams {
  promptTemplate: string;
  input: string | Record<string, any>;
  inputType: string;
  outputSchema?: Record<string, any> | null;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

@Injectable()
export class PromptBuilderService {
  private readonly SEPARATOR = '\n---\n';

  buildPrompt(params: BuildPromptParams): string {
    const { promptTemplate, input, inputType, outputSchema } = params;

    // Start with the prompt template
    let assembledPrompt = promptTemplate;

    // Add separator and client input
    const formattedInput =
      typeof input === 'string'
        ? input
        : JSON.stringify(input, null, 2);

    assembledPrompt += this.SEPARATOR + formattedInput;

    // Add output schema instructions if provided
    if (outputSchema) {
      const schemaInstructions =
        '\n\nPlease respond with a JSON object that matches the following schema:\n' +
        JSON.stringify(outputSchema, null, 2);
      assembledPrompt += schemaInstructions;
    }

    return assembledPrompt;
  }

  validateInput(input: any, inputType: string): ValidationResult {
    const normalizedInputType = inputType.toUpperCase();

    if (normalizedInputType === 'TEXT') {
      if (typeof input !== 'string') {
        return {
          valid: false,
          error: 'TEXT input type requires a non-empty string',
        };
      }

      if (input.trim().length === 0) {
        return {
          valid: false,
          error: 'TEXT input cannot be empty',
        };
      }

      return { valid: true };
    }

    if (normalizedInputType === 'JSON_SCHEMA') {
      // If already an object, consider it valid
      if (typeof input === 'object' && input !== null) {
        return { valid: true };
      }

      // If it's a string, try to parse it as JSON
      if (typeof input === 'string') {
        try {
          JSON.parse(input);
          return { valid: true };
        } catch (error) {
          return {
            valid: false,
            error: `JSON_SCHEMA input must be valid JSON. Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }

      return {
        valid: false,
        error: 'JSON_SCHEMA input must be a valid JSON string or object',
      };
    }

    return {
      valid: false,
      error: `Unknown input type: ${inputType}. Supported types: TEXT, JSON_SCHEMA`,
    };
  }
}
