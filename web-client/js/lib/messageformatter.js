/* 
 * Copyright (C) 2014 Danoha
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

'use strict';

define(['jquery', '../app', 'moment', './emoticons', './messageparser', '../vendor/uri/main', '../core/bus', '../vendor/highlight.min'], function($, app, moment, emoticons, messageParser, URI, bus) {
  var MessageFormatter = function() {};

  var spotifyRegEx = /(?:[^\w]|^)(spotify:[a-zA-Z:0-9_]+)(?:[^\w]|$)/gm;
  var magnetRegEx = /(?:[^\w]|^)(magnet:\?[a-zA-Z0-9:\.=&%+;\-]+)(?:[^\w]|$)/gm;

  var ytDefaultUrlRegEx = /^https?:\/\/(www.)youtube.com\/watch/;
  var ytShortUrlRegEx = /^http:\/\/youtu.be\/[a-zA-Z0-9\-_]+/;

  var imageExts = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'];

  function parseYoutubeId(url) {
    if (!url)
      return null;

    var uri = new URI(url);
    if (url.match(ytDefaultUrlRegEx) !== null)
      return uri.search(true)['v'];
    else if (url.match(ytShortUrlRegEx) !== null)
      return uri.filename();
    else
      return null;
  }

  function formatCode(node) {
    node.find('code').each(function() {
      $(this).wrap('<pre>').contents().unwrap();
    });

    node.find('pre').each(function(i, block) {
      hljs.highlightBlock(block);
    });
  }

  function escapeHtml(html) {
    return messageParser.escapeHtml(html);
  }
  

  function formatEmoticons(node) {
    node.contents().each(function(i) {
      if (this.nodeType !== 3)
        return;

      var t = $(this);
      var html = emoticons.replace(escapeHtml(t.text()));
      t.before(html).remove();
    })
  }

  var newLineRegEx = /(?:\r\n|\r|\n)/g;

  function formatNewLines(node) {
    node.contents().each(function(i) {
      if (this.nodeType !== 3)
        return;

      var t = $(this);
      var replacement = escapeHtml(t.text()).replace(newLineRegEx, '<br>');
      t.before(replacement).remove();
    });

    node.find('pre + br').remove();
  }

  function formatLinks(node) {
    for (var again = true; again;) {
      again = false;

      node.contents().each(function(i) {
        if (this.nodeType !== 3)
          return;

        var t = $(this);
        var text = t.text();
        var html = escapeHtml(text);

        function replace(urls, classes) {
          var replaced = false;
          $.each(urls, function(i, url) {
            var htmlUrl = escapeHtml(url);
            html = html.replace(htmlUrl, '<a class="' + classes + '">' + url + '</a>');
            replaced = true;
          });
          return replaced;
        }
        
        function matchAndReplace(regex, classes) {
          var item;
          var urls = [];
          while (item = spotifyRegEx.exec(text))
            urls.push(item[1]);
    
          return replace(urls, classes);
        }
        
        if(matchAndReplace(spotifyRegEx, 'ignore-unload spotify')) {
          again = true;
          t.replaceWith(html);
          return false;
        }

        if(matchAndReplace(magnetRegEx, 'ignore-unload magnet')) {
          again = true;
          t.replaceWith(html);
          return false;
        }

        var urls = [];
        URI.withinString(text, function(url) {
          urls.push(url);
          return false;
        });

        if (replace(urls, 'link')) {
          again = true;
          t.replaceWith(html);
          return false;
        }
      });
    }

    node.find('a').each(function() {
      var t = $(this);
      var href = t.text();

      if(t.is('.link')) {
        t.attr('target', '_blank');
        
        var uri = URI(href);

        if (!uri.scheme()) {
          uri.scheme('http');
          href = uri.toString();
        }
      }
      
      t.attr({
        href: href
      });
    }).each(function() {
      var a = $(this);
      var url = a.attr('href');
      var uri = new URI(url);
      var yId, imagePreview = null, tooltipText = null;

      if (bus.userStorage.get('embed.spotify.enabled') && a.is('.spotify')) {
        $('<a>').html('<span class="glyphicon glyphicon-music"></span>')
          .addClass('embed spotify link-attachment')
          .attr('href', url).insertAfter(a);
      }
      else if ((yId = parseYoutubeId(url))) {
        if(bus.userStorage.get('preview.youtube.enabled'))
          imagePreview = 'https://img.youtube.com/vi/' + yId + '/default.jpg';

        $.getJSON('https://gdata.youtube.com/feeds/api/videos/' + yId + '?v=2&alt=json').done(function(data) {
          var title = data.entry.title.$t;
          var length = data.entry.media$group.media$content[0].duration;
          var duration = moment.duration(length * 1000);
          var t = title + ' [' + duration.minutes() + ':' + (duration.seconds() > 9 ? duration.seconds() : '0' + duration.seconds()) + ']';

          a.attr({
            'data-title': title,
            'data-length': length
          });

          if (bus.userStorage.get('embed.youtube.replace')) {
            a.text(t);
            a.prepend('<span class="icon icon-youtube"></span>');
          }
          else
            a.attr('data-tooltiptext', t);
        });

        if (bus.userStorage.get('embed.youtube.enabled')) {
          $('<a>').html('<span class="glyphicon glyphicon-facetime-video"></span>')
            .addClass('embed youtube link-attachment')
            .attr({
              href: url,
              'data-id': yId
            }).insertAfter(a);
        }
      }
      else if (bus.userStorage.get('embed.twitch.enabled') && uri.domain() === 'twitch.tv') {
        var parts = uri.directory(true).split('/');
        var id;
        if (parts.length === 3)
          id = uri.filename();
        else if (parts.length === 4)
          id = parts[3];

        if (parts.length >= 3 && $.inArray(parts[2], ['b', 'c']) >= 0) {
          $('<a>').html('<span class="glyphicon glyphicon-facetime-video"></span>')
            .addClass('embed twitch link-attachment')
            .attr({
              href: url,
              'data-id': id
            }).insertAfter(a);
        }
      }
      else if (bus.userStorage.get('preview.images.enabled') && $.inArray(uri.suffix(), imageExts) >= 0)
        imagePreview = url;

      if (imagePreview !== null)
        a.attr('data-imagepreview', imagePreview);
      
      if(tooltipText !== null)
        a.attr('data-tooltiptext', tooltipText);
    });
  }

  function format(text) {
    var parsed = messageParser.parse(text);
    var node = $('<div>').html(parsed);

    formatCode(node);
    formatNewLines(node);
    formatEmoticons(node);
    formatLinks(node);

    var ret = node.contents();
    node.remove();
    return ret;
  }

  function getChatRow() {
    return $('<div>').addClass('message row').append(
      $('<div>').addClass('col-xs-1 sender')
    ).append(
      $('<div>').addClass('col-xs-10 text')
    ).append(
      $('<div>').addClass('col-xs-1 time')
    );
  }

  function getSystemRow() {
    return $('<div>').addClass('message system row').append(
      $('<div>').addClass('col-xs-offset-1 col-xs-10 text')
    ).append(
      $('<div>').addClass('col-xs-1 time')
    );
  }

  function chatMessage(msg, flow) {
    var sender = flow.sender === 'self' ? app.user.nick : flow.sender.displayName();
    var time = moment.unix(msg.time).format('HH:mm');
    var contents = format(msg.text);

    return getChatRow()
      .find('.sender').text(sender).end()
      .find('.time').text(time).end()
      .find('.text').append(contents).end();
  }

  function systemMessage(text) {
    var time = moment().format('HH:mm');

    return getSystemRow()
      .find('.time').text(time).end()
      .find('.text').text(text).end();
  }

  MessageFormatter.prototype.format = function(msg, flow) {
    if (typeof msg === 'string')
      return systemMessage(msg);
    else
      return chatMessage(msg, flow);
  };

  return new MessageFormatter();
});