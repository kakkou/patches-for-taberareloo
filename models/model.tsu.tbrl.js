// ==Taberareloo==
// {
//   "name"        : "tsū Model"
// , "description" : "Post to tsu.co"
// , "include"     : ["background", "content"]
// , "match"       : ["*://www.tsu.co/*"]
// , "version"     : "0.7.0"
// , "downloadURL" : "https://raw.github.com/taberareloo/patches-for-taberareloo/master/models/model.tsu.tbrl.js"
// }
// ==/Taberareloo==

(function() {
  if (inContext('background')) {
    Models.register({
      name      : 'tsū',
      ICON      : 'https://tsu-production-app.s3.amazonaws.com/assets/favicon-8a200fdedff0c42cc21c9c50be34f13a.ico',
      LINK      : 'https://www.tsu.co/',
      LOGIN_URL : 'https://www.tsu.co/users/sign_in',

      HOME_URL : 'https://www.tsu.co/',
      POST_URL : 'https://www.tsu.co/api/v1/posts/create',
      META_URL : 'https://www.tsu.co/posts/parse_url',

      check : function (ps) {
        return (/(regular|photo|quote|link|video)/).test(ps.type);
      },

      getToken : function () {
        var self = this;
        return request(this.HOME_URL, {
          responseType: 'document'
        }).then(function (res) {
          var doc = res.response;
          var notLoggedin = $X('id("sign-in")', doc)[0];
          if (notLoggedin) {
            throw new Error(chrome.i18n.getMessage('error_notLoggedin', self.name));
          }
          return $X('//meta[@name="csrf-token"]/@content', doc)[0];
        });
      },

      favor : function (ps) {
        var self = this;
        return this.getToken().then(function (token) {
          return request(ps.favorite.share, {
            method       : 'PATCH',
            responseType : 'json',
            headers      : {
              'X-CSRF-Token'     : token,
              'X-Requested-With' : 'XMLHttpRequest'
            }
          }).then(function (res) {
            if (res.response.error) {
              throw new Error(res.response.message);
            }
          });
        });
      },

      post : function (ps) {
        var self = this;
        return this.getToken().then(function (token) {
          if (ps.type === 'video') {
            return self.getMetadata(ps.pageUrl, token).then(function (metadata) {
              return self.update(ps, token, metadata);
            });
          }
          else {
            return self.update(ps, token);
          }
        });
      },

      decodeHTMLEntities : function (str) {
        var div = $N('div');
        div.innerHTML = str;
        return div.innerText;
      },

      update : function (ps, token, metadata) {
        var body = ps.body || '';
        if (body) {
          body = body.replace(/\r\n/g, "\n");
          body = body.replace(/\n<br(\s*\/)?>/ig, "\n");
          body = body.replace(/<br(\s*\/)?>\n/ig, "\n");
          body = body.replace(/<br(\s*\/)?>/ig, "\n");
          body = body.trimTag().trim();
          body = this.decodeHTMLEntities(body);
        }

        var description = (ps.description || '').trim();
        if (ps.tags && ps.tags.length) {
          var tags = ps.tags.map(function (tag) {
            return '#' + tag;
          }).join(' ');
          description = joinText([description, tags], "\n\n");
        }

        var data = {
          utf8               : '✓',
          authenticity_token : token,
          title              : (ps.type === 'regular') ? ps.item : '',
          text               : description || '\u200B',
          has_link           : (ps.type !== 'regular' && ps.pageUrl) ? 'true' : 'false',
          link               : ps.pageUrl,
          link_title         : ps.page,
          link_description   : body,
          link_image_path    : (ps.type === 'photo' && !ps.file) ? ps.itemUrl : '',
          provider_domain    : '',
          picture            : ps.file,
          edit_picture_url   : '',
          privacy            : ps.private ? 1 : 0
        };

        if (metadata) {
          data.link_description = body || metadata.description;
          data.link_image_path  = metadata.pictures[0] && metadata.pictures[0].link_image_path;
        }

        return request(this.POST_URL, {
          multipart   : true,
          sendContent : data,
          headers     : {
            'X-CSRF-Token'     : token,
            'X-Requested-With' : 'XMLHttpRequest'
          }
        }).then(function (res) {
          var text = res.responseText;
          var m = text.match(/if\(true\)\{\s+var evac_error_message = "(.*)";/)
          if (m) {
            throw new Error(m[1]);
          }
        });
      },

      getMetadata : function (url, token) {
        return request(this.META_URL + '?' + queryString({
          url : url
        }), {
          responseType : 'json',
          headers      : {
            'X-CSRF-Token'     : token,
            'X-Requested-With' : 'XMLHttpRequest'
          }
        }).then(function (res) {
          return res.response;
        });
      }
    });
    return;
  }

  if (inContext('content')) {
    TBRL.setRequestHandler('contextMenus', function (req, sender, func) {
      func({});
      var content = req.content;
      var ctx = {};
      switch (content.mediaType) {
      case 'video':
        ctx.onVideo = true;
        ctx.target = $N('video', {
          src: content.srcUrl
        });
        break;
      case 'audio':
        ctx.onVideo = true;
        ctx.target = $N('audio', {
          src: content.srcUrl
        });
        break;
      case 'image':
        ctx.onImage = true;
        ctx.target = $N('img', {
          src: content.srcUrl
        });
        break;
      default:
        if (content.linkUrl) {
          // case link
          ctx.onLink = true;
          ctx.link = ctx.target = $N('a', {
            href: content.linkUrl
          });
          ctx.title = content.linkUrl;
        }
        break;
      }
      update(ctx, TBRL.createContext(TBRL.getContextMenuTarget()));
      TBRL.share(ctx, Extractors.check(ctx)[0], true);
    });

    Extractors.register({
      name     : 'ReBlog - tsū',
      ICON     : 'https://tsu-production-app.s3.amazonaws.com/assets/favicon-8a200fdedff0c42cc21c9c50be34f13a.ico',
      HOME_URL : 'http://www.tsu.co',

      check : function (ctx) {
        return (/(www\.tsu\.co)\//).test(ctx.href) && this.getPostBox(ctx);
      },

      getPostBox : function (ctx) {
        var box = $X('./ancestor-or-self::div[contains(concat(" ",normalize-space(@class)," ")," post ")]', ctx.target)[0];
        return box;
      },

      extract : function (ctx) {
        var box = $X('./ancestor-or-self::div[contains(concat(" ",normalize-space(@class)," ")," post ")]', ctx.target)[0];

        var title = $X('./div[@class="post_story"]/div[@class="provider_status_text"]/div[@class="title"]/text()', box)[0] ||
          $X('./div[@class="post_story"]/div[@class="provider_status_text"]/text()', box)[0];
        title = (title || '').trim();
        var href  = $X('./div[@class="post_social"]//a[text()="Open"]/@href', box)[0];
        var image = $X('./div[@class="post_story"]//a[@class="image"]/img/@src', box)[0] ||
          $X('./div[@class="post_story"]//a[@class="post_picture_link"]/@href', box)[0];
        var desc  = $X('./div[@class="post_story"]//a[@class="description"]/text()', box)[0];

        ctx.title = title || 'tsū';
        ctx.href  = this.HOME_URL + href;

        var result = {
          type        : image ? 'photo' : 'link',
          item        : ctx.title,
          itemUrl     : image ? image : ctx.href,
          body        : desc,
          description : ''
        };

        var url = $X('./div[@class="post_social"]//div[@class="share_link"]/a/@href', box)[0];
        if (url) {
          result.favorite = {
            name  : 'tsū',
            share : this.HOME_URL + url
          }
        }

        return result;
      }
    }, 'ReBlog - Tumblr link', true);
    return;
  }
})();
