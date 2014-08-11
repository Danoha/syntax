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
  var Links = function() {
  };

  Links.prototype.replace = function(html, opts) {
    return URI.withinString(html, function(url) {
      var uri = URI(url);
      if (!uri.protocol())
        uri.protocol('http');

      var plus = ''; var inner = '';
      if (opts && opts.youtube === true) {
        var id = app.utils.youtube.parseId(uri.toString());

        if (id !== null)
          plus += ' <a href="#" onclick="document.syntaxApp.utils.youtube.showEmbed(\'' + id + '\'); return false;"><span class="glyphicon glyphicon-facetime-video"></span></a>';
      }
      if (opts && opts.images === true && app.utils.images.isImage(uri.filename())) {
        inner += ' onmouseenter="document.syntaxApp.utils.images.showHover(this); return false;"';
      }

      return '<a' + inner + ' target="_blank" href="' + uri.toString() + '">' + url + '</a>' + plus;
    });
  };

  app.utils.links = new Links();
})(document.syntaxApp);