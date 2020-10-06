import { App } from '../app';
import { DiscordService } from '../discord/discord-service';
jest.mock('../discord/discord-service');
import express = require('express');

const port = 4200;
const oneTime = 1;

describe('App', () => {
  it('can start application', () => {
    const app = new App(express(), new DiscordService(), port);
    jest.spyOn(app, 'close');
    app.close();
    expect(app.close).toHaveBeenCalledTimes(oneTime);
  });
});

afterAll(async done => {
  done();
});
