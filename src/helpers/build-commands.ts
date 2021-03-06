import {
  makeCardImageCommand,
  makeHelpCommand,
  makeTopEmotesCommand,
  makeVideoSearchCommand,
} from '../dependency-injection/dependency-factory';

export function buildCommands(): Array<Command> {
  const commands: Array<Command> = new Array<Command>();
  commands.push(makeCardImageCommand());
  commands.push(makeVideoSearchCommand());
  commands.push(makeTopEmotesCommand());
  commands.push(makeHelpCommand(commands));
  return commands;
}
