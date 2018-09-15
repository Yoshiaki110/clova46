var config = require('./config.js');

var net = require('net');
var HOST = config.HOST;        // 独自プロトコルのサーバ
var SPORT = config.SPORT;      // 独自プロトコルのポート
var APPLICATION_ID = config.APPLICATION_ID;
var id = 6;
var kind = 'さんごー缶';
var tipIndex = 0;
var tipTime = new Date().getTime();

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
const TEMPLATE_INQUIRY = '「いっぱいめをお酌して」のように呼びかけて下さい。';
var count = 0;

const clovaSkillHandler = clova.Client
  .configureSkill()
  // スキルの起動リクエスト
  .onLaunchRequest(responseHelper => {
    console.log(`onLaunchRequest`);
    TimeoutMessage(responseHelper);
    responseHelper.setSimpleSpeech({
      lang: 'ja',
      type: 'PlainText',
      value: `こんにちは、私は「遠隔お酌」です。一緒に楽しい時間を過ごしましょうね。${TEMPLATE_INQUIRY}`,
    });
    count = 0;
  })
  // カスタムインテント or ビルトインインテント
  .onIntentRequest(responseHelper => {
    console.log(`onIntentRequest`);
    TimeoutMessage(responseHelper);
    const intent = responseHelper.getIntentName();
//    let speech;
    switch (intent) {
      // ユーザーのインプットが星座だと判別された場合。
      case 'SetIdIntent':
        SetIdIntent(responseHelper);
        break;
      case 'GetIdIntent':
        GetIdIntent(responseHelper);
        break;
      case 'SetBottleIntent':
        SetBottleIntent(responseHelper);
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
    setTimeout(move0, 1);
    setTimeout(move0, 1000);   // 念のため
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

function TimeoutMessage(responseHelper) {
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `もう一杯どうですか？。${TEMPLATE_INQUIRY}`
  };
  responseHelper.setSimpleSpeech(speech, true);
}

function FortuneIntent(responseHelper) {
  console.log(`FortuneIntent`);
  // 星座を取得
  const slots = responseHelper.getSlots();
  // スロット名を間違って付けてしまった場合
  if (!('zodiac_signs' in slots)) {
    var speech = {
      lang: 'ja',
      type: 'PlainText',
      value: `想定しないスロット名です。カスタムスロットの名前が正しいかご確認ください。`
    };
    responseHelper.setSimpleSpeech(speech);
    return;
  }
  // Slotに登録されていない星座はnullになる
  if(slots.zodiac_signs == null) {
    var speech = {
      lang: 'ja',
      type: 'PlainText',
      value: `星座に誤りがあります。他の星座でお試し下さい。`
    };
    responseHelper.setSimpleSpeech(speech);
    // 第2引数にtrueを設定するとreprompt(入力が行われなかった場合の聞き返し)の文を定義できる
    responseHelper.setSimpleSpeech(speech, true);
    // 下記でも可
    /*
    responseHelper.setSimpleSpeech(
      clova.SpeechBuilder.createSpeechText(`星座に誤りがあります。他の星座でお試し下さい。`)
    );
    */
    return;
  }
  // 「中吉」だと「なかよし」発生されてしまう
  const fortune = ['大吉', 'ちゅうきち', '小吉', '吉', '凶']
  const zodiacSigns = ['牡羊座', '牡牛座', '双子座', '蟹座', '獅子座', '乙女座', '天秤座', '蠍座', '射手座', '山羊座', '水瓶座', '魚座']
  // 日と星座を元に運勢を決定。日が変わると違う運勢に。
  const fortuneToday = fortune[(new Date().getDate() + zodiacSigns.indexOf(slots.zodiac_signs)) % fortune.length]

  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `${slots.zodiac_signs}の今日の運勢は${fortuneToday}です。${TEMPLATE_INQUIRY}`
  };
  responseHelper.setSimpleSpeech(speech);
}  

function GuideIntent(responseHelper) {
  console.log(`GuideIntent`);
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: TEMPLATE_INQUIRY
  };
  responseHelper.setSimpleSpeech(speech);
}

function NotsupportIntent(responseHelper) {
  console.log(`NotsupportIntent`);
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `意図しない入力です。${TEMPLATE_INQUIRY}`
  };
  responseHelper.setSimpleSpeech(speech);
}

