export abstract class Tool {
  toolID: string;
  description: string;
  usage: string;
  input: string;
  output: string;

  constructor(toolID: string, description: string, usage: string, input: string, output: string) {
      this.toolID = toolID;
      this.description = description;
      this.usage = usage;
      this.input = input;
      this.output = output;
  }

  generateString(): string {
      return `---
${this.toolID}:
- Tool ID: ${this.toolID}
- Description: ${this.description}
- Usage: ${this.usage}
- Input: ${this.input}
- Output: ${this.output}
---`;
  }
}