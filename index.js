var config = require('./config.js');

var net = require('net');
var HOST = config.HOST;        // 独自プロトコルのサーバ
var SPORT = config.SPORT;      // 独自プロトコルのポート
var APPLICATION_ID = config.APPLICATION_ID;

global.sock = null;

function connect() {
  global.sock = new net.Socket();
  global.sock.setNoDelay();
  console.log('1 CONNECTED TO: ' + HOST + ':' + SPORT);
  global.sock.connect(SPORT, HOST, function() {
    console.log('2 CONNECTED TO: ' + HOST + ':' + SPORT);
  });

  global.sock.on('connect', function() {
    console.log('EVENT connect');
  });

  global.sock.on('data', function(data) {
    if (data.length >= 3) {    // ３バイト以上のデータのみ使用
      var p = -1;
      for (var i = data.length - 2; i--; ) {
        if (data[i] == 255) {
            p = i;
        }
      }
      if (p >= 0) {                      // 正しいデータあり
       console.log('  receive id:' + data[p+1] + ' val:' + data[p+2] + ' len:' + data.length);
      } else {
        console.log('receive not found separater. data len:' + data.length);
      }
    } else {
        console.log('receive illegal data len:' + data.length);
    }
  });

  global.sock.on('end', function() {
    console.log('EVENT end');
  });

  global.sock.on('timeout', function() {
    console.log('4 EVENT timeout');
  });

  global.sock.on('drain', function() {
    console.log('3 EVENT drain');
  });

  global.sock.on('error', function(error) {
    console.log('2 EVENT error:' + error);
    global.sock.destroy();
    global.sock = null;
  });

  global.sock.on('close', function(had_error) {
    console.log('1 EVENT close:' + had_error);
    global.sock = null;
  });
}

function send(id, data) {
  console.log('send:', id, data);
  if (null == global.sock) {
    connect();
  }
  //d = String.fromCharCode(rand);      // 1バイトの文字列（コード）にする
  var d = new Buffer(3);
  d[0] = 255;
  d[1] = id;
  d[2] = data;
  //console.log('send:' + d);
  global.sock.write(d);
}


const clova = require('@line/clova-cek-sdk-nodejs');
const express = require('express');
const bodyParser = require('body-parser');

// 応答の最後に追加するテンプレート
const TEMPLATE_INQUIRY = '「1杯目をお酌して」のように呼びかけて下さい。';

const clovaSkillHandler = clova.Client
  .configureSkill()
  // スキルの起動リクエスト
  .onLaunchRequest(responseHelper => {
    responseHelper.setSimpleSpeech({
      lang: 'ja',
      type: 'PlainText',
      value: `「遠隔お酌」が起動されました。${TEMPLATE_INQUIRY}`,
    });
  })
  // カスタムインテント or ビルトインインテント
  .onIntentRequest(responseHelper => {
    const intent = responseHelper.getIntentName();
    let speech;
    switch (intent) {
      // ユーザーのインプットが星座だと判別された場合。
      case 'SetId':
        SetId(responseHelper);
        break;
      case 'GetId':
        GetId(responseHelper);
        break;
      case 'PourIntent':
        PourIntent(responseHelper);
        break;
      case 'AbortIntent':
      case 'StopIntent':
        StopIntent(responseHelper);
        break;
      case 'FortuneIntent':
        FortuneIntent(responseHelper);
        break;
      // ビルトインインテント。ユーザーによるインプットが使い方のリクエストと判別された場合
      case 'Clova.GuideIntent':
        GuideIntent(responseHelper);
        break;
      // ビルトインインテント。ユーザーによるインプットが肯定/否定/キャンセルのみであった場合
      case 'Clova.YesIntent':
      case 'Clova.NoIntent':
      case 'Clova.CancelIntent':
        NotsupportIntent(responseHelper);
        break;
      default:
        InvalidIntent(responseHelper);
        break;
    }
  })
  // スキルの終了リクエスト
  .onSessionEndedRequest(responseHelper => {
    console.log(`onSessionEndedRequest`);
  })
  .handle();

