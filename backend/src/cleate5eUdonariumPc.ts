import axios from 'axios';
import type {Request, Response } from "express"
import * as cheerio from 'cheerio';
import { create } from 'xmlbuilder2';
import archiver from 'archiver';
import * as stream from 'stream'; // streamモジュールもインポート
import iconv from "iconv-lite";
import {contentDispositionFilename} from "./contentDispositionFilename"

export const cleate5eUdonariumPc = async (req:Request, res:Response) => {
  try {
    //キャラシURL
    const targetUrl = req.query.url as string | undefined;
    const simplePallete = req.query.simple_palette === "true"
    const rollcommand = (req.query.rollcommand|| "") as string;

    if (!targetUrl) {
      res.status(400).send('URLクエリパラメータを指定してください。');
      return;
    } else {
      const pattern = /^https:\/\/dndjp\.sakura\.ne\.jp\/OUTPUT\.php\?ID=\d+$/;
      if(!pattern.test(targetUrl)) {
        res.status(400).send('URLの形式が正しくありません。')
        return;
      }
    }
    const response = await axios.get(targetUrl,{
      responseType: "arraybuffer",
      responseEncoding: "binary"
    });
    const html = response.data;

    const encodeHtml = iconv.decode(html, "SHIFT-JIS");

    const data = readCharactorData(encodeHtml)

    const chatpalette = createChatPalette(data, simplePallete, rollcommand);

    const xmlString = createXML(data,chatpalette)

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    const cleanFilename = contentDispositionFilename(data.get("name"));

    // PassThroughストリームは型定義がない場合があるため、明示的に型を付けないか、anyで回避
    const outputStream = new stream.PassThrough();
    archive.pipe(outputStream);
    archive.append(xmlString, { name: `${data.get("name")}.xml` });

    // HTTPヘッダーを設定
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''"${cleanFilename}.zip"`,
    });

    // ZIPストリームをレスポンスにパイプ
    outputStream.pipe(res);
    archive.finalize();

  } catch (error: any) { // error の型は unknown なので、any などにキャストしてアクセス
    console.error(error)
    res.status(500).send('サーバーエラーが発生しました。');
  }
};

type attackType = {
  name: string,
  bonus: string,
  damage: string,
  damageType: string,
  note: string
}

//スクレイピング
function readCharactorData(html:string) {
  const $ = cheerio.load(html);
  const result = new Map()
  result.set("name", $('title').text().trim())
  result.set("imageurl", $('img').attr("src")?.trim())
  result.set("attribute", $('body > table:nth-child(5) > tbody > tr:nth-child(2) > td:nth-child(2) > div > b').text().trim())
  result.set("playername", $('body > table:nth-child(5) > tbody > tr:nth-child(2) > td:nth-child(3) > div > b').text().trim())
  result.set("classes", $('body > table:nth-child(5) > tbody > tr:nth-child(3) > td:nth-child(1) > div > b').text().trim())
  result.set("level", $('body > table:nth-child(5) > tbody > tr:nth-child(3) > td:nth-child(2) > div > b').text().trim())
  result.set("race", $('body > table:nth-child(5) > tbody > tr:nth-child(4) > td:nth-child(1) > div > b').text().trim())
  result.set("size", $('body > table:nth-child(5) > tbody > tr:nth-child(4) > td:nth-child(2) > div > b').text().trim())
  result.set("sex", $('body > table:nth-child(5) > tbody > tr:nth-child(4) > td:nth-child(4) > div > b').text().trim())
  result.set("age", $('body > table:nth-child(5) > tbody > tr:nth-child(4) > td:nth-child(3) > div > b').text().trim())

  result.set("ac", $('body > table:nth-child(6) > tbody > tr > td:nth-child(2) > table > tbody > tr.LWC > td:nth-child(1) > div > b').text().trim())
  result.set("initiative", $('body > table:nth-child(6) > tbody > tr > td:nth-child(1) > table > tbody > tr.LWC > td:nth-child(1) > div > b').text().trim())
  result.set("speed", $('body > table:nth-child(6) > tbody > tr > td:nth-child(3) > table > tbody > tr.MWC > td:nth-child(1) > div > b').text().trim())

  const $ability = $('body > table:nth-child(7) > tbody > tr > td:nth-child(1) > table > tbody > tr.MBC > td > table > tbody')

  result.set("ability", {
      str: $ability.find('tr:nth-child(2) > td:nth-child(1) > div > b').text().trim(),
      dex: $ability.find('tr:nth-child(3) > td:nth-child(1) > div > b').text().trim(),
      con: $ability.find('tr:nth-child(4) > td:nth-child(1) > div > b').text().trim(),
      int: $ability.find('tr:nth-child(5) > td:nth-child(1) > div > b').text().trim(),
      wis: $ability.find('tr:nth-child(6) > td:nth-child(1) > div > b').text().trim(),
      cha: $ability.find('tr:nth-child(7) > td:nth-child(1) > div > b').text().trim()
    }
  )

  const $abilityBonus = $('body > table:nth-child(7) > tbody > tr > td:nth-child(1) > table > tbody > tr.MBC > td > table > tbody')
  result.set("abilityBonus", {
      str: $abilityBonus.find('tr:nth-child(2) > td:nth-child(3) > div > b').text().trim() || "0",
      dex: $abilityBonus.find('tr:nth-child(3) > td:nth-child(3) > div > b').text().trim() || "0",
      con: $abilityBonus.find('tr:nth-child(4) > td:nth-child(3) > div > b').text().trim() || "0",
      int: $abilityBonus.find('tr:nth-child(5) > td:nth-child(3) > div > b').text().trim() || "0",
      wis: $abilityBonus.find('tr:nth-child(6) > td:nth-child(3) > div > b').text().trim() || "0",
      cha: $abilityBonus.find('tr:nth-child(7) > td:nth-child(3) > div > b').text().trim() || "0"
    }
  )

  result.set("pb", $('body > table:nth-child(7) > tbody > tr > td:nth-child(2) > table:nth-child(1) > tbody > tr.MWC > td:nth-child(4) > div > b').text().trim())

  const $save = $('body > table:nth-child(7) > tbody > tr > td:nth-child(2) > table:nth-child(2) > tbody')
  result.set("save" ,{
    str: $save.find('tr:nth-child(2) > td:nth-child(2) > div > b').text().trim(),
    dex: $save.find('tr:nth-child(3) > td:nth-child(2) > div > b').text().trim(),
    con: $save.find('tr:nth-child(4) > td:nth-child(2) > div > b').text().trim(),
    int: $save.find('tr:nth-child(5) > td:nth-child(2) > div > b').text().trim(),
    wis: $save.find('tr:nth-child(6) > td:nth-child(2) > div > b').text().trim(),
    cha: $save.find('tr:nth-child(7) > td:nth-child(2) > div > b').text().trim(),
  })
  result.set("hp", $("body > table:nth-child(7) > tbody > tr > td:nth-child(3) > table > tbody > tr:nth-child(5) > td:nth-child(1) > div > b").text().trim())
  result.set("hitdice", $("body > table:nth-child(7) > tbody > tr > td:nth-child(3) > table > tbody > tr:nth-child(7) > td:nth-child(2) > div").text().trim())
  
  const $skill = $('body > table:nth-child(8) > tbody > tr:nth-child(1) > td:nth-child(1) > table > tbody')
  result.set("skill",{
    INTIMIDATION: $skill.find('tr:nth-child(3) > td:nth-child(1) > center > div > b').text().trim(),
    MEDICINE: $skill.find('tr:nth-child(4) > td:nth-child(1) > center > div > b').text().trim(),
    ATHLETICS: $skill.find('tr:nth-child(5) > td:nth-child(1) > center > div > b').text().trim(),
    STEALTH: $skill.find('tr:nth-child(6) > td:nth-child(1) > center > div > b').text().trim(),
    ACROBATICS: $skill.find('tr:nth-child(7) > td:nth-child(1) > center > div > b').text().trim(),
    INSIGHT: $skill.find('tr:nth-child(8) > td:nth-child(1) > center > div > b').text().trim(),
    PERFORMANCE: $skill.find('tr:nth-child(9) > td:nth-child(1) > center > div > b').text().trim(),
    NATURE: $skill.find('tr:nth-child(10) > td:nth-child(1) > center > div > b').text().trim(),
    RELIGION: $skill.find('tr:nth-child(11) > td:nth-child(1) > center > div > b').text().trim(),
    SURVIVAL: $skill.find('tr:nth-child(12) > td:nth-child(1) > center > div > b').text().trim(),
    PERSUASION: $skill.find('tr:nth-child(13) > td:nth-child(1) > center > div > b').text().trim(),
    INVESTIGATION: $skill.find('tr:nth-child(14) > td:nth-child(1) > center > div > b').text().trim(),
    PERCEPTION: $skill.find('tr:nth-child(15) > td:nth-child(1) > center > div > b').text().trim(),
    SLEIGHTOFHAND: $skill.find('tr:nth-child(16) > td:nth-child(1) > center > div > b').text().trim(),
    ANIMALHANDLING: $skill.find('tr:nth-child(17) > td:nth-child(1) > center > div > b').text().trim(),
    DECEPTION: $skill.find('tr:nth-child(18) > td:nth-child(1) > center > div > b').text().trim(),
    ARCANA: $skill.find('tr:nth-child(19) > td:nth-child(1) > center > div > b').text().trim(),
    HISTORY: $skill.find('tr:nth-child(20) > td:nth-child(1) > center > div > b').text().trim(),
  })

  const $attacks = $("body > table:nth-child(8) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody");

  result.set("attack", [...new Array(6).keys()].map(i=>{
    const $attack = $attacks.find(`tr:nth-child(${3+i*2})`);
    const name = $attack.find(`td:nth-child(1) > div`).text().trim()
    if(!name) return false;
    return {
      name: name,
      bonus: $attack.find(`td:nth-child(2) > div`).text().trim(),
      damage: $attack.find(`td:nth-child(3) > div`).text().trim(),
      damageType: $attack.find(`td:nth-child(4) > div`).text().trim(),
      note: $attack.find(`td:nth-child(5) > div`).text().trim(),
    }
  }).filter(el=>el))

  result.set("spellSave", $('body > table:nth-child(10) > tbody > tr:nth-child(4) > td:nth-child(6) > div > b').text().trim())
  result.set("spellAttack", $('body > table:nth-child(10) > tbody > tr:nth-child(4) > td:nth-child(8) > div > b').text().trim())

  result.set("slots", {
    lv1: $("body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(1) > table > tbody > tr:nth-child(16) > td:nth-child(3) > div").text().trim(),
    lv2: $("body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(1) > table > tbody > tr:nth-child(33) > td:nth-child(3) > div").text().trim(),
    lv3: $("body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr:nth-child(2) > td:nth-child(3) > div").text().trim(),
    lv4: $("body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr:nth-child(19) > td:nth-child(3) > div").text().trim(),
    lv5: $("body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr:nth-child(35) > td:nth-child(3) > div").text().trim(),
    lv6: $("body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(2) > td:nth-child(3) > div").text().trim(),
    lv7: $("body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(16) > td:nth-child(3) > div").text().trim(),
    lv8: $("body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(28) > td:nth-child(3) > div").text().trim(),
    lv9: $("body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(39) > td:nth-child(3) > div").text().trim(),
  })

  result.set("spells", {
    "lv0": [...(new Array(10)).keys()].map(i=>$(`body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(1) > table > tbody > tr:nth-child(${4+i}) > td > div`).text().trim()).filter(e=>e),
    "lv1": [...(new Array(13)).keys()].map(i=>$(`body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(1) > table > tbody > tr:nth-child(${18+i}) > td:nth-child(2) > div`).text().trim()).filter(e=>e),
    "lv2": [...(new Array(13)).keys()].map(i=>$(`body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(1) > table > tbody > tr:nth-child(${35+i}) > td:nth-child(2) > div`).text().trim()).filter(e=>e),
    "lv3": [...(new Array(13)).keys()].map(i=>$(`body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr:nth-child(${4+i}) > td:nth-child(2) > div`).text().trim()).filter(e=>e),
    "lv4": [...(new Array(11)).keys()].map(i=>$(`body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr:nth-child(${21+i}) > td:nth-child(2) > div`).text().trim()).filter(e=>e),
    "lv5": [...(new Array(10)).keys()].map(i=>$(`body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr:nth-child(${37+i}) > td:nth-child(2) > div`).text().trim()).filter(e=>e),
    "lv6": [...(new Array(10)).keys()].map(i=>$(`body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(${4+i}) > td:nth-child(2) > div`).text().trim()).filter(e=>e),
    "lv7": [...(new Array(8)).keys()].map(i=>$(`body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(${18+i}) > td:nth-child(2) > div`).text().trim()).filter(e=>e),
    "lv8": [...(new Array(7)).keys()].map(i=>$(`body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(${30+i}) > td:nth-child(2) > div`).text().trim()).filter(e=>e),
    "lv9": [...(new Array(6)).keys()].map(i=>$(`body > table:nth-child(12) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(${41+i}) > td:nth-child(2) > div`).text().trim()).filter(e=>e),
  })

  result.set("background", $("body > table:nth-child(8) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(3) > td > div").text())
  result.set("traits", $("body > table:nth-child(8) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(7) > td > div").text())
  result.set("ideals", $("body > table:nth-child(8) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(11) > td > div").text())
  result.set("bonds", $("body > table:nth-child(8) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(15) > td > div").text())
  result.set("flows", $("body > table:nth-child(8) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(19) > td > div").text())
  result.set("characterDesign", $("body > table:nth-child(8) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(23) > td > div").text())
  result.set("etc", $("body > table:nth-child(9) > tbody > tr:nth-child(1) > td:nth-child(1) > table:nth-child(1) > tbody > tr.SBL > td > div").text())
  result.set("feats", $("body > table:nth-child(9) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(3) > td > div").text())

  return result;
}

//XML生成
function createXML (data:Map<string,any>,chatpaletteText:string) {
  const root = create({ version: '1.0' })
  .ele("character")
    .ele("data", {name: "character"})
      .ele("data", {name:"image"})
        .ele("data",{name:"imageIdentifier", type:"image"}).txt("null").up()
        .up()
      .ele("data", {name:"common"})
        .ele("data", {name: "name"}).txt(data.get("name")).up()
        .ele("data", {name: "size"}).txt("1").up()
        .up()
      .ele("data", {name: "detail"})
        .ele("data", {name: "基本"})
          .ele("data", {name: "種族"}).txt(data.get("race")).up()
          .ele("data", {name: "クラス"}).txt(data.get("classes")).up()
          .ele("data", {name: "属性"}).txt(data.get("attribute")).up()
          .ele("data", {name: "プレイヤー"}).txt(data.get("playername")).up()
          .ele("data", {name: "レベル"}).txt(data.get("level")).up()
          .up()
        .ele("data", {name: "能力値"})
          .ele("data", {name: "【筋力】"}).txt(data.get("ability").str).up()
          .ele("data", {name: "【敏捷力】"}).txt(data.get("ability").dex).up()
          .ele("data", {name: "【耐久力】"}).txt(data.get("ability").con).up()
          .ele("data", {name: "【知力】"}).txt(data.get("ability").int).up()
          .ele("data", {name: "【判断力】"}).txt(data.get("ability").wis).up()
          .ele("data", {name: "【魅力】"}).txt(data.get("ability").cha).up()
          .up()
        .ele("data", {name: "能力値修正"})
          .ele("data", {name: "筋力修正"}).txt(modifierValue(data.get("abilityBonus").str)).up()
          .ele("data", {name: "敏捷力修正"}).txt(modifierValue(data.get("abilityBonus").dex)).up()
          .ele("data", {name: "耐久力修正"}).txt(modifierValue(data.get("abilityBonus").con)).up()
          .ele("data", {name: "知力修正"}).txt(modifierValue(data.get("abilityBonus").int)).up()
          .ele("data", {name: "判断力修正"}).txt(modifierValue(data.get("abilityBonus").wis)).up()
          .ele("data", {name: "魅力修正"}).txt(modifierValue(data.get("abilityBonus").cha)).up()
          .up()
        .ele("data", {name: "行動データ"})
          .ele("data", {name: "AC"}).txt(data.get("ac")).up()
          .ele("data", {name: "HP", type: "numberResource", currentValue: data.get("hp")}).txt(data.get("hp")).up()
          .ele("data", {name: "一時的HP", type: "numberResource", currentValue: "0"}).txt("100").up()
          .ele("data", {name: "ヒット・ダイス"}).txt(data.get("hitdice")).up()
          .ele("data", {name: "インスピレーション", type:"numberResource", currentValue:"0"}).txt("1").up()
          .ele("data", {name: "習熟ボーナス"}).txt(data.get("pb")).up()
          .ele("data", {name: "呪文攻撃ロール"}).txt(modifierValue(data.get("spellAttack"))).up()
          .ele("data", {name: "呪文セーブ"}).txt(data.get("spellSave")).up()
          .ele("data", {name: "サイズ"}).txt(data.get("size")).up()
          .ele("data", {name: "移動速度"}).txt(data.get("speed")).up()
          .ele("data", {name: "イニシアチブ"}).txt(modifierValue(data.get("initiative"))).up()
          .ele("data", {name: "状態異常"}).txt("-").up()
          .up()
        .ele("data", {name: "技能"})
          .ele("data", {name: "〈威圧〉"}).txt(modifierValue(data.get("skill").INTIMIDATION)).up()
          .ele("data", {name: "〈医術〉"}).txt(modifierValue(data.get("skill").MEDICINE)).up()
          .ele("data", {name: "〈運動〉"}).txt(modifierValue(data.get("skill").ATHLETICS)).up()
          .ele("data", {name: "〈隠密〉"}).txt(modifierValue(data.get("skill").STEALTH)).up()
          .ele("data", {name: "〈軽業〉"}).txt(modifierValue(data.get("skill").ACROBATICS)).up()
          .ele("data", {name: "〈看破〉"}).txt(modifierValue(data.get("skill").INSIGHT)).up()
          .ele("data", {name: "〈芸能〉"}).txt(modifierValue(data.get("skill").PERFORMANCE)).up()
          .ele("data", {name: "〈自然〉"}).txt(modifierValue(data.get("skill").NATURE)).up()
          .ele("data", {name: "〈宗教〉"}).txt(modifierValue(data.get("skill").RELIGION)).up()
          .ele("data", {name: "〈生存〉"}).txt(modifierValue(data.get("skill").SURVIVAL)).up()
          .ele("data", {name: "〈説得〉"}).txt(modifierValue(data.get("skill").PERSUASION)).up()
          .ele("data", {name: "〈捜査〉"}).txt(modifierValue(data.get("skill").INVESTIGATION)).up()
          .ele("data", {name: "〈知覚〉"}).txt(modifierValue(data.get("skill").PERCEPTION)).up()
          .ele("data", {name: "〈手先の早業〉"}).txt(modifierValue(data.get("skill").SLEIGHTOFHAND)).up()
          .ele("data", {name: "〈動物使い〉"}).txt(modifierValue(data.get("skill").ANIMALHANDLING)).up()
          .ele("data", {name: "〈ペテン〉"}).txt(modifierValue(data.get("skill").DECEPTION)).up()
          .ele("data", {name: "〈魔法学〉"}).txt(modifierValue(data.get("skill").ARCANA)).up()
          .ele("data", {name: "〈歴史〉"}).txt(modifierValue(data.get("skill").HISTORY)).up()
          .up()
        .ele("data", {name: "セーヴィングスロー"})
          .ele("data", {name: "筋力セーヴ"}).txt(modifierValue(data.get("save").str)).up()
          .ele("data", {name: "敏捷力セーヴ"}).txt(modifierValue(data.get("save").dex)).up()
          .ele("data", {name: "耐久力セーヴ"}).txt(modifierValue(data.get("save").con)).up()
          .ele("data", {name: "知力セーヴ"}).txt(modifierValue(data.get("save").int)).up()
          .ele("data", {name: "判断力セーヴ"}).txt(modifierValue(data.get("save").wis)).up()
          .ele("data", {name: "魅力セーヴ"}).txt(modifierValue(data.get("save").cha)).up()
          .up()
        .ele("data", {name: "特徴等"})
          .ele("data", {name: "背景", type:"note"}).txt(data.get("background")).up()
          .ele("data", {name: "人格的特徴", type:"note"}).txt(data.get("traits")).up()
          .ele("data", {name: "尊ぶもの", type:"note"}).txt(data.get("ideals")).up()
          .ele("data", {name: "関わり深いもの", type:"note"}).txt(data.get("bonds")).up()
          .ele("data", {name: "弱味", type:"note"}).txt(data.get("flows")).up()
          .ele("data", {name: "その他設定など", type:"note"}).txt(data.get("characterDesign")).up()
          .ele("data", {name: "その他の習熟と言語", type:"note"}).txt(data.get("etc")).up()
          .ele("data", {name: "特徴・特性", type:"note"}).txt(data.get("feats")).up()
          .up()
        .ele("data", {name: "呪文"})
          //呪文
          Object.keys(data.get("spells")).forEach(lvl=>{
            const spells = data.get("spells")[lvl];
            if(lvl == "lv0") {
              root.ele("data", {name: `初級呪文`})
            } else {
              root.ele("data", {name: `${lvl}呪文`})
              const slots = data.get("slots")[lvl]
              root.last().ele("data", {name: lvl ,type:"numberResource", currentValue:slots }).txt(slots)
            }
            spells.forEach((spell:string)=>{
              root.last().ele("data", {name:spell})
            })
            root.up()
          })
    root.up().up().up()
    .ele("chat-palette", {dicebot: "DungeonsAndDragons5"}).txt(chatpaletteText).up()
        
  return root.end({ prettyPrint: true });
}

//チャットパレット生成
function createChatPalette(data:Map<string, any>, simplePallete:boolean, rollcommand: string):string {

  const ATTACK_ROLL = rollcommand === "default" ? "1d20" : "AT"
  const CHECK_ROLL  = rollcommand === "default" ? "1d20" : "AR"

  let p:string[] = []
  p.push(`◆チャットパレット ${data.get("name")}(PL:${data.get("playername")})`)
  p.push(`▼ レベル ${data.get("level")} ${data.get("classes")} / ${data.get("race")} / ${data.get("sex")} / ${data.get("attribute")}`)
  p.push(`▼ 習熟ボーナス：${data.get("pb")}`)
  p.push(`${CHECK_ROLL}${modifierValue(data.get("initiative"))} イニシアチブ`)
  p.push(`⚔️ ===攻撃===`)
  p = p.concat(data.get("attack").reduce((ary:string[], el:attackType)=>{
    ary.push(`${ATTACK_ROLL}${modifierValue(el.bonus)} ${el.name}の攻撃ロール`);
    ary.push(`${el.damage} ${el.damageType?"["+el.damageType+"]":""} ${el.name}のダメージ ${el.note?"("+el.note+")":""}`)
    return ary
  },[]))
  p.push(`💪 ===能力値判定===`)
  p = p.concat([["str","筋力"],["dex","敏捷力"],["con","耐久力"],["int","知力"],["wis","判断力"],["cha","魅力"],].map(k=>{
    const [key,label] = k
    const mod = simplePallete ? modifierValue(data.get("abilityBonus")[key]) : `{${label}修正}`
    return `${CHECK_ROLL}${mod} 【${label}】能力値判定`
  }))
  p.push(`🛡️ ===セーヴィングスロー===`)
  p = p.concat([["str","筋力"],["dex","敏捷力"],["con","耐久力"],["int","知力"],["wis","判断力"],["cha","魅力"],].map(k=>{
    const [key,label] = k
    const mod = simplePallete ? modifierValue(data.get("save")[key]) : `{${label}セーヴ}`
    return `${CHECK_ROLL}${mod} 【${label}】セーヴィングスロー`
  }))
  p.push(`🎲 ===技能===`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").INTIMIDATION):"{〈威圧〉}"} ▼〈威圧〉 【魅】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").MEDICINE):"{〈医術〉}"} ▼〈医術〉 【判】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").ATHLETICS):"{〈運動〉}"} ▼〈運動〉 【筋】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").STEALTH):"{〈隠密〉}"} ▼〈隠密〉 【敏】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").ACROBATICS):"{〈軽業〉}"} ▼〈軽業〉 【敏】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").INSIGHT):"{〈看破〉}"} ▼〈看破〉 【判】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").PERFORMANCE):"{〈芸能〉}"} ▼〈芸能〉 【魅】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").NATURE):"{〈自然〉}"} ▼〈自然〉 【知】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").RELIGION):"{〈宗教〉}"} ▼〈宗教〉 【知】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").SURVIVAL):"{〈生存〉}"} ▼〈生存〉 【判】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").PERSUASION):"{〈説得〉}"} ▼〈説得〉 【魅】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").INVESTIGATION):"{〈捜査〉}"} ▼〈捜査〉 【知】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").PERCEPTION):"{〈知覚〉}"} ▼〈知覚〉 【判】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").SLEIGHTOFHAND):"{〈手先の早業〉}"} ▼〈手先の早業〉 【敏】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").ANIMALHANDLING):"{〈動物使い〉}"} ▼〈動物使い〉 【判】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").DECEPTION):"{〈ペテン〉}"} ▼〈ペテン〉 【魅】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").ARCANA):"{〈魔法学〉}"} ▼〈魔法学〉 【知】技能判定`)
  p.push(`${CHECK_ROLL}${simplePallete?modifierValue(data.get("skill").HISTORY):"{〈歴史〉}"} ▼〈歴史〉 【知】技能判定`)
  p.push(`🌱 ===その他の能力===`)
  p.push(``)
  const spellsHeader = [];
  spellsHeader.push(`🪄 ===呪文===`)
  spellsHeader.push(`呪文セーヴ難易度：${data.get("spellSave")}`)
  spellsHeader.push(`${ATTACK_ROLL}${modifierValue(data.get("spellAttack"))} 呪文攻撃ロール`)
  spellsHeader.push(`📖 ===呪文リスト===`)
  const spellEmoji:{[key: string]: string} = {"lv0":"0⃣","lv1":"1⃣","lv2":"2⃣","lv3":"3⃣","lv4":"4⃣","lv5":"5⃣","lv6":"6⃣","lv7":"7⃣","lv8":"8⃣","lv9":"9⃣"}
  const spells = Object.keys(data.get("spells")).reduce((spl:string[],lvl)=>{
    const curSpells = data.get("spells")[lvl];
    if(curSpells && curSpells.length) {
      spl.push(`${spellEmoji[lvl]} ===${lvl=='lv0'?'初級':lvl}呪文===`)
      spl = spl.concat(curSpells.map((e:string)=>e.replace(/\n/g, " ")))
    }
    return spl;
  },[])
  //呪文情報がないならチャパレに出力しない
  if(spells.length) {
    p = p.concat(spellsHeader)
    p = p.concat(spells)
  }
  return p.join('\n')
}

function modifierValue(val:string) {
  const num = Number(val);
  if(isNaN(num)) return val;
  if(num === 0) return "+0";
  if(num < 0 ) return String(num);
  return "+" + String(num);
}