import { MessageUtil } from ".";
import { CategoryChannel, Client, DMChannel, GroupDMChannel, GuildStageVoiceChannel, GuildVoiceChannel, Message, MessageCollector, NewsChannel, TextChannel, ThreadChannel } from "../structures";
import { CollectorOptions, TextBasedChannel, TextBasedChannelSendOptions } from "../types/interfaces";
import { APIChannel, APIMessage, Channel, ChannelType, Routes } from "../types/types";

export class ChannelUtil extends null {
  static createChannel(client: Client, data: APIChannel): Channel | undefined {
    switch (data.type) {
      case ChannelType.DM:
        return new DMChannel(client, data);
      
      case ChannelType.GroupDM:
        return new GroupDMChannel(client, data);
      
      case ChannelType.GuildCategory:
        return new CategoryChannel(client, data);
      
      // case ChannelType.GuildDirectory:
      //   return new DirectoryChannel(client, data);
      
      // case ChannelType.GuildForum:
      //   return new GuildForumChannel(client, data);
      
      case ChannelType.GuildNews:
        return new NewsChannel(client, data);
      
      case ChannelType.GuildNewsThread:
      case ChannelType.GuildPrivateThread:
      case ChannelType.GuildPublicThread:
        return new ThreadChannel(client, data);
      
      case ChannelType.GuildStageVoice:
        return new GuildStageVoiceChannel(client, data);
      
      case ChannelType.GuildText:
        return new TextChannel(client, data);
      
      case ChannelType.GuildVoice:
        return new GuildVoiceChannel(client, data);
    }
    return undefined;
  }

  static ApplyTextBased<T extends abstract new (...args: any[]) => { client: Client, id: string, guildId?: string }>(Base: T) {
    abstract class BaseWithTextBased extends Base implements TextBasedChannel {
      public async send(message: TextBasedChannelSendOptions | string): Promise<Message> {
        const body = typeof message === 'string' ? { content: message } : MessageUtil.resolveBody(message);
        const files = typeof message === 'string' ? [] : await MessageUtil.resolveFiles(message.files ?? []);
    
        const data = await this.client.rest.post(Routes.channelMessages(this.id), { body, files }) as APIMessage;
        return new Message(this.client, data);
      }

      public createMessageCollector(options: CollectorOptions): MessageCollector {
        return new MessageCollector({ channelId: this.id, guildId: this.guildId, ...options });
      }

      public awaitMessages(options: CollectorOptions): Promise<Map<string, APIMessage>> {
        return new Promise(resolve => {
          this.createMessageCollector(options).on('end', resolve);
        });
      }


      public createMessageComponentCollector(options: MessageComponentCollectorOptions): Promise<void>;
      public awaitMessageComponent(options: MessageComponentCollectorOptions): Promise<void>;
    }
    return BaseWithTextBased;
  }
}
