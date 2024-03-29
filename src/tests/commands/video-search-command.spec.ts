import { VideoSearchCommand } from '../../commands/video-search-command';
import { makeVideoService } from '../../dependency-injection/dependency-factory';
import { translations } from '../../data/translator';

const videoService: VideoService = makeVideoService();

const testString = 'test';

describe('Video Search command', () => {
  it('Can return a card from the api', async () => {
    jest.spyOn(videoService, 'get').mockImplementationOnce(() => {
      return new Promise<Array<string>>(resolve => {
        resolve([testString]);
      });
    });
    const videoSearchCommand = new VideoSearchCommand(videoService);
    expect(videoSearchCommand.name.length).toBeGreaterThan(0);
    const result = videoSearchCommand.execute([testString]);
    expect(result).resolves.not.toThrowError();
    const finalResult = await result;
    expect(finalResult.response[0]).toMatch(testString);
    expect(finalResult.response[0]).not.toMatch(translations.noVideoFound);
  });

  it('Returns an error message if no parameter is provided', async () => {
    jest.spyOn(videoService, 'get').mockImplementationOnce(() => {
      return new Promise<Array<string>>(resolve => {
        resolve([testString]);
      });
    });
    const videoSearchCommand = new VideoSearchCommand(videoService);
    expect(videoSearchCommand.name.length).toBeGreaterThan(0);
    const result = videoSearchCommand.execute();
    expect(result).resolves.not.toThrowError();
    const finalResult = await result;
    expect(finalResult.response[0]).toMatch(translations.noVideoFound);
  });
});
