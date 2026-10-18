"use strict";

// Generate once, save as a browser bookmark, then reuse after future logins.
const bookmarklet = `javascript:(function(){
  var keys=['at','st','janus_session','deviceId','userId','cityId'];
  var extras=[];
  function fromStore(store){
    if(!store) return;
    keys.forEach(function(k){
      try{
        var v=store.getItem(k);
        if(v) extras.push(k+'='+v);
      }catch(e){}
    });
  }
  try{ fromStore(localStorage); }catch(e){}
  try{ fromStore(sessionStorage); }catch(e){}
  var cookies=[document.cookie].concat(extras).filter(Boolean).join('; ');
  if(!/(?:^|;\\s*)at=[^;]+/.test(cookies) || !/(?:^|;\\s*)st=[^;]+/.test(cookies)){
    alert('Cultify did not expose the required at/st login cookies to this bookmarklet (they may be HttpOnly). No session was copied. Use a current Cult.fit cURL/Cookie header with bash termux/paste-session.sh, or configure CURL_COMMAND in .env.');
    return;
  }
  var payload='cultify-session:v1\\n'+cookies;
  function copyToClipboard(){
    if(!navigator.clipboard || !navigator.clipboard.writeText){
      prompt('Copy Cultify session, then run bash termux/paste-session.sh in Termux', payload);
      return;
    }
    navigator.clipboard.writeText(payload).then(function(){
      alert('Cultify session copied. In Termux run: bash termux/paste-session.sh');
    }).catch(function(){
      prompt('Copy Cultify session, then run bash termux/paste-session.sh in Termux', payload);
    });
  }
  if(/Firefox/i.test(navigator.userAgent)){
    copyToClipboard();
  } else if(navigator.share){
    navigator.share({title:'cultify-session', text:payload}).catch(copyToClipboard);
  } else {
    copyToClipboard();
  }
})();`;

process.stdout.write(bookmarklet.replace(/\s+/g, ' ').trim() + '\n');
