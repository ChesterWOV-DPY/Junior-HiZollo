import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, GuildMember, GuildTextBasedChannel, InteractionCollector, Message, MessageOptions } from "discord.js";
import { HZClient } from "../../HZClient";
import { MusicControllerActions } from "../../../utils/enums";
import { GuildMusicControllerOptions } from "../../../utils/interfaces";
import { GuildMusicManager } from "../Model/GuildMusicManager";
import { MusicViewRenderer } from "../View/MusicViewRenderer";

/**
 * 代表單個伺服器的音樂遙控器
 */
export class GuildMusicController {
  /**
   * 機器人的 client
   */
  public client: HZClient;

  /**
   * 與這個音樂遙控器綁定的文字頻道
   */
  public channel: GuildTextBasedChannel;

  /**
   * 告知使用者音樂系統狀態的顯示器
   */
  public view: MusicViewRenderer;

  /**
   * 所屬伺服器的音樂管家
   */
  public manager: GuildMusicManager;

  /**
   * 被遙控器附著的訊息
   */
  public message: Message | null;

  /**
   * 負責接收按鈕互動的收集器
   */
  public collector: InteractionCollector<ButtonInteraction> | null;

  /**
   * 切換播放／暫停狀態的迭代器
   */
  private playButtonsItr: Iterator<ButtonBuilder, ButtonBuilder>;
  
  /**
   * 切換重播狀態的迭代器
   */
  private repeatButtonsItr: Iterator<ButtonBuilder, ButtonBuilder>;

  /**
   * 遙控器上負責控制音樂系統的按鈕
   */
  private controllerButtons: ButtonBuilder[];

  /**
   * 遙控器上負責顯示資訊的按鈕
   */
  private dataButtons: ButtonBuilder[];

  /**
   * 建立一台音樂遙控器
   * @param options 設定參數
   */
  constructor({ client, channel, view, manager }: GuildMusicControllerOptions) {
    this.client = client;
    this.channel = channel;
    this.view = view;
    this.manager = manager;
    this.message = null;
    this.collector = null;

    this.playButtonsItr = this.playButtons();
    this.repeatButtonsItr = this.repeatButtons();

    this.controllerButtons = [
      this.playButtonsItr.next().value, 
      this.repeatButtonsItr.next().value, 
      new ButtonBuilder()
        .setCustomId('music_ctrl_skip')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(this.emojis.skip), 
    ];
    this.dataButtons = [
      new ButtonBuilder()
      .setCustomId('music_ctrl_info')
      .setStyle(ButtonStyle.Success)
      .setEmoji(this.emojis.info)
    ];
  }

  /**
   * 將遙控器原本附著的訊息刪除，並重新附著在一則新發送的訊息
   */
  public async resend(): Promise<void> {
    await this.message?.delete().catch(() => {});
    this.message = await this.channel.send(this.newMessage);
    this.collector = this.newCollector;
  }

  /**
   * 清除遙控器附著的訊息以及收集器
   */
  public async clear(): Promise<void> {
    await this.message?.delete().catch(() => {});
    this.collector?.removeAllListeners('collected');
    this.collector = null;
  }

  /**
   * 回傳現正播放歌曲的 MessageOptions
   */
  private get newMessage(): MessageOptions {
    return {
      components: this.newComponents, 
      embeds: this.view.getcontrollerEmbeds(this.manager)
    }
  }

  /**
   * 取得新的遙控器按鈕
   */
  private get newComponents(): ActionRowBuilder<ButtonBuilder>[] {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(...this.controllerButtons), 
      new ActionRowBuilder<ButtonBuilder>().addComponents(...this.dataButtons), 
    ];
  }

  /**
   * 在遙控器附著的訊息上建立新的收集器
   */
  private get newCollector(): InteractionCollector<ButtonInteraction> {
    if (!this.message) throw new Error('Message does not exist.');
    this.collector?.removeAllListeners('collected');

    const collector = this.message.createMessageComponentCollector({
      componentType: ComponentType.Button, 
      filter: async interaction => {
        if (!interaction.customId.startsWith('music_ctrl')) return false;
        if (!(interaction.member instanceof GuildMember)) return false;

        if (interaction.member.voice.channelId !== this.manager.voiceChannel.id && interaction.customId !== 'music_ctrl_info') {
          await this.view.controllerError(interaction);
          return false;
        }
        return true;
      }
    });

    collector.on('collect', async interaction => {
      if (!(interaction.member instanceof GuildMember)) return;

      const nowPlaying = this.manager.nowPlaying;
      if (!nowPlaying) return;

      const args = interaction.customId.split('_');
      switch (args[2]) {
        case 'play':
          this.controllerButtons[0] = this.playButtonsItr.next().value;
          this.manager.togglePlay();
          this.controllerButtons[0].data.emoji?.id === this.emojis.play[0] ?
            await this.view.controllerAction(MusicControllerActions.Resume, interaction, nowPlaying) : 
            await this.view.controllerAction(MusicControllerActions.Pause, interaction, nowPlaying);
          break;
        
        case 'repeat':
          this.controllerButtons[1] = this.repeatButtonsItr.next().value;
          this.manager.toggleLoop();
          this.controllerButtons[1].data.emoji?.name === this.emojis.repeat[0] ?
            await this.view.controllerAction(MusicControllerActions.NoRepeat, interaction, nowPlaying) :
            await this.view.controllerAction(MusicControllerActions.Repeat, interaction, nowPlaying);
          break;
        
        case 'skip':
          this.manager.skip();
          await this.view.controllerAction(MusicControllerActions.Skip, interaction, nowPlaying);
          break;
        
        case 'info':
          await this.view.controllerAction(MusicControllerActions.Info, interaction, nowPlaying);
          return; // 這邊 render 的時候會 reply，所以直接結束
      }

      // 可能會因為跳過歌曲導致附著訊息被刪除
      await interaction.update({ components: this.newComponents }).catch(() => {}); 
    });

    return collector;
  }

  /**
   * 回傳一個切換播放／暫停狀態的迭代器
   */
  private *playButtons(): Generator<ButtonBuilder, ButtonBuilder, void> {
    let index = 0;
    const button = new ButtonBuilder()
      .setCustomId('music_ctrl_play')
      .setStyle(ButtonStyle.Primary);
    while (true) {
      yield button.setEmoji(this.emojis.play[(index++) % 2]);
    }
  }

  /**
   * 回傳一個切換重播狀態的迭代器
   */
  private *repeatButtons(): Generator<ButtonBuilder, ButtonBuilder, void> {
    let index = 0;
    const button = new ButtonBuilder()
      .setCustomId('music_ctrl_repeat')
      .setStyle(ButtonStyle.Secondary);
    while (true) {
      yield button.setEmoji(this.emojis.repeat[(index++) % 2]);
    }
  }

  /**
   * 遙控器按鈕上的表情符號
   */
  private emojis = Object.freeze({
    play: ['1002969357980270642', '880450475202314300'], 
    repeat: ['➡️', '🔂'], 
    skip: '880450475156176906', 
    info: '🎵'
  });
}