function InvalidIntent(responseHelper) {
  console.log(`InvalidIntent`);
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `想定しないインテントです。カスタムインテントの名前が正しいかご確認ください。`
  };
  responseHelper.setSimpleSpeech(speech);
}

function SetIdIntent(responseHelper) {
  console.log(`SetIdIntent`);
  const slots = responseHelper.getSlots()
  console.log(slots);
  var msg = 'IDがわかりません、「IDに3​をセットして」のように呼びかけて下さい。';
  if ('id' in slots && slots.id != null) {
    id = slots.id;
    msg = `IDを${id}に、設定しました。`
  }
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: msg
  };
  responseHelper.setSimpleSpeech(speech);
}

function GetIdIntent(responseHelper) {
  console.log(`GetIdIntent`);
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `IDは、${id}です。`
  };
  responseHelper.setSimpleSpeech(speech);
}

function SetBottleIntent(responseHelper) {
  console.log(`SetBottleIntent`);
  const slots = responseHelper.getSlots()
  console.log(slots);
  var msg = 'わかりませんでした、「さんごー缶をセット」のように呼びかけて下さい。';
  if ('kind' in slots && slots.kind != null) {
    if (slots.kind == 'ビール') {
      msg = `ビールの種類は何ですか？「さんごう缶」あるいは「ロング缶」あるいは「瓶ビール」と呼びかけて下さい。`
    } else {
      count = 0;
      kind = slots.kind;
      msg = `お酌するのは、${kind}です。`
    }
  }
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: msg
  };
  responseHelper.setSimpleSpeech(speech);
}

const cntMsgs = ['いっぱいめ', 'にはいめ', 'さんばいめ', 'よんはいめ', 'ごはいめ', 'ろっぱいめ', 'ななはいめ', 'はっぱいめ', 'きゅうはいめ', 'じゅっぱいめ']
function PourIntent(responseHelper) {
  console.log(`PourIntent`);
  const slots = responseHelper.getSlots();
  console.log(slots);
  if ('count' in slots && slots.count != null) {
    count = cntMsgs.indexOf(slots.count);
  } else if('number' in slots && slots.number != null) {
    count = slots.number - 1;
  } else {
    count = count > 9 ? 9 : count;    
  }
  var tipMsg = tip();
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `${tipMsg}　${kind}、${cntMsgs[count]}を、おしゃくします。`
  };
  responseHelper.setSimpleSpeech(speech);
  setTimeout(move, 500, count);   // 0.5秒後にお酌
  ++count;
}

function StopIntent(responseHelper) {
  send(id, 0);
  console.log(`StopIntent`);
  var speech = {
    lang: 'ja',
    type: 'PlainText',
    value: `おしゃくを中止します。`
  };
  responseHelper.setSimpleSpeech(speech);
}

const angle = [  11,  22,  33,  44,  55,  56,  57,  58,  58,  50];
const wait  = [1000,1000,1000,1000,2000,2000,2000,3000,3000,3009];
function move(index) {
  console.log(`move`);
  send(id, angle[index]);
  setTimeout(move0, wait[index]);
}

function move0() {
  console.log(`move0`);
  send(id, 0);
}

function tip() {
  var now = new Date().getTime();
  var duration = now - tipTime;
  tipTime = now;
  if (duration < 10000) {
    return 'ピッチが早いね！！';
  }
  const msgs = [
    '私は、２０１８年5月に養老乃瀧ハッカソンで産まれました。',
    'お酒は百薬の長と呼ばれますが、飲み過ぎには気をつけてね！',
    '飲んだら乗るな、乗るなら飲むな。',
    '私は、小型コンピューター「ラズベリーパイ」で動いています。',
    'お酒は、二十歳から！',
    'ビールを一番飲むのは、チェコの人なんだって！',
    '飲んでも飲まれるな、飲みすぎに注意だよ！',
    'ビールの王冠のギザギザの数は21個なんだよ！',
    '遠隔お酌はインターネットを使っているので海外の人からお酌してもらう事もできるよ！',
    '缶酎ハイは1983年生まれ、東京ディズニーランドと一緒だよ！',
  ];
  tipIndex = tipIndex >= (msgs.length -1) ? 0 : ++tipIndex;
  var msg = msgs[tipIndex];
  return msg;
}