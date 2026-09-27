import type {Position} from './movement.ts';
import type {StageId} from './stage-profile.ts';
export type Note={id:string;title:string;author:string;body:string};
export type StageLore={prologue:readonly string[];notes:readonly Note[]};
/** Each stage opens with a short prologue and hides three documents. The
 * researcher and the lost girl recur across stages; several documents also
 * carry practical advice, as field notes do in classic survival horror. */
export const LORE:Record<StageId,StageLore>={
 shrine:{prologue:['目を覚ますと、灯りの残る回廊にいた。','手の中には一本の懐中電灯。遠くで、誰かが襖を閉める音がする。','勾玉を集め、祭壇に捧げよ。帰り道は、封門の向こうにしかない。'],notes:[
  {id:'shrine-1',title:'宮司の覚え書き',author:'宮司・朽木',body:'勾玉は、この境に迷い込んだ者たちの魂の欠片である。青は祈り、赤は未練、金は約束。欠片が揃えば、憎悪か憤怒が目を覚ます。あれは灯りを消しても見逃さぬ。祭壇へ捧げ、封門をくぐるまで、決して足を止めるな。'},
  {id:'shrine-2',title:'ひよりの日記　一',author:'ひより',body:'おまつりの帰り道、ちょうちんの列についていったら、しらない廊下に出ました。お母さんをよんでも、ふすまのむこうの人たちは返事をしてくれません。あの人たちには、顔がないのです。金色の大きな勾玉は、いちばんこわい横丁の奥で光っていました。'},
  {id:'shrine-3',title:'民俗調査記録　一',author:'調査員・真壁',body:'七年で十一件の失踪。最後の目撃地点は、いずれもこの社の鳥居前だ。土地の者は「幽境に呼ばれた」と言う。私は信じない。だが昨夜から、回廊の奥で誰かが私の名前を書いている気がしてならない。'},
 ]},
 abyss:{prologue:['石段を下りきった先に、地上はなかった。','滴る水の音だけが、ここで時を刻んでいる。','影の捜索は長く、しつこい。見つかる前に、闇へ紛れろ。'],notes:[
  {id:'abyss-1',title:'坑夫の書き置き',author:'名もなき坑夫',body:'掘っても掘っても底に当たらねえ。昨日掘った横穴の先に、見覚えのある横丁が埋まってた。俺の生まれた町だ。鏡を拾ったら覗いてみな、壁の向こうの奴らが映る。それと、灯りはつけるな。あいつらは火に寄る蛾みてえに集まってくる。'},
  {id:'abyss-2',title:'ひよりの日記　二',author:'ひより',body:'くらいところは、きらいです。でも、水の音をたどっていくと、大きな水そうに出られるとわかりました。赤い勾玉は、ないているみたいに、ほんのりあったかいです。'},
  {id:'abyss-3',title:'民俗調査記録　二',author:'調査員・真壁',body:'地下水槽の壁に無数の爪痕。数えるのはやめた。記録する理由を忘れないうちに書いておく。彼らは走る足音を追ってくる。歩け。どれほど恐ろしくても、歩くのだ。'},
 ]},
 outer:{prologue:['月が、見たことのない大きさで昇っていた。','草に埋もれたあぜ道の先に、終電の去った駅が見える。','視界は広い。それは、向こうからもこちらが見えるということだ。'],notes:[
  {id:'outer-1',title:'駅務日誌',author:'駅員・畑中',body:'本日も終電後の改札を通る者あり。切符の日付は昭和。行き先の欄は空白。声をかけると、あぜ道の向こうで立ち止まり、こちらを振り返った。顔はなかった。記録のみ残す。'},
  {id:'outer-2',title:'ひよりの日記　三',author:'ひより',body:'学校の教室に、わたしの名前が書いてある机がありました。わたしはこの学校にかよったことがありません。でも、机の中には、わたしのえんぴつが入っていました。'},
  {id:'outer-3',title:'民俗調査記録　三',author:'調査員・真壁',body:'外縁は、人々が忘れた風景の吹き溜まりだ。駅も学校も郵便局も、誰かの記憶から剥がれ落ちて、ここへ流れ着く。ならば私も、誰かに忘れられた時、この景色の一部になるのだろうか。'},
 ]},
 orchestra:{prologue:['最後の和音が鳴りやまないまま、百年が過ぎたという。','黙したオルガン、深紅の幕、石の尖塔。','ここの闇は深い。わずかな灯りを頼りに進め。'],notes:[
  {id:'orchestra-1',title:'第二楽団の演奏記録',author:'指揮者・エルンスト',body:'終楽章の最後の小節を、我々はまだ弾き終えていない。客席は満員だが、誰ひとり息をしていない。弓を止めれば、彼らは立ち上がるだろう。だから、我々は弾き続ける。'},
  {id:'orchestra-2',title:'調律師の手帳',author:'調律師',body:'オルガンのパイプの一本が、人の声で鳴る。低いレの音だ。調律しようと手を伸ばすと、その声は私の名を呼んだ。以来、あのパイプには触れていない。'},
  {id:'orchestra-3',title:'民俗調査記録　四',author:'調査員・真壁',body:'この境に和洋の区別はない。忘れられた場所であれば、海の向こうの聖堂さえ流れ着く。勾玉を捧げるたび、どこかで鐘が鳴る。帰れなかった者の数だけ、鐘は鳴るのだという。'},
 ]},
 circus:{prologue:['最後の公演の幕が、まだ下りていない。','古びた大天幕と、四つの駅を巡るトロッコ。','仕掛けを操り、誘導灯で追手を惑わせながら進め。'],notes:[
  {id:'circus-1',title:'座長の口上書き',author:'座長',body:'さあさあ、お立ち会い。今宵の演目は『帰れぬ客人』。拍手はご無用、足音もご無用。身をかがめたお客様は、暗がりに紛れて見えにくうございます。音を立てたお客様には、舞台へ上がっていただきます。'},
  {id:'circus-2',title:'道化の走り書き',author:'道化・ミツ',body:'回る壁の裏は、あいつらにも見えない。跳ね橋を上げれば道は切れる。誘導灯を灯せば、あいつらはそっちへ向かう。オレはそうやって三晩逃げた。四晩目のことは、書かないでおく。'},
  {id:'circus-3',title:'ひよりの日記　四',author:'ひより',body:'サーカスのトロッコにのりました。ひとりでのるのはこわかったけど、ピエロさんが手をふってくれました。ピエロさんの手は、とてもつめたかったです。'},
 ]},
 error:{prologue:['面の裏には、誰もいない。','繰り返す能舞台で、終わらない演目が続いている。','灯りを追う「逆面」と、足音を追う「哭面」。消灯と静かな歩みが鍵だ。'],notes:[
  {id:'error-1',title:'能楽師の稽古帳',author:'能楽師',body:'逆面は光を見る。哭面は音を聴く。二つの面を同時に欺くには、闇の中を、息を殺して歩むほかない。我らはこの舞台で三百回、同じ曲を舞った。三百一回目、面が顔から外れなくなった。'},
  {id:'error-2',title:'番組表の裏書き',author:'不明',body:'演目　■■■■　シテ　あなた　ワキ　あなた　地謡　あなたを覚えている者すべて　――本番組は終演いたしません。'},
  {id:'error-3',title:'民俗調査記録　五',author:'調査員・真壁',body:'文字が崩れはじめた。私の記録なのに、私の筆跡ではない。鏡の間で自分を映すと、面をつけた私が、面をつけていない私を見ていた。どちらが本物なのか、もうわからない。'},
 ]},
 parallel:{prologue:['現実の継ぎ目から、街がこぼれ落ちている。','宙に浮く渡り場、誰も帰らない家、空中庭園。','空間を渡る異形がいる。光と遮蔽物で切り返せ。'],notes:[
  {id:'parallel-1',title:'第七棟管理日誌',author:'第七棟管理人',body:'本日、第七棟三階の廊下が地下駅のホームに接続されていることを確認。昨日はプールだった。住人からの苦情はない。住人は、もういないからだ。'},
  {id:'parallel-2',title:'継ぎ目についての考察',author:'調査員・真壁',body:'異形は空間の継ぎ目を渡る。見失ったと思った瞬間、すぐ背後に現れる。だが渡る直前、必ず一瞬だけ動きを止める。その隙に光を浴びせれば、奴は九秒のあいだ継ぎ目に縫い止められる。'},
  {id:'parallel-3',title:'ひよりの日記　五',author:'ひより',body:'空にうかぶお庭で、ブランコにのっている女の人にあいました。お母さんに、にていました。よんだら、ふりむかないまま、きえてしまいました。'},
 ]},
 mountain:{prologue:['霧が、山肌を這い上がってくる。','稜線に沿う軌道と、途絶えた鉱山鉄道。','トロッコは速い。だが、降りた先に何が待つかはわからない。'],notes:[
  {id:'mountain-1',title:'登山日誌',author:'登山者・志村',body:'三日目。霧で尾根が見えない。地図にない線路をたどると、廃坑の入口に出た。中から仲間の声がする。だが仲間は、二日前に下山したはずだ。'},
  {id:'mountain-2',title:'鉱山鉄道運行表',author:'運行係',body:'本線最終便の運行を停止する。ただし乗客がある場合はこの限りでない。乗客の有無は問わない。乗客の生死も問わない。'},
  {id:'mountain-3',title:'民俗調査記録　六',author:'調査員・真壁',body:'山頂の観測所から、境のすべてが見えた。回廊、深淵、外縁、聖堂、天幕、能舞台、継ぎ目の街、雨のホテル。それらは一本の糸で縫い合わされ、糸の端は最初の社の祭壇に結ばれている。'},
 ]},
 ultrareal:{prologue:['チェックアウトの時刻は、とうに過ぎている。','雨に閉ざされた大型ホテル。三つの階を結ぶエレベーター。','宿泊客は人のように歩き、人のように、こちらを見る。'],notes:[
  {id:'ultrareal-1',title:'フロント引継ぎ帳',author:'夜勤フロント係',body:'ご宿泊のお客様より、廊下の突き当たりに見知らぬ方が立っているとのお申し出。確認いたしましたが、該当するお客様はおりませんでした。なお、確認に向かった係員が戻っておりません。引き続きご注意ください。'},
  {id:'ultrareal-2',title:'402号室の手紙',author:'宿泊客',body:'妻へ。このホテルからは出られない。窓の外はずっと雨で、非常口の先は同じ廊下につながっている。エレベーターだけが正しい階へ行く。だから私は、ボタンを押すたびに祈っている。'},
  {id:'ultrareal-3',title:'民俗調査記録　終',author:'調査員・真壁',body:'ひよりという少女の日記を、私は各地で拾い集めた。彼女はまだどこかで出口を探している。これを読む君へ。勾玉を捧げ、封門をくぐれ。そして忘れないでくれ。忘れられた者が、ここへ流れ着くのだから。'},
 ]},
};
export const ARCHIVE_KEY='yukyo-archive-v1';
const NOTE_IDS=new Set(Object.values(LORE).flatMap(l=>l.notes.map(n=>n.id)));
/** Found documents persist between visits; unknown or repeated ids are dropped. */
export function sanitizeArchive(raw:unknown):string[]{return Array.isArray(raw)?[...new Set(raw.filter((id):id is string=>typeof id==='string'&&NOTE_IDS.has(id)))]:[];}
export const noteById=(id:string)=>Object.values(LORE).flatMap(l=>l.notes).find(n=>n.id===id);
type Site={point:Position;floor:number};
type Keepout={position:Position;floor:number;radius:number};
/** Spread documents over reachable patrol points, clear of the spawn, the
 * altar and other pickups: two on the ground floor and the rest upstairs.
 * Any site at least `spacing` from earlier documents is equally likely, so
 * documents do not gather in the far corners. The caller supplies an
 * independent seeded stream so that existing magatama, mirror and finale
 * choices for a seed remain unchanged. */
