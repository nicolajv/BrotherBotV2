import { TopEmotesCommand } from '../../commands/top-emotes-command';
import { errors } from '../../data/constants';
import { makeDatabaseService } from '../../dependency-injection/dependency-factory';
import { Emote } from '../../models/emote';

const databaseService = makeDatabaseService();

const testString = '1. lolz\n2. lol\n';

describe('Top emotes command', () => {
  it('Can return top emotes from the database', async () => {
    jest.spyOn(databaseService, 'getAllFromTable').mockImplementationOnce(() => {
      return new Promise<Array<Record<string, unknown>>>(resolve => {
        const emotes = Array<Emote>();
        emotes.push(new Emote('lol', 1));
        emotes.push(new Emote('lolz', 23));
        resolve((emotes as unknown) as Array<Record<string, unknown>>);
      });
    });
    const topEmotesCommand = new TopEmotesCommand(databaseService);
    expect(topEmotesCommand.name.length).toBeGreaterThan(0);
    const result = topEmotesCommand.execute();
    await expect(result).resolves.not.toThrowError();
    await expect(result).resolves.toMatch(testString);
    await expect(result).resolves.not.toMatch(errors.noEmotesFound);
  });

  it('Returns an error message if no top emotes are returned', async () => {
    jest.spyOn(databaseService, 'getAllFromTable').mockImplementationOnce(() => {
      return new Promise<Array<Record<string, unknown>>>(resolve => {
        resolve([]);
      });
    });
    const topEmotesCommand = new TopEmotesCommand(databaseService);
    expect(topEmotesCommand.name.length).toBeGreaterThan(0);
    const result = topEmotesCommand.execute();
    await expect(result).resolves.not.toThrowError();
    await expect(result).resolves.toMatch(errors.noEmotesFound);
  });
});
