import { CardImageCommand } from '../../commands/card-image-command';
import { makeTcgService } from '../../dependency-injection/dependency-factory';
import { translations } from '../../data/translator';

const tcgService = makeTcgService();

const testString = 'test';

describe('Card Image command', () => {
  it('Can return a card from the api', async () => {
    jest.spyOn(tcgService, 'get').mockImplementationOnce(() => {
      return new Promise<Array<string>>(resolve => {
        resolve([testString]);
      });
    });
    const cardImageCommand = new CardImageCommand(tcgService);
    expect(cardImageCommand.name.length).toBeGreaterThan(0);
    const result = cardImageCommand.execute([testString]);
    expect(result).resolves.not.toThrowError();
    const finalResult = await result;
    expect(finalResult.response[0]).toMatch(testString);
    expect(finalResult.response[0]).not.toMatch(translations.noCardFound);
  });

  it('Returns an error message if no parameter is provided', async () => {
    jest.spyOn(tcgService, 'get').mockImplementationOnce(() => {
      return new Promise<Array<string>>(resolve => {
        resolve([testString]);
      });
    });
    const cardImageCommand = new CardImageCommand(tcgService);
    expect(cardImageCommand.name.length).toBeGreaterThan(0);
    const result = cardImageCommand.execute();
    expect(result).resolves.not.toThrowError();
    const finalResult = await result;
    expect(finalResult.response[0]).toMatch(translations.noCardFound);
  });
});
