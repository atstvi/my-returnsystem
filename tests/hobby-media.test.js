'use strict';
/* 취미 항목 사진(파일·Ctrl/Cmd+V)·링크 — 기다리는 동안 기대할 수 있게 달력·상세·카드에서 바로 보기/열기. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('취미 사진·링크');

const block = sliceBlock(html, 'function hobNormUrl(u){', '\nfunction hobImgTag(ref, cls){');
const ctx = { String, URL, Array }; vm.createContext(ctx); vm.runInContext(block, ctx);
t.ok('주소 정규화: 스킴 없으면 https', ctx.hobNormUrl('ticketlink.co.kr/jazz') === 'https://ticketlink.co.kr/jazz');
t.ok('http(s)만 허용(javascript: 등 거절)', ctx.hobNormUrl('javascript:alert(1)') === '' && ctx.hobNormUrl('ftp://a.com') === '');
t.ok('도메인 없는 글자는 링크 아님', ctx.hobNormUrl('그냥 메모') === '' && ctx.hobNormUrl('') === '');
t.ok('호스트 표시(www 제거)', ctx.hobLinkHost('https://www.youtube.com/watch?v=1') === 'youtube.com');
t.ok('항목 사진/링크 읽기(빈 값 거름)', ctx.hobItemImgs({ imgs:['a','',null] }).length === 1 && ctx.hobItemLinks({ links:[{url:'x'},{}] }).length === 1);

t.ok('항목 창: 사진(＋/붙여넣기)·링크 칸', /id="ii-add-photo"/.test(html) && /id="ii-link-inp"/.test(html) && /Ctrl\/Cmd\+V로 붙여넣기도 돼요/.test(html));
t.ok('항목 창이 열려 있으면 사진 붙여넣기를 먼저 가로챔(인박스로 이동 X)', /var m=document\.getElementById\('itemModal'\); if\(!m\|\|!m\.classList\.contains\('open'\)\)return;/.test(html) && /\}, true\);\n\}\)\(\);/.test(html));
t.ok('사진은 압축 후 MediaStore 참조로', /MediaStore\.put\(dataUrl,\{role:'hobby',type:file\.type\}\)/.test(html));
t.ok('저장: 사진·링크 반영(링크 칸에 적어만 둔 것도)', /hobAddLinkFromInput\(true\);/.test(html) && /_applyMedia\(it\);/.test(html) && /_applyMedia\(newIt\);/.test(html));
t.ok('반복 회차도 같은 사진·링크', /_ri\.imgs=baseIt\.imgs\.slice\(\);/.test(html) && /_ri\.links=baseIt\.links\.map/.test(html));
t.ok('달력 칸: 사진 썸네일 + 🔗 바로가기', /var _md=hobMediaBadges\(dayItems,\{cls:'in-cell'\}\);/.test(html) && /hobOpenLink\(link\.url\)/.test(html));
t.ok('풀뷰 칩·상세·카테고리 카드에도 표시', /hob-chip-img/.test(html) && /class="hob-item-media"|mrow\.className='hob-item-media'/.test(html) && /cat-next-thumb/.test(html));
t.ok('링크는 새 창(noopener)', /window\.open\(u,'_blank','noopener'\)/.test(html));
t.done();
