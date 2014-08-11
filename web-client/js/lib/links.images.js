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
  var Images = function() {
  };

  var imageExtensions = ['.jpg', '.jpeg', '.gif', '.webm', '.png', '.webp'];
  var images = [];
  
  Images.prototype.isImage = function(filename) {
    if(!filename)
      return;
    
    for(var i in imageExtensions) {
      var ext = imageExtensions[i];
      
      if(filename.lastIndexOf(ext) !== filename.length - ext.length)
        continue;
      
      return true;
    }
    
    return false;
  };
  
  Images.prototype.showHover = function(anchor) {
    var a = $(anchor);
    
    a.tooltip({
      html: true,
      title: '<img class="tooltip-image" src="' + anchor.href + '">',
      container: '.messages .panel-body',
      placement: 'auto right'
    }).tooltip('show');
  };

  app.utils.images = new Images();
})(document.syntaxApp);