export function placeNotes(sites:readonly Site[],keepout:readonly Keepout[],random:()=>number,count:number,groundCount=2,spacing=48):Site[]{
 const open=sites.filter(s=>keepout.every(k=>Math.abs(k.floor-s.floor)>.3||Math.hypot(k.position.x-s.point.x,k.position.z-s.point.z)>=k.radius));
 const chosen:Site[]=[];
 const spread=(s:Site)=>chosen.length?Math.min(...chosen.map(c=>Math.hypot(c.point.x-s.point.x,c.point.z-s.point.z)+Math.abs(c.floor-s.floor)*6)):Infinity;
 const pick=(pool:Site[])=>{
  const left=pool.filter(s=>!chosen.includes(s));if(!left.length)return false;
  const apart=left.filter(s=>spread(s)>=spacing),choices=apart.length?apart:[left.reduce((a,b)=>spread(b)>spread(a)?b:a)];
  chosen.push(choices[Math.min(choices.length-1,Math.floor(random()*choices.length))]);return true;
 };
 const ground=open.filter(s=>s.floor<.3),upper=open.filter(s=>s.floor>=.3);
 for(let i=0;i<Math.min(groundCount,count);i++)if(!pick(ground))break;
 while(chosen.length<count&&pick(upper.length?upper:open));
 while(chosen.length<count&&pick(open));
 return chosen.map(s=>({point:{...s.point},floor:s.floor}));
}
