import { Command } from "../../classes/Command";
import { Source } from "../../classes/Source";
import randomElement from "../../features/utils/randomElement";
import { info } from "../../features/json/diepRandomInfo.json";
import { CommandType } from "../../utils/enums";
import { ApplicationCommandOptionType } from "discord.js";

export default class DiepInfo extends Command<[string]> {
  constructor() {
    super({
      type: CommandType.Fun, 
      name: 'random', 
      description: '隨機抽取一台 Diep.io 的坦克', 
      aliases: ['rt'], 
      options: [{
        type: ApplicationCommandOptionType.String, 
        name: '類別',
        description: '要選擇的坦克類別',
        required: false,
        choices: [
          { name: '一般坦克', value: 'normal' }, { name: '特殊坦克', value: 'special' }, { name: '已移除坦克', value: 'removed' }
        ]
      }]
    });
  }

  public async execute(source: Source, [category]: [string]): Promise<void> {
    await source.defer();
    const assignedTanks = category ? info.filter(tank => tank.category === category) : info;
    const { name, link, id } = randomElement(assignedTanks);
    await source.update(`本次隨機抽取出的坦克是 ID 為 ${id} 的 ${name}\n詳細資訊：<${'https://diepio.fandom.com/zh/wiki/'+link}>`);
  }
}