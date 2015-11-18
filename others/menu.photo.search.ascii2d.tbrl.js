// ==Taberareloo==
// {
//   "name"        : "Image Search with Ascii2D.net"
// , "description" : "Search similar images at ascii2d.net"
// , "include"     : ["background"]
// , "version"     : "1.0.2"
// , "downloadURL" : "https://raw.github.com/taberareloo/patches-for-taberareloo/master/others/menu.photo.search.ascii2d.tbrl.js"
// }
// ==/Taberareloo==

(function() {
  Menus._register({
    title    : 'Photo - Search - 二次元画像詳細検索',
    contexts : ['image'],
    onclick  : function(info, tab) {
      if ((info.mediaType !== 'image') || (!info.srcUrl)) return;

      chrome.tabs.create({
        url    : 'http://www.ascii2d.net/',
        active : false
      }, function(tab) {
        chrome.tabs.executeScript(tab.id, {
          code : 'u=document.getElementById("uri-form");u.value="'+info.srcUrl+'";u.form.submit();'
        });
      });
    }
  }, null, 'Photo - Capture', true);

  Menus.create();
})();