const app = new express();
//TODO
// リクエストの検証を行う場合。環境変数APPLICATION_ID(値はClova Developer Center上で入力したExtension ID)が必須
const clovaMiddleware = clova.Middleware({
  applicationId: APPLICATION_ID
});
app.post('/clova', clovaMiddleware, clovaSkillHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on ${port}`);
});


function FortuneIntent(responseHelper) {
  console.log(`FortuneIntent`);
  // 星座を取得
  const slots = responseHelper.getSlots()
  // スロット名を間違って付けてしまった場合
  if (!('zodiac_signs' in slots)) {
    speech = {
      lang: 'ja',
      type: 'PlainText',
      value: `想定しないスロット名です。カスタムスロットの名前が正しいかご確認ください。`
    }
    responseHelper.setSimpleSpeech(speech)
    return
  }
  // Slotに登録されていない星座はnullになる
  if(slots.zodiac_signs == null) {
    speech = {
      lang: 'ja',
      type: 'PlainText',
      value: `星座に誤りがあります。他の星座でお試し下さい。`
    }
    responseHelper.setSimpleSpeech(speech)
    // 第2引数にtrueを設定するとreprompt(入力が行われなかった場合の聞き返し)の文を定義できる
    responseHelper.setSimpleSpeech(speech, true)
    // 下記でも可
    /*
    responseHelper.setSimpleSpeech(
      clova.SpeechBuilder.createSpeechText(`星座に誤りがあります。他の星座でお試し下さい。`)
    );
    */
    return
  }
  // 「中吉」だと「なかよし」発生されてしまう
  const fortune = ['大吉', 'ちゅうきち', '小吉', '吉', '凶']
  const zodiacSigns = ['牡羊座', '牡牛座', '双子座', '蟹座', '獅子座', '乙女座', '天秤座', '蠍座', '射手座', '山羊座', '水瓶座', '魚座']
  // 日と星座を元に運勢を決定。日が変わると違う運勢に。
  const fortuneToday = fortune[(new Date().getDate() + zodiacSigns.indexOf(slots.zodiac_signs)) % fortune.length]

  speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `${slots.zodiac_signs}の今日の運勢は${fortuneToday}です。${TEMPLATE_INQUIRY}`
  }
  responseHelper.setSimpleSpeech(speech)
  responseHelper.setSimpleSpeech(speech, true)
}  

function GuideIntent(responseHelper) {
  console.log(`GuideIntent`);
  speech = {
    lang: 'ja',
    type: 'PlainText',
    value: TEMPLATE_INQUIRY
  }
  responseHelper.setSimpleSpeech(speech)
  responseHelper.setSimpleSpeech(speech, true)
}

function NotsupportIntent(responseHelper) {
  console.log(`NotsupportIntent`);
  speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `意図しない入力です。${TEMPLATE_INQUIRY}`
  }
  responseHelper.setSimpleSpeech(speech)
}

function InvalidIntent(responseHelper) {
  console.log(`InvalidIntent`);
  speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `想定しないインテントです。カスタムインテントの名前が正しいかご確認ください。`
  }
  responseHelper.setSimpleSpeech(speech)
}

var id = 6;
function SetId(responseHelper) {
  console.log(`SetId`);
  const slots = responseHelper.getSlots()
  console.log(slots);
  var msg = 'IDがわかりません。';
  if ('id' in slots && slots.id != null) {
    id = slots.id;
    msg = `IDを${id}に、設定しました。`
  }
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `${cntMsgs[count]}を、おしゃくします。`
  }
  responseHelper.setSimpleSpeech(speech)
}

function GetId(responseHelper) {
  console.log(`GetId`);
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `IDは、${id}です。`
  }
  responseHelper.setSimpleSpeech(speech)
}

const cntMsgs = ['いっぱいめ', 'にはいめ', 'さんばいめ', 'よんはいめ', 'ごはいめ', 'ろっぱいめ', 'ななはいめ', 'はっぱいめ', 'きゅうはいめ', 'じゅっぱいめ']
var count = 0;
function PourIntent(responseHelper) {
  console.log(`PourIntent`);
  const slots = responseHelper.getSlots();
  console.log(slots);
  if ('count' in slots && slots.count != null) {
    count = cntMsgs.indexOf(slots.count);
  } else if('number' in slots && slots.number != null) {
    count = slots.number - 1;
  } else {
    count = count > 10 ? 10 : count + 1;    
  }
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `${cntMsgs[count]}を、おしゃくします。`
  }
  responseHelper.setSimpleSpeech(speech);
  setTimeout(move, 500);
}

function StopIntent(responseHelper) {
  console.log(`StopIntent`);
  speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `おしゃくを中止します。`
  }
  responseHelper.setSimpleSpeech(speech);
}

const angle = [  10,  20,  30,  40,  50,  50,  50,  50,  50,  50];
const wait  = [1000,1000,1000,1000,1000,1000,1000,1000,1000,1009];
function move() {
  console.log(`move`);
  send(id, angle[count]);
  setTimeout(move0, wait[count]);
}
function move0() {
  console.log(`move0`);
  send(id, 0);
}
