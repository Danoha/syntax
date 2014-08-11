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


(function(app) {
  var YouTube = function() {
  };

  var ytDefaultUrlRegEx = /^https?:\/\/(www.)youtube.com\/watch/;
  var ytShortUrlRegEx = /^http:\/\/youtu.be\/[a-zA-Z0-9\-_]+/;
  YouTube.prototype.parseId = function(url) {
    if (!url)
      return null;

    var uri = new URI(url);
    if (url.match(ytDefaultUrlRegEx) !== null)
      return uri.search(true)['v'];
    else if (url.match(ytShortUrlRegEx) !== null)
      return uri.filename();
    else
      return null;
  };

  YouTube.prototype.getEmbed = function(id) {
    return '<iframe width="100%" height="100%" src="https://www.youtube.com/embed/' + id + '?autoplay=1" frameborder="0" allowfullscreen></iframe>';
  };
  
  YouTube.prototype.showEmbed = function(id) {
    var embed = this.getEmbed(id);
    
    app.appModelView.app.embed(embed);
  };

  app.utils.youtube = new YouTube();
})(document.syntaxApp);
