import express = require('express');

import { App } from './app';
import { DiscordService } from './discord/discord-service';

const port = 4200;

new App(express(), new DiscordService(), port);