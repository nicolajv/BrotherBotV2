import {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  GatewayIntentBits,
  GuildEmoji,
  Interaction,
  Message,
  MessageComponentInteraction,
  Routes,
  SlashCommandBuilder,
  TextChannel,
  VoiceState,
} from 'discord.js';

import { CallState } from '../helpers/calls-state';
import { Command } from '../commands/interfaces/command.interface';
import { CommandResponse } from 'src/models/command-response';
import { Logger } from 'mongodb';
import { REST } from '@discordjs/rest';
import { User } from '../models/user';
import { buildCommands } from '../helpers/build-commands';
import { channel } from 'diagnostics_channel';
import { emotesTable } from '../data/constants';
import { translations } from '../data/translator';

export class DiscordService implements ChatService {
  private loggingService: LoggingService;
  private databaseService: DatabaseService;
  public client: Client;
  private commands: Array<Command> = Array<Command>();

  private mainChannel: TextChannel | null = null;
  private users = Array<User>();

  private callState = new CallState();

  constructor(loggingService: LoggingService, databaseService: DatabaseService, client?: Client) {
    this.client = client
      ? client
      : new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent,
          ],
        });
    this.loggingService = loggingService;
    this.databaseService = databaseService;
    this.initCommands();
    this.initEvents();
  }

  public async login(token = process.env.DISCORD_TOKEN): Promise<void> {
    if (token === 'undefined') {
      throw new Error('No Discord token set');
    }
    await this.client.login();
  }

  public logout(): void {
    this.client.destroy();
  }

  public async setActivity(): Promise<void> {
    if (!this.client.user) {
      throw new Error('No Discord user found');
    }
    this.client.user.setActivity({
      name: translations.defaultActivity,
      type: ActivityType.Listening,
    });
  }

  private findOrAddUser(userId: string, userName: string): User {
    let user = this.users.find(user => {
      return user.userId === userId;
    });
    if (!user) {
      user = new User(userId, userName);
      this.users.push(user);
    }
    return user;
  }

  private async initCommands(): Promise<void> {
    this.commands = await buildCommands();
    this.pushCommands();
  }

  private async pushCommands(): Promise<void> {
    const restCommands: Array<SlashCommandBuilder> = [];
    this.commands.forEach(command => {
      const data = new SlashCommandBuilder()
        .setName(command.name)
        .setDescription(command.helperText ? command.helperText : 'admin_only');

      if (command.adminOnly) {
        data.setDefaultMemberPermissions(0);
      }

      if (command.parameters) {
        command.parameters.forEach(option => {
          data.addStringOption(o =>
            o.setName(option.name).setDescription(option.description).setRequired(option.required),
          );
        });
      }

      restCommands.push(data);
    });

    const guild = this.client.guilds.cache.first();
    const clientId = this.client.application?.id.toString();

    if (guild != undefined && clientId != undefined && process.env.DISCORD_TOKEN != undefined) {
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
      rest
        .put(Routes.applicationGuildCommands(clientId, guild.id), {
          body: restCommands,
        })
        .then(() => this.loggingService.log(`Successfully registered application commands.`))
        .catch(() => {
          this.loggingService.log('Failed to push errors');
        });
    }
  }

  private initEvents(): void {
    this.handleReadyEvent();
    this.handleVoiceEvent();
    this.handleCommands();
    this.handleReactions();
  }

  private initUsers(): Promise<void> {
    return new Promise<void>(resolve => {
      const guild = this.client.guilds.cache.first();
      if (!guild) {
        throw new Error('No server connected');
      }
      guild.members.cache.forEach(member => {
        const user = new User(member.user.id, member.user.username);
        this.users.push(user);
        if (member.voice && member.voice.channel) {
          this.callState.addUserToCall(member.voice.channel.id, user);
        }
      });
      resolve();
    });
  }

  private handleCommands(): void {
    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;
      const content = interaction.commandName;
      this.commands.forEach(async command => {
        if (content.toLowerCase().startsWith(`${command.name}`)) {
          const parameters = new Array<string>();
          interaction.options.data.forEach(parameter => {
            if (parameter.value) {
              parameters.push(parameter.value.toString());
            }
          });
          try {
            let permitted = true;
            if (!interaction.user || !interaction.guild) {
              throw new Error('This message has no sender or no server');
            }
            if (command.adminOnly && !(interaction.user.id === interaction.guild.ownerId)) {
              permitted = false;
            }
            if (permitted) {
              const commandResponse = await command.execute(parameters);

              if (command.useConfirmation) {
                this.confirmCommandReply(commandResponse, interaction, command);
              } else {
                this.replyToCommand(commandResponse, false, interaction, command);
              }
              if (commandResponse.refreshCommands) {
                await this.initCommands();
              }
            }
          } catch (err) {
            await interaction.reply({
              content: translations.genericError,
              ephemeral: command.ephemeral,
            });
            this.loggingService.log(err);
          }
        }
      });
    });
  }

  private async confirmCommandReply(
    commandResponse: CommandResponse,
    interaction: ChatInputCommandInteraction<CacheType>,
    command: Command,
  ): Promise<void> {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(interaction.id)
        .setLabel(translations.confirmationButton)
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.reply({
      content: `${translations.confirmationQuery}\n${commandResponse.response[0]}`,
      ephemeral: true,
      components: [row],
    });

    const filter = (i: MessageComponentInteraction): boolean => i.customId === interaction.id;

    if (!interaction || !interaction.channel) {
      throw new Error('This message has no interaction or no channel');
    }

    const collector = interaction.channel.createMessageComponentCollector({
      filter,
      time: 15000,
    });

    if (!collector) {
      throw new Error('The event collector was not initialized correctly!');
    }

    collector.on('collect', async i => {
      await i.update({ content: translations.confirmationConfirmed, components: [] });
      collector.stop();
      this.replyToCommand(commandResponse, true, interaction, command);
    });
  }

  private async replyToCommand(
    commandResponse: CommandResponse,
    replied: boolean,
    interaction: ChatInputCommandInteraction<CacheType>,
    command: Command,
  ): Promise<void> {
    commandResponse.response.forEach(async response => {
      if (!replied) {
        replied = true;
        await interaction.reply({
          content: response,
          ephemeral: command.ephemeral,
        });
      } else {
        await interaction.fetchReply();
        await interaction.followUp({
          content: response,
          ephemeral: command.ephemeral,
        });
      }
    });
    if (commandResponse.refreshCommands) {
      await this.initCommands();
    }
  }

  private handleReactions(): void {
    this.client.on('messageCreate', message => {
      if (!message.author.bot) {
        const content = message.content;
        const emotes = content.match(/<:[a-zA-Z]+:[0-9]+>/g);
        if (emotes) {
          emotes.forEach(async (match: string) => {
            this.updateEmoteInDatabase(match, true);
          });
        }
      }
    });
    this.client.on('messageReactionAdd', reaction => {
      this.updateEmoteInDatabase(`<:${reaction.emoji.identifier}>`, true);
    });
    this.client.on('messageReactionRemove', reaction => {
      this.updateEmoteInDatabase(`<:${reaction.emoji.identifier}>`, false);
    });
  }

  private updateEmoteInDatabase(emote: string, added: boolean): void {
    if (this.checkIfEmojiExists(emote)) {
      this.databaseService.incrementFieldFindByFilter(emotesTable, 'name', emote, 'amount', added);
    }
  }

  private checkIfEmojiExists(emoji: string): GuildEmoji | undefined {
    return this.client.emojis.cache.find(emote => emoji.includes(emote.identifier));
  }

  private handleReadyEvent(): void {
    this.client.on('ready', () => {
      if (!this.client.user) {
        throw new Error('No Discord user found');
      }
      this.loggingService.log(`Logged in as ${this.client.user.tag}!`);
      this.initUsers();
      this.initCommands();
      this.setActivity();
    });
  }

  private handleVoiceEvent(): void {
    this.client.on('voiceStateUpdate', (oldstate, newstate) => {
      if (!newstate.member?.displayName) {
        throw new Error('User does not have a username');
      }
      const user = this.findOrAddUser(newstate.id, newstate.member.displayName);
      this.handleUsersEndingCalls(oldstate, newstate, user);
      this.handleUsersStartingCalls(oldstate, newstate, user);
    });
  }

  private handleUsersStartingCalls(oldstate: VoiceState, newstate: VoiceState, user: User): void {
    if (!newstate.member?.displayName) {
      throw new Error('User does not have a username');
    }
    if (
      newstate.channelId &&
      newstate.channel &&
      newstate.channel.joinable &&
      oldstate.channelId !== newstate.channelId
    ) {
      const userCountAfterAddition = this.callState.addUserToCall(newstate.channelId, user);
      if (userCountAfterAddition === 1) {
        const starterUserName = newstate.member.nickname
          ? newstate.member.nickname
          : newstate.member.displayName;
        this.sendMessageInMainChannel(
          `${starterUserName} ${translations.callStarted} ${newstate.channel.name}!`,
        );
      }
    }
  }

  private handleUsersEndingCalls(oldstate: VoiceState, newstate: VoiceState, user: User): void {
    if (
      oldstate.channelId &&
      oldstate.channel &&
      oldstate.channel.joinable &&
      oldstate.channelId !== newstate.channelId
    ) {
      const removalResult = this.callState.removeUserFromCall(oldstate.channelId, user);
      if (removalResult.userCount === 0) {
        this.sendMessageInMainChannel(
          `${translations.callEnded} ${oldstate.channel.name}. ${translations.callEndedDuration} ${removalResult.duration}`,
        );
      }
    }
  }

  private async sendMessageInMainChannel(message: string): Promise<Message> {
    return new Promise<Message>(resolve => {
      if (!this.mainChannel) {
        this.setMainChannel();
      }
      if (!this.mainChannel) {
        throw new Error('Unable to find main channel');
      }
      resolve(this.mainChannel.send(message));
    });
  }

  private setMainChannel(): Promise<void> {
    return new Promise<void>(resolve => {
      const guild = this.client.guilds.cache.first();
      if (!guild) {
        throw new Error('Unable to find main channel');
      }
      const channel = guild.channels.cache.find(channel => {
        return channel.type === ChannelType.GuildText;
      }) as TextChannel;
      this.mainChannel = channel ? channel : null;
      resolve();
    });
  }
}
