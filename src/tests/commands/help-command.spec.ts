import { HelpCommand } from '../../commands/help-command';
import { MockCommand } from '../mocks/mock-command';

describe('Help command', () => {
  it('Can return help on commands', async () => {
    const commands = Array<Command>();
    const mockCommand: Command = new MockCommand();
    commands.push(mockCommand);
    const helpCommand = new HelpCommand(commands);
    const promise = helpCommand.execute();
    expect(promise).resolves.not.toThrowError();
    expect(promise).resolves.toContain(mockCommand.helperText);
  });

  it('Does not return commands without helper text', async () => {
    const commands = Array<Command>();
    const sampleCommand: Command = new MockCommand();
    commands.push(sampleCommand);
    const noHelpCommand: Command = new MockCommand('thisnameshouldnotbeseen', false);
    commands.push(noHelpCommand);
    const helpCommand = new HelpCommand(commands);
    const promise = helpCommand.execute();
    expect(promise).resolves.not.toThrowError();
    expect(promise).resolves.not.toContain(noHelpCommand.name);
  });
});
