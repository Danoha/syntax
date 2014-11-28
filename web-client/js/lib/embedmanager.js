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

define(['jquery'], function ($) {
  function EmbedManager() {
  }

  function formatSpotify(a) {
    return {
      title: 'Spotify',
      html: '<iframe src="https://embed.spotify.com/?uri=' + a.attr('href') + '" width="100%" height="80" frameborder="0" allowtransparency="true"></iframe>'
    };
  }

  function wrap4by3(html) {
    return '<div class="embed-responsive embed-responsive-4by3">' + html + '</div>';
  }

  function formatYoutube(a) {
    return {
      title: 'YouTube',
      html: wrap4by3('<iframe width="100%" height="100%" src="https://www.youtube.com/embed/' + a.data('id') + '?autoplay=1" allowfullscreen></iframe>')
    };
  }

  function formatTwitch(a) {
    return {
      title: 'Twitch',
      html: wrap4by3('<object bgcolor="#000000" data="https://www-cdn.jtvnw.net/swflibs/TwitchPlayer.swf" height="100%" type="application/x-shockwave-flash" width="100%"><param name="movie" value="https://www-cdn.jtvnw.net/swflibs/TwitchPlayer.swf" /><param name="allowScriptAccess" value="always" /><param name="allowNetworking" value="all" /><param name="allowFullScreen" value="true" /><param name="flashvars" value="auto_play=true&amp;start_volume=25&amp;chapter_id=5069854" /></object>')
    };
  }

  EmbedManager.prototype.format = function (attachment) {
    var a = $(attachment);

    if (a.is('.spotify'))
      return formatSpotify(a);
    else if (a.is('.youtube'))
      return formatYoutube(a);
    else if (a.is('.twitch'))
      return formatTwitch(a);

    return null;
  };

  return new EmbedManager();
});