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
  var payload='cultify-session:v1\\n'+[document.cookie].concat(extras).filter(Boolean).join('; ');
  function copied(){ alert('Cultify session copied. Reuse this saved bookmark after future logins. In Termux run: bash termux/paste-session.sh'); }
  if(navigator.share){
    navigator.share({title:'cultify-session', text:payload}).catch(function(){
      if(navigator.clipboard) navigator.clipboard.writeText(payload).then(copied);
      else prompt('Copy Cultify session', payload);
    });
  } else if(navigator.clipboard){
    navigator.clipboard.writeText(payload).then(copied);
  } else {
    prompt('Copy Cultify session', payload);
  }
})();`;

process.stdout.write(bookmarklet.replace(/\s+/g, ' ').trim() + '\n');
