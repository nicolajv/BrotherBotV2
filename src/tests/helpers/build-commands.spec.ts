import { Command } from '../../commands/interfaces/command.interface';
import { buildCommands } from '../../helpers/build-commands';

describe('Build commands', () => {
  it('Can build list of commands', async () => {
    const commands = await buildCommands();
    expect(typeof commands).toBe(typeof Array<Command>());
    expect(commands.length).toBeGreaterThan(0);
  });
});